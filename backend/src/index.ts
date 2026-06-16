import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { scanRouter } from './routes/scan'
import { historyRouter } from './routes/history'
import { optionSetsRouter } from './routes/optionsets'
import { readinessRouter } from './routes/readiness'
import { comparisonRouter } from './routes/comparison'
import { remediationRouter } from './routes/remediation'
import { flowsRouter } from './routes/flows'
import { connectionRefsRouter } from './routes/connectionrefs'

const REQUIRED_ENV = ['AZURE_TENANT_ID', 'AZURE_CLIENT_ID', 'AZURE_CLIENT_SECRET']
const missing = REQUIRED_ENV.filter(k => !process.env[k])
if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`)
  console.error('Copy backend/.env.example to backend/.env and fill in your Azure credentials.')
  process.exit(1)
}

const app = express()
const PORT = process.env.PORT ?? 3001

app.use(cors())
app.use(express.json())

app.get('/health', (_req, res) => res.json({ ok: true }))

app.use('/api/scan', scanRouter)
app.use('/api/scans', historyRouter)
app.use('/api/optionsets', optionSetsRouter)
app.use('/api/readiness', readinessRouter)
app.use('/api/comparison', comparisonRouter)
app.use('/api/remediation', remediationRouter)
app.use('/api/flows', flowsRouter)
app.use('/api/connectionrefs', connectionRefsRouter)

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`)
})
