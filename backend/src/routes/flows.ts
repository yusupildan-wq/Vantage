import { Router, Request, Response } from 'express'
import axios from 'axios'
import { makeDataverseClient, validateEnvironmentUrl } from '../auth'
import { getFlowHealth, compareFlows } from '../flows'
import { explainFlowError } from '../ai'

export const flowsRouter = Router()

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
  const { sourceUrl, targetUrl } = req.query
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
    const flows = await compareFlows(sourceClient, targetClient)
    res.json({ sourceUrl, targetUrl, totalFlows: flows.length, flows })
  } catch (err) {
    const detail = axios.isAxiosError(err)
      ? (err.response?.data?.error?.message ?? err.message)
      : (err instanceof Error ? err.message : 'Failed')
    res.status(500).json({ error: detail })
  }
})

flowsRouter.get('/health', async (req: Request, res: Response) => {
  const { environmentUrl } = req.query
  if (!environmentUrl || typeof environmentUrl !== 'string') {
    res.status(400).json({ error: 'environmentUrl query param is required' })
    return
  }
  try { validateEnvironmentUrl(environmentUrl) } catch (e) {
    res.status(400).json({ error: (e as Error).message }); return
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
