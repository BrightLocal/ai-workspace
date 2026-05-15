import { Router } from 'express'
import { startRun, getActiveRun } from '../runner.js'
import { listRuns, getRun } from '../history.js'

const router = Router()

// POST /api/runs — start a new run
router.post('/', (req, res) => {
  const { agentSlug, inputs } = req.body
  if (!agentSlug || !inputs) {
    return res.status(400).json({ error: 'agentSlug and inputs required' })
  }

  try {
    const runId = startRun(agentSlug, inputs)
    res.json({ runId })
  } catch (err) {
    if (err.message === 'already_running') {
      return res.status(409).json({
        error: 'already_running',
        runId: getActiveRun(agentSlug),
        message: 'This agent is already running. Wait for it to finish.',
      })
    }
    res.status(500).json({ error: err.message })
  }
})

// GET /api/runs/:agentSlug — list runs for an agent
router.get('/:agentSlug', (req, res) => {
  const runs = listRuns(req.params.agentSlug)
  res.json(runs)
})

// GET /api/runs/:agentSlug/:runId — get a specific run
router.get('/:agentSlug/:runId', (req, res) => {
  const run = getRun(req.params.agentSlug, req.params.runId)
  if (!run) return res.status(404).json({ error: 'Run not found' })
  res.json(run)
})

export default router
