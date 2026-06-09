import { Router, Request, Response } from 'express'
import { saveScan } from '../db'
import { MOCK_RESULTS } from '../mockData'

export const scanRouter = Router()

scanRouter.post('/', (req: Request, res: Response) => {
  const { environmentUrl } = req.body

  if (!environmentUrl) {
    res.status(400).json({ error: 'environmentUrl is required' })
    return
  }

  const results = MOCK_RESULTS
  saveScan(environmentUrl, results)
  res.json({ results })
})
