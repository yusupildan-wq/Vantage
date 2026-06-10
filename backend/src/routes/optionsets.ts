import { Router, Request, Response } from 'express'
import path from 'path'
import fs from 'fs'
import axios from 'axios'
import { ConfidentialClientApplication } from '@azure/msal-node'
import { ClientConfig } from '../types'
import { checkOptionSets, restoreOptionSets } from '../optionsets'

export const optionSetsRouter = Router()

const CONFIG_DIR = path.join(__dirname, '../../../config/clients')

function loadClientConfig(environmentUrl: string): ClientConfig | null {
  if (!fs.existsSync(CONFIG_DIR)) return null
  const files = fs.readdirSync(CONFIG_DIR).filter(f => f.endsWith('.json'))
  const normalised = environmentUrl.replace(/\/$/, '').toLowerCase()
  for (const file of files) {
    const config: ClientConfig = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, file), 'utf-8'))
    if (config.environmentUrl.replace(/\/$/, '').toLowerCase() === normalised) return config
  }
  return null
}

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
    timeout: 10000,
    headers: {
      Authorization: `Bearer ${result.accessToken}`,
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  })
}

optionSetsRouter.get('/status', async (req: Request, res: Response) => {
  const { environmentUrl } = req.query
  if (!environmentUrl || typeof environmentUrl !== 'string') {
    res.status(400).json({ error: 'environmentUrl query param is required' })
    return
  }
  const config = loadClientConfig(environmentUrl)
  if (!config) {
    res.status(404).json({ error: 'No client config found for this environment' })
    return
  }
  try {
    const client = await makeDataverseClient(environmentUrl)
    const results = await checkOptionSets(client, config)
    res.json({ clientName: config.name, results })
  } catch (err) {
    const detail = axios.isAxiosError(err)
      ? (err.response?.data?.error?.message ?? err.message)
      : (err instanceof Error ? err.message : 'Failed')
    res.status(500).json({ error: detail })
  }
})

optionSetsRouter.post('/restore', async (req: Request, res: Response) => {
  const { environmentUrl } = req.body
  if (!environmentUrl) {
    res.status(400).json({ error: 'environmentUrl is required' })
    return
  }
  const config = loadClientConfig(environmentUrl)
  if (!config) {
    res.status(404).json({ error: 'No client config found for this environment' })
    return
  }
  try {
    const client = await makeDataverseClient(environmentUrl)
    const result = await restoreOptionSets(client, config)
    res.json({ clientName: config.name, ...result })
  } catch (err) {
    const detail = axios.isAxiosError(err)
      ? (err.response?.data?.error?.message ?? err.message)
      : (err instanceof Error ? err.message : 'Failed')
    res.status(500).json({ error: detail })
  }
})
