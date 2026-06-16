import { Router, Request, Response } from 'express'
import axios from 'axios'
import { ConfidentialClientApplication } from '@azure/msal-node'
import { getFlowHealth } from '../flows'

export const flowsRouter = Router()

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
    timeout: 15000,
    headers: {
      Authorization: `Bearer ${result.accessToken}`,
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  })
}

flowsRouter.get('/health', async (req: Request, res: Response) => {
  const { environmentUrl } = req.query
  if (!environmentUrl || typeof environmentUrl !== 'string') {
    res.status(400).json({ error: 'environmentUrl query param is required' })
    return
  }
  try {
    const client = await makeDataverseClient(environmentUrl)
    const flows = await getFlowHealth(client)
    res.json({ environmentUrl, totalFlows: flows.length, flows })
  } catch (err) {
    const detail = axios.isAxiosError(err)
      ? (err.response?.data?.error?.message ?? err.message)
      : (err instanceof Error ? err.message : 'Failed')
    res.status(500).json({ error: detail })
  }
})
