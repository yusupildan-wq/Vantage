import { Router, Request, Response } from 'express'
import { getAuditEvents } from '../audit'

export const auditRouter = Router()

auditRouter.get('/', (req: Request, res: Response) => {
  const limitRaw = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 100
  const limit = Number.isFinite(limitRaw) ? limitRaw : 100
  res.json({ events: getAuditEvents(limit) })
})
