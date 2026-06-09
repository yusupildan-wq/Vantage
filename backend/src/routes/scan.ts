import { Router, Request, Response } from 'express'
import axios from 'axios'
import { saveScan } from '../db'
import { scanEnvironment } from '../dataverse'

export const scanRouter = Router()

scanRouter.post('/', async (req: Request, res: Response) => {
  const { environmentUrl } = req.body

  if (!environmentUrl) {
    res.status(400).json({ error: 'environmentUrl is required' })
    return
  }

  try {
    const results = await scanEnvironment(environmentUrl)
    saveScan(environmentUrl, results)
    res.json({ results })
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status
      const detail = err.response?.data?.error?.message ?? err.message
      console.error(`Dataverse ${status}:`, detail)
      res.status(500).json({ error: `Dataverse error (${status}): ${detail}` })
    } else {
      const message = err instanceof Error ? err.message : 'Scan failed'
      console.error('Scan error:', message)
      res.status(500).json({ error: message })
    }
  }
})
