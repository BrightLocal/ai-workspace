import { Router } from 'express'
import agents from '../agents.js'
import { getActiveRun } from '../runner.js'

const router = Router()

router.get('/', (_req, res) => {
  const list = agents.map((a) => ({
    slug: a.slug,
    name: a.name,
    description: a.description,
    longDescription: a.longDescription,
    inputFields: a.inputFields,
    requiresAtlassian: a.requiresAtlassian,
    requiresGoogle: a.requiresGoogle,
    activeRunId: getActiveRun(a.slug),
  }))
  res.json(list)
})

router.get('/:slug', (req, res) => {
  const agent = agents.find((a) => a.slug === req.params.slug)
  if (!agent) return res.status(404).json({ error: 'Agent not found' })
  res.json({ ...agent, activeRunId: getActiveRun(agent.slug) })
})

export default router
