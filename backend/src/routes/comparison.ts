import { Router, Request, Response } from 'express'
import axios from 'axios'
import { runComparison } from '../comparison'

export const comparisonRouter = Router()

comparisonRouter.post('/run', async (req: Request, res: Response) => {
  const { sourceUrl, targetUrl } = req.body
  if (!sourceUrl || typeof sourceUrl !== 'string') {
    res.status(400).json({ error: 'sourceUrl is required' })
    return
  }
  if (!targetUrl || typeof targetUrl !== 'string') {
    res.status(400).json({ error: 'targetUrl is required' })
    return
  }
  if (sourceUrl.trim() === targetUrl.trim()) {
    res.status(400).json({ error: 'sourceUrl and targetUrl must be different environments' })
    return
  }

  try {
    const report = await runComparison(sourceUrl.trim(), targetUrl.trim())
    res.json(report)
  } catch (err) {
    const detail = axios.isAxiosError(err)
      ? (err.response?.data?.error?.message ?? err.message)
      : (err instanceof Error ? err.message : 'Unknown error')
    res.status(500).json({ error: detail })
  }
})
