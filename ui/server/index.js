import express from 'express'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import { execSync, exec } from 'child_process'
import { existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join, resolve } from 'path'
import { URL } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const WORKSPACE_ROOT = resolve(__dirname, '../../')
const CLIENT_DIST = join(__dirname, '../client/dist')
// vite builds to ui/client/dist/ (root=client, outDir=dist)

const app = express()
app.use(express.json())

// Auto-build client if dist doesn't exist
if (!existsSync(CLIENT_DIST)) {
  console.log('Building client for the first time...')
  try {
    execSync('npm run build', { cwd: join(__dirname, '..'), stdio: 'inherit' })
  } catch (e) {
    console.error('Build failed. Run "npm run dev" for development mode instead.')
    process.exit(1)
  }
}

app.use(express.static(CLIENT_DIST))

// API routes
import agentsRouter from './routes/agents.js'
import runsRouter from './routes/runs.js'
import setupRouter from './routes/setup.js'
import connectRouter from './routes/connect.js'

app.use('/api/agents', agentsRouter)
app.use('/api/runs', runsRouter)
app.use('/api/setup', setupRouter)
app.use('/api/setup/connect', connectRouter)

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))

// SPA fallback
app.get('*', (_req, res) => {
  res.sendFile(join(CLIENT_DIST, 'index.html'))
})

const server = createServer(app)

// WebSocket server for streaming agent output
const wss = new WebSocketServer({ server, path: '/ws' })

import { attachWebSocket } from './runner.js'
attachWebSocket(wss)

const PORT = process.env.PORT || 3001
server.listen(PORT, () => {
  console.log(`AI Workspace UI running at http://localhost:${PORT}`)
  // Auto-open browser on macOS/Linux
  const url = `http://localhost:${PORT}`
  const opener = process.platform === 'darwin' ? 'open' : 'xdg-open'
  exec(`${opener} ${url}`, () => {})
})
