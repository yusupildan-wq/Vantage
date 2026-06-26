import { Router, Request, Response } from 'express'
import axios from 'axios'
import { makeDataverseClient, validateEnvironmentUrl } from '../auth'
import { getFlowHealth, compareFlows, fetchAllPages, normalizeDataverseId } from '../flows'
import { explainFlowError } from '../ai'

export const flowsRouter = Router()

// GET /api/flows/solutions
flowsRouter.get('/solutions', async (req: Request, res: Response) => {
  const { environmentUrl } = req.query
  if (!environmentUrl || typeof environmentUrl !== 'string') {
    res.status(400).json({ error: 'environmentUrl query param is required' }); return
  }
  try { validateEnvironmentUrl(environmentUrl) } catch (e) {
    res.status(400).json({ error: (e as Error).message }); return
  }
  try {
    const client = await makeDataverseClient(environmentUrl)
    const [solResp, components, flows] = await Promise.all([
      client.get(`/solutions?$select=solutionid,uniquename,friendlyname,ismanaged&$orderby=friendlyname asc`),
      fetchAllPages(client, `/solutioncomponents?$filter=componenttype eq 29&$select=objectid,_solutionid_value`),
      fetchAllPages(client, `/workflows?$filter=category eq 5&$select=workflowid,workflowidunique`),
    ])
    const cloudFlowIds = new Set<string>()
    for (const f of flows) {
      const workflowId = normalizeDataverseId(f.workflowid)
      const uniqueId = normalizeDataverseId(f.workflowidunique)
      if (workflowId) cloudFlowIds.add(workflowId)
      if (uniqueId) cloudFlowIds.add(uniqueId)
    }
    const flowCountBySolution = new Map<string, number>()
    for (const c of components) {
      const objectId = normalizeDataverseId(c.objectid)
      if (!cloudFlowIds.has(objectId)) continue
      const sid = normalizeDataverseId(c['_solutionid_value'])
      if (sid) flowCountBySolution.set(sid, (flowCountBySolution.get(sid) ?? 0) + 1)
    }
    const solutions = (solResp.data.value ?? [])
      .filter((s: any) => s.uniquename !== 'Default' && s.uniquename !== 'Active')
      .map((s: any) => ({
        uniqueName: s.uniquename,
        displayName: s.friendlyname,
        isManaged: s.ismanaged,
        flowCount: flowCountBySolution.get(normalizeDataverseId(s.solutionid)) ?? 0,
      }))
      .filter((s: any) => s.flowCount > 0)
      .sort((a: any, b: any) => b.flowCount - a.flowCount)
    res.json({ solutions })
  } catch (err) {
    const detail = axios.isAxiosError(err)
      ? (err.response?.data?.error?.message ?? err.message)
      : (err instanceof Error ? err.message : 'Failed')
    res.status(500).json({ error: detail })
  }
})

// POST /api/flows/explain-error
flowsRouter.post('/explain-error', async (req: Request, res: Response) => {
  const { flowName, errorMessage } = req.body
  if (!flowName || !errorMessage) {
    res.status(400).json({ error: 'flowName and errorMessage are required' }); return
  }
  try {
    const explanation = await explainFlowError(flowName, errorMessage)
    res.json({ explanation })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed'
    res.status(message.includes('Settings') ? 503 : 500).json({ error: message })
  }
})

flowsRouter.get('/compare', async (req: Request, res: Response) => {
  const { sourceUrl, targetUrl, solutionName } = req.query
  if (!sourceUrl || !targetUrl || typeof sourceUrl !== 'string' || typeof targetUrl !== 'string') {
    res.status(400).json({ error: 'sourceUrl and targetUrl query params are required' })
    return
  }
  try { validateEnvironmentUrl(sourceUrl); validateEnvironmentUrl(targetUrl) } catch (e) {
    res.status(400).json({ error: (e as Error).message }); return
  }
  try {
    const [sourceClient, targetClient] = await Promise.all([
      makeDataverseClient(sourceUrl),
      makeDataverseClient(targetUrl),
    ])
    const solName = typeof solutionName === 'string' && solutionName ? solutionName : undefined
    const flows = await compareFlows(sourceClient, targetClient, solName)
    res.json({ sourceUrl, targetUrl, totalFlows: flows.length, flows })
  } catch (err) {
    const detail = axios.isAxiosError(err)
      ? (err.response?.data?.error?.message ?? err.message)
      : (err instanceof Error ? err.message : 'Failed')
    res.status(500).json({ error: detail })
  }
})

flowsRouter.get('/health', async (req: Request, res: Response) => {
  const { environmentUrl, solutionName } = req.query
  if (!environmentUrl || typeof environmentUrl !== 'string') {
    res.status(400).json({ error: 'environmentUrl query param is required' })
    return
  }
  try { validateEnvironmentUrl(environmentUrl) } catch (e) {
    res.status(400).json({ error: (e as Error).message }); return
  }
  try {
    const client = await makeDataverseClient(environmentUrl)
    const solName = typeof solutionName === 'string' && solutionName ? solutionName : undefined
    const flows = await getFlowHealth(client, solName)
    res.json({ environmentUrl, totalFlows: flows.length, flows })
  } catch (err) {
    const detail = axios.isAxiosError(err)
      ? (err.response?.data?.error?.message ?? err.message)
      : (err instanceof Error ? err.message : 'Failed')
    res.status(500).json({ error: detail })
  }
})
