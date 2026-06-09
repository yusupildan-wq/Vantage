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
      console.error('Dataverse error:', err.response?.status, JSON.stringify(err.response?.data))
    } else {
      console.error('Scan error:', err)
    }
    const message = err instanceof Error ? err.message : 'Scan failed'
    res.status(500).json({ error: message })
  }
})
