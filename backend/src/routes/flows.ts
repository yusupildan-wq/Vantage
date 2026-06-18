import { Router, Request, Response } from 'express'
import axios from 'axios'
import { makeDataverseClient, validateEnvironmentUrl } from '../auth'
import { getFlowHealth, compareFlows } from '../flows'

export const flowsRouter = Router()

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
