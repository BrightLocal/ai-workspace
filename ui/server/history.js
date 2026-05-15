import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'fs'
import { join, resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { randomBytes } from 'crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const WORKSPACE_ROOT = resolve(__dirname, '../../')
const RUNS_BASE = join(WORKSPACE_ROOT, 'personal/ui-runs')

function runsDir(agentSlug) {
  return join(RUNS_BASE, agentSlug)
}

function runPath(agentSlug, runId) {
  return join(runsDir(agentSlug), `${runId}.json`)
}

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

// In-memory buffer for active runs
const activeRuns = new Map()

export function createRun(agentSlug, inputs) {
  const now = new Date()
  const ts = now.toISOString().replace(/[-:T]/g, '').slice(0, 15)
  const runId = `${ts}-${randomBytes(3).toString('hex')}`

  const record = {
    runId,
    agentSlug,
    startedAt: now.toISOString(),
    finishedAt: null,
    status: 'running',
    exitCode: null,
    inputs,
    outputLines: [],
  }

  ensureDir(runsDir(agentSlug))
  activeRuns.set(runId, record)
  return runId
}

export function appendLine(runId, line) {
  const record = activeRuns.get(runId)
  if (!record) return
  // Cap at 10000 lines
  if (record.outputLines.length < 10000) {
    record.outputLines.push(line)
  }
}

export function finalizeRun(agentSlug, runId, exitCode) {
  const record = activeRuns.get(runId)
  if (!record) return

  record.finishedAt = new Date().toISOString()
  record.exitCode = exitCode
  record.status = exitCode === 0 ? 'success' : 'failed'

  writeFileSync(runPath(agentSlug, runId), JSON.stringify(record, null, 2))
  activeRuns.delete(runId)
  return record
}

export function listRuns(agentSlug) {
  const dir = runsDir(agentSlug)
  if (!existsSync(dir)) return []

  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      try {
        const raw = JSON.parse(readFileSync(join(dir, f), 'utf8'))
        return {
          runId: raw.runId,
          agentSlug: raw.agentSlug,
          startedAt: raw.startedAt,
          finishedAt: raw.finishedAt,
          status: raw.status,
          exitCode: raw.exitCode,
          inputs: raw.inputs,
          lineCount: raw.outputLines?.length ?? 0,
        }
      } catch {
        return null
      }
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))
}

export function getRun(agentSlug, runId) {
  // Check active runs first
  if (activeRuns.has(runId)) return activeRuns.get(runId)

  const path = runPath(agentSlug, runId)
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

export function getConfig() {
  const configPath = join(RUNS_BASE, '.config.json')
  if (!existsSync(configPath)) return {}
  try {
    return JSON.parse(readFileSync(configPath, 'utf8'))
  } catch {
    return {}
  }
}

export function saveConfig(data) {
  ensureDir(RUNS_BASE)
  const configPath = join(RUNS_BASE, '.config.json')
  const existing = getConfig()
  writeFileSync(configPath, JSON.stringify({ ...existing, ...data }, null, 2))
}

export function isSetupComplete() {
  return existsSync(join(RUNS_BASE, '.setup-complete'))
}

export function markSetupComplete() {
  ensureDir(RUNS_BASE)
  writeFileSync(join(RUNS_BASE, '.setup-complete'), new Date().toISOString())
}
