import { Router, Request, Response } from 'express'
import axios from 'axios'
import { ConfidentialClientApplication } from '@azure/msal-node'
import { getConnectionRefHealth, getEnvironmentId, autoFixConnectionRef } from '../connectionrefs'

export const connectionRefsRouter = Router()

async function makeDataverseClient(environmentUrl: string) {
  const msalClient = new ConfidentialClientApplication({
    auth: {
      clientId: process.env.AZURE_CLIENT_ID!,
      clientSecret: process.env.AZURE_CLIENT_SECRET!,
      authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
    },
  })
  const baseUrl = environmentUrl.endsWith('/') ? environmentUrl : `${environmentUrl}/`
  const result = await msalClient.acquireTokenByClientCredential({ scopes: [`${baseUrl}.default`] })
  if (!result) throw new Error('Failed to acquire access token')

  return axios.create({
    baseURL: `${environmentUrl.replace(/\/$/, '')}/api/data/v9.2`,
    timeout: 30000,
    headers: {
      Authorization: `Bearer ${result.accessToken}`,
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  })
}

connectionRefsRouter.get('/health', async (req: Request, res: Response) => {
  const { environmentUrl } = req.query
  if (!environmentUrl || typeof environmentUrl !== 'string') {
    res.status(400).json({ error: 'environmentUrl query param is required' })
    return
  }
  try {
    const client = await makeDataverseClient(environmentUrl)
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
  const { environmentUrl, connectionRefId } = req.body
  if (!environmentUrl || !connectionRefId) {
    res.status(400).json({ error: 'environmentUrl and connectionRefId are required' })
    return
  }
  try {
    const client = await makeDataverseClient(environmentUrl)
    const result = await autoFixConnectionRef(client, connectionRefId)
    res.json(result)
  } catch (err) {
    const detail = axios.isAxiosError(err)
      ? (err.response?.data?.error?.message ?? err.message)
      : (err instanceof Error ? err.message : 'Failed')
    res.status(500).json({ error: detail })
  }
})
