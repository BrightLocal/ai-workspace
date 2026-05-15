import { Router } from 'express'
import { startConnect, getActiveConnect } from '../runner.js'

const router = Router()

// POST /api/setup/connect/:service — start a connection attempt
router.post('/:service', (req, res) => {
  const { service } = req.params
  if (!['atlassian', 'google'].includes(service)) {
    return res.status(400).json({ error: 'Unknown service' })
  }
  try {
    const connectId = startConnect(service)
    res.json({ connectId })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/setup/connect/:service — check if a connect is active
router.get('/:service', (req, res) => {
  const connectId = getActiveConnect(req.params.service)
  res.json({ connectId: connectId || null })
})

export default router
