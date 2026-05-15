import { Router } from 'express'
import { runChecks } from '../setup.js'
import { getConfig, saveConfig, isSetupComplete, markSetupComplete } from '../history.js'

const router = Router()

router.get('/checks', async (_req, res) => {
  try {
    const checks = await runChecks()
    res.json({ checks, setupComplete: isSetupComplete(), config: getConfig() })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/config', (req, res) => {
  const { activeProduct } = req.body
  if (!activeProduct) return res.status(400).json({ error: 'activeProduct required' })
  saveConfig({ activeProduct })
  res.json({ ok: true })
})

router.post('/complete', (_req, res) => {
  markSetupComplete()
  res.json({ ok: true })
})

router.get('/config', (_req, res) => {
  res.json(getConfig())
})

export default router
