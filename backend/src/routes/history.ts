import { Router, Request, Response } from 'express'
import { getScans } from '../db'

export const historyRouter = Router()

historyRouter.get('/', (_req: Request, res: Response) => {
  res.json({ scans: getScans() })
})
