import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import path from 'path'
import fs from 'fs'
import dotenv from 'dotenv'
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
import { settingsRouter, setupRouter } from './routes/setup'
import { issueBrowserSession, requireApiAuth, requireTrustedBrowserOrigin } from './security'

const envPath = process.env.VANTAGE_ENV_PATH?.trim() || ((process as any).pkg
  ? path.join(path.dirname(process.execPath), '.env')
  : path.join(__dirname, '../.env'))
dotenv.config({ path: envPath })

// Load credentials saved via the in-app setup wizard (overrides .env)
const savedConfig = loadSavedConfig()
if (savedConfig) applyConfig(savedConfig)

const PORT = process.env.PORT ?? 3001
const HOST = process.env.HOST ?? '127.0.0.1'

if (!isConfigured()) {
  console.log('Vantage is not configured yet.')
  console.log(`Open http://${HOST}:${PORT} to complete setup.`)
}

const app = express()
const productionRuntime = process.env.NODE_ENV === 'production' || Boolean((process as any).pkg)

app.use(helmet())
app.set('trust proxy', 1)

const corsOrigin = process.env.FRONTEND_URL ?? (
  productionRuntime
    ? [`http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`]
    : /^https?:\/\/(?:localhost|127\.0\.0\.1)(:\d+)?$/
)
app.use(cors({
  origin: corsOrigin,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'X-API-Key'],
  credentials: true,
}))

app.use(express.json({ limit: '100kb' }))

// ── Unauthenticated endpoints ──────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ ok: true }))

app.post('/session', requireTrustedBrowserOrigin, (req, res) => {
  issueBrowserSession(req, res)
  res.status(204).end()
})

// Setup wizard routes — no API key required (credentials don't exist yet)
app.use('/setup', requireTrustedBrowserOrigin, setupRouter)

// ── Authenticated API routes ───────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
})

app.use('/api', apiLimiter)

app.use('/api', requireApiAuth)

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
app.use('/api/setup', settingsRouter)

// ── Static frontend ────────────────────────────────────────────────────────
// pkg exe: frontend lives in public/ next to the exe on the real filesystem.
// Regular / dev build: frontend lives in ../../frontend/dist.
const frontendDist = (process as any).pkg
  ? path.join(path.dirname(process.execPath), 'public')
  : path.join(__dirname, '../../frontend/dist')

if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist))
  app.get('*', (_req, res) => res.sendFile(path.join(frontendDist, 'index.html')))
} else if ((process as any).pkg) {
  console.warn('Warning: public/ folder not found next to vantage.exe — place it in the same directory.')
}

app.listen(Number(PORT), HOST, () => {
  console.log(`Vantage running at http://${HOST}:${PORT}`)
  if ((process as any).pkg && process.env.NO_OPEN_BROWSER !== 'true') {
    setTimeout(() => require('child_process').exec(`start http://localhost:${PORT}`), 1000)
  }
})
