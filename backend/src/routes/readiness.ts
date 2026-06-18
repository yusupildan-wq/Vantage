import { Router, Request, Response } from 'express'
import axios from 'axios'
import { runReadinessCheck } from '../readiness'
import { validateEnvironmentUrl } from '../auth'

export const readinessRouter = Router()

readinessRouter.post('/check', async (req: Request, res: Response) => {
  const { environmentUrl } = req.body
  if (!environmentUrl || typeof environmentUrl !== 'string') {
    res.status(400).json({ error: 'environmentUrl is required' })
    return
  }
  try { validateEnvironmentUrl(environmentUrl) } catch (e) {
    res.status(400).json({ error: (e as Error).message }); return
  }

  try {
    const report = await runReadinessCheck(environmentUrl)
    res.json(report)
  } catch (err) {
    const detail = axios.isAxiosError(err)
      ? (err.response?.data?.error?.message ?? err.message)
      : (err instanceof Error ? err.message : 'Unknown error')
    res.status(500).json({ error: detail })
  }
})
