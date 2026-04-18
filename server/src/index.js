import express from 'express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync } from 'fs'

import authRouter from './routes/auth.js'
import schedulerRouter from './routes/scheduler.js'
import dashboardRouter from './routes/dashboard.js'
import clientsRouter from './routes/clients.js'
import financeRouter from './routes/finance.js'
import settingsRouter from './routes/settings.js'
import appointmentsRouter from './routes/appointments.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3001

app.use(express.json())

// ── Rotas da API ──────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter)
app.use('/api/scheduler', schedulerRouter)
app.use('/api/dashboard', dashboardRouter)
app.use('/api/clients', clientsRouter)
app.use('/api/finance', financeRouter)
app.use('/api/settings', settingsRouter)
app.use('/api/appointments', appointmentsRouter)

// ── Servir arquivos enviados (logos, áudios) ──────────────────────────────────
const uploadsDir = join(__dirname, '../../uploads')
if (existsSync(uploadsDir)) app.use('/uploads', express.static(uploadsDir))

// ── Servir frontend em produção ───────────────────────────────────────────────
const clientDist = join(__dirname, '../../client/dist')
if (existsSync(clientDist)) {
  app.use(express.static(clientDist))
  app.get('*', (_req, res) => {
    res.sendFile(join(clientDist, 'index.html'))
  })
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
