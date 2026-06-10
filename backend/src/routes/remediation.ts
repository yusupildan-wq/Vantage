import { Router, Request, Response } from 'express'
import axios from 'axios'
import { buildRemediationPlan } from '../remediation'

export const remediationRouter = Router()

remediationRouter.post('/plan', async (req: Request, res: Response) => {
  const { environmentUrl } = req.body
  if (!environmentUrl || typeof environmentUrl !== 'string') {
    res.status(400).json({ error: 'environmentUrl is required' })
    return
  }

  try {
    const plan = await buildRemediationPlan(environmentUrl.trim())
    res.json(plan)
  } catch (err) {
    const detail = axios.isAxiosError(err)
      ? (err.response?.data?.error?.message ?? err.message)
      : (err instanceof Error ? err.message : 'Unknown error')
    res.status(500).json({ error: detail })
  }
})
