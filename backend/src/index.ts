import express from 'express'
import cors from 'cors'
import { scanRouter } from './routes/scan'
import { historyRouter } from './routes/history'

const app = express()
const PORT = 3001

app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json())

app.use('/api/scan', scanRouter)
app.use('/api/scans', historyRouter)

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`)
})
