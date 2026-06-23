import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import path from 'path'
import fs from 'fs'
import { loadSavedConfig, applyConfig, isConfigured } from './config'
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
import { diagnosticsRouter } from './routes/diagnostics'
import { auditRouter } from './routes/audit'
import { setupRouter } from './routes/setup'

// Load credentials saved via the in-app setup wizard (overrides .env)
const savedConfig = loadSavedConfig()
if (savedConfig) applyConfig(savedConfig)

if (!isConfigured()) {
  console.log('Vantage is not configured yet.')
  console.log('Open http://localhost:3001 to complete setup.')
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

// ── Unauthenticated endpoints ──────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ ok: true }))

app.get('/config', (_req, res) => res.json({
  apiKey: process.env.API_KEY,
  configured: isConfigured(),
}))

// Setup wizard routes — no API key required (credentials don't exist yet)
app.use('/setup', setupRouter)

// ── Authenticated API routes ───────────────────────────────────────────────
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
app.use('/api/diagnostics', diagnosticsRouter)
app.use('/api/audit-log', auditRouter)

// ── Static frontend (production single-server mode) ────────────────────────
const frontendDist = path.join(__dirname, '../../frontend/dist')
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist))
  app.get('*', (_req, res) => res.sendFile(path.join(frontendDist, 'index.html')))
}

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`)
})
