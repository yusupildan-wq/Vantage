import { Router, Request, Response } from 'express'
import axios from 'axios'
import { getPipelineHealth, validateDevOpsUrl } from '../pipelines'

export const pipelinesRouter = Router()

pipelinesRouter.get('/health', async (req: Request, res: Response) => {
  const { projectUrl } = req.query
  if (!projectUrl || typeof projectUrl !== 'string') {
    res.status(400).json({ error: 'projectUrl query param is required (e.g. https://dev.azure.com/org/project)' })
    return
  }
  try { validateDevOpsUrl(projectUrl) } catch (e) {
    res.status(400).json({ error: (e as Error).message }); return
  }
  const pat = process.env.AZURE_DEVOPS_PAT
  if (!pat) {
    res.status(500).json({ error: 'AZURE_DEVOPS_PAT is not set. Add it to backend/.env.' })
    return
  }
  const daysRaw = req.query.days
  const days = daysRaw && typeof daysRaw === 'string' ? parseInt(daysRaw, 10) : undefined
  if (days !== undefined && (isNaN(days) || days < 0 || days > 365)) {
    res.status(400).json({ error: 'days must be a number between 0 and 365' }); return
  }
  try {
    const data = await getPipelineHealth(projectUrl, pat, days)
    res.json(data)
  } catch (err) {
    const detail = axios.isAxiosError(err)
      ? (err.response?.data?.message ?? err.response?.data?.error?.message ?? err.message)
      : (err instanceof Error ? err.message : 'Failed')
    res.status(500).json({ error: detail })
  }
})
