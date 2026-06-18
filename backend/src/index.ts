import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { scanRouter } from './routes/scan'
import { historyRouter } from './routes/history'
import { optionSetsRouter } from './routes/optionsets'
import { readinessRouter } from './routes/readiness'
import { comparisonRouter } from './routes/comparison'
import { remediationRouter } from './routes/remediation'
import { flowsRouter } from './routes/flows'
import { connectionRefsRouter } from './routes/connectionrefs'
import { pipelinesRouter } from './routes/pipelines'
import { optimizerRouter } from './routes/optimizer'

const REQUIRED_ENV = ['AZURE_TENANT_ID', 'AZURE_CLIENT_ID', 'AZURE_CLIENT_SECRET', 'API_KEY']
const missing = REQUIRED_ENV.filter(k => !process.env[k])
if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`)
  console.error('Copy backend/.env.example to backend/.env and fill in your credentials.')
  process.exit(1)
}

const app = express()
const PORT = process.env.PORT ?? 3001

app.use(helmet())

const corsOrigin = process.env.FRONTEND_URL ?? /^https?:\/\/localhost(:\d+)?$/
app.use(cors({
  origin: corsOrigin,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'X-API-Key'],
}))

app.use(express.json({ limit: '100kb' }))

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
})

app.use('/api', apiLimiter)

app.use('/api', (req, res, next) => {
  const key = req.headers['x-api-key']
  if (!key || key !== process.env.API_KEY) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  next()
})

app.get('/health', (_req, res) => res.json({ ok: true }))

app.use('/api/scan', scanRouter)
app.use('/api/scans', historyRouter)
app.use('/api/optionsets', optionSetsRouter)
app.use('/api/readiness', readinessRouter)
app.use('/api/comparison', comparisonRouter)
app.use('/api/remediation', remediationRouter)
app.use('/api/flows', flowsRouter)
app.use('/api/connectionrefs', connectionRefsRouter)
app.use('/api/pipelines', pipelinesRouter)
app.use('/api/optimizer', optimizerRouter)

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`)
})
