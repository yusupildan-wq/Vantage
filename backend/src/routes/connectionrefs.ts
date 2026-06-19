import { Router, Request, Response } from 'express'
import axios from 'axios'
import { makeDataverseClient, validateEnvironmentUrl } from '../auth'
import { getConnectionRefHealth, getEnvironmentId, autoFixConnectionRef } from '../connectionrefs'
import { recordAuditEvent } from '../audit'

export const connectionRefsRouter = Router()

connectionRefsRouter.get('/health', async (req: Request, res: Response) => {
  const { environmentUrl } = req.query
  if (!environmentUrl || typeof environmentUrl !== 'string') {
    res.status(400).json({ error: 'environmentUrl query param is required' })
    return
  }
  try { validateEnvironmentUrl(environmentUrl) } catch (e) {
    res.status(400).json({ error: (e as Error).message }); return
  }
  try {
    const client = await makeDataverseClient(environmentUrl, 30000)
    const [refs, environmentId] = await Promise.all([
      getConnectionRefHealth(client),
      getEnvironmentId(client),
    ])

    const broken = refs.filter(r => r.status === 'broken').length
    const flowsAtRisk = new Set(
      refs.filter(r => r.status === 'broken').flatMap(r => r.affectedFlows.map(f => f.id))
    ).size

    res.json({ environmentUrl, environmentId, total: refs.length, broken, healthy: refs.length - broken, flowsAtRisk, refs })
  } catch (err) {
    const detail = axios.isAxiosError(err)
      ? (err.response?.data?.error?.message ?? err.message)
      : (err instanceof Error ? err.message : 'Failed')
    res.status(500).json({ error: detail })
  }
})

connectionRefsRouter.post('/fix', async (req: Request, res: Response) => {
  const { environmentUrl, connectionRefId, connectionRefName, connectorType, safetyAcknowledged } = req.body
  if (!environmentUrl || !connectionRefId || typeof environmentUrl !== 'string') {
    res.status(400).json({ error: 'environmentUrl and connectionRefId are required' })
    return
  }
  if (safetyAcknowledged !== true) {
    res.status(400).json({ error: 'Safety acknowledgement is required before auto-fixing connection references.' })
    return
  }
  try { validateEnvironmentUrl(environmentUrl) } catch (e) {
    res.status(400).json({ error: (e as Error).message }); return
  }
  try {
    const client = await makeDataverseClient(environmentUrl)
    const result = await autoFixConnectionRef(client, connectionRefId)
    recordAuditEvent({
      action: 'connection_ref_auto_fix',
      targetSystem: 'Dataverse',
      target: environmentUrl,
      status: result.success ? 'success' : 'failure',
      summary: result.message,
      metadata: {
        connectionRefId,
        connectionRefName: typeof connectionRefName === 'string' ? connectionRefName : null,
        connectorType: typeof connectorType === 'string' ? connectorType : null,
        donorName: result.donorName ?? null,
      },
    })
    res.json(result)
  } catch (err) {
    const detail = axios.isAxiosError(err)
      ? (err.response?.data?.error?.message ?? err.message)
      : (err instanceof Error ? err.message : 'Failed')
    recordAuditEvent({
      action: 'connection_ref_auto_fix',
      targetSystem: 'Dataverse',
      target: environmentUrl,
      status: 'failure',
      summary: detail,
      metadata: {
        connectionRefId,
        connectionRefName: typeof connectionRefName === 'string' ? connectionRefName : null,
        connectorType: typeof connectorType === 'string' ? connectorType : null,
      },
    })
    res.status(500).json({ error: detail })
  }
})
