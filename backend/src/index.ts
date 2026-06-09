import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { scanRouter } from './routes/scan'
import { historyRouter } from './routes/history'

const REQUIRED_ENV = ['AZURE_TENANT_ID', 'AZURE_CLIENT_ID', 'AZURE_CLIENT_SECRET']
const missing = REQUIRED_ENV.filter(k => !process.env[k])
if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`)
  console.error('Copy backend/.env.example to backend/.env and fill in your Azure credentials.')
  process.exit(1)
}

const app = express()
const PORT = process.env.PORT ?? 3001

app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:5173' }))
app.use(express.json())

app.use('/api/scan', scanRouter)
app.use('/api/scans', historyRouter)

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`)
})
