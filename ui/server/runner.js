import { spawn, execSync } from 'child_process'
import { existsSync, writeFileSync, mkdirSync } from 'fs'
import { join, resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createRun, appendLine, finalizeRun, getConfig } from './history.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const WORKSPACE_ROOT = resolve(__dirname, '../../')

let CLAUDE_BIN = 'claude'
try {
  CLAUDE_BIN = execSync('which claude', { encoding: 'utf8' }).trim()
} catch {
  console.warn('Warning: could not resolve claude binary path. Falling back to "claude".')
}

const activeRunsByAgent = new Map()
const wsClients = new Map()       // runId → Set<WebSocket>
const frameBuffer = new Map()     // runId → frame[]  (for late WS connections)

// ── WebSocket ────────────────────────────────────────────────────────────────

export function attachWebSocket(wss) {
  wss.on('connection', (ws, req) => {
    const params = new URL(req.url, 'http://localhost').searchParams
    const runId = params.get('runId')
    if (!runId) { ws.close(); return }

    // Flush buffered frames to the newly-connected client
    for (const frame of frameBuffer.get(runId) || []) {
      try { ws.send(JSON.stringify(frame)) } catch {}
    }

    if (!wsClients.has(runId)) wsClients.set(runId, new Set())
    wsClients.get(runId).add(ws)
    ws.on('close', () => {
      wsClients.get(runId)?.delete(ws)
      if (wsClients.get(runId)?.size === 0) wsClients.delete(runId)
    })
  })
}

function broadcast(runId, frame) {
  if (!frameBuffer.has(runId)) frameBuffer.set(runId, [])
  const buf = frameBuffer.get(runId)
  if (buf.length < 2000) buf.push(frame)

  const msg = JSON.stringify(frame)
  for (const ws of wsClients.get(runId) || []) {
    try { ws.send(msg) } catch {}
  }
}

// ── stream-json parser ────────────────────────────────────────────────────────

const TOOL_LABELS = {
  // Google Calendar
  'mcp__claude_ai_Google_Calendar__list_calendars':  '📅 Listing calendars',
  'mcp__claude_ai_Google_Calendar__list_events':     '📅 Fetching calendar events',
  'mcp__claude_ai_Google_Calendar__get_event':       '📅 Getting event details',
  'mcp__claude_ai_Google_Calendar__suggest_time':    '📅 Suggesting meeting time',
  // Google Drive
  'mcp__claude_ai_Google_Drive__search_files':       '🔍 Searching Drive for notes',
  'mcp__claude_ai_Google_Drive__list_recent_files':  '🔍 Listing recent Drive files',
  'mcp__claude_ai_Google_Drive__read_file_content':  '📄 Reading Drive file',
  'mcp__claude_ai_Google_Drive__get_file_metadata':  '📄 Getting file metadata',
  'mcp__claude_ai_Google_Drive__download_file_content': '📄 Downloading file',
  // Atlassian
  'mcp__atlassian__getJiraIssue':                    '🎯 Fetching Jira issue',
  'mcp__atlassian__searchJiraIssuesUsingJql':        '🔍 Searching Jira',
  'mcp__atlassian__getConfluencePage':               '📄 Reading Confluence page',
  'mcp__atlassian__addCommentToJiraIssue':           '💬 Commenting on Jira issue',
  'mcp__atlassian__search':                          '🔍 Searching Atlassian',
  // File tools
  'Read':   (i) => `📖 Reading  ${shortPath(i?.file_path)}`,
  'Write':  (i) => `✍  Writing  ${shortPath(i?.file_path)}`,
  'Edit':   (i) => `✏️  Editing  ${shortPath(i?.file_path)}`,
  'Glob':   () => '🔍 Scanning files',
  'Grep':   (i) => `🔍 Searching for "${(i?.pattern || '').slice(0, 40)}"`,
  'Bash':   (i) => `⚡ ${(i?.command || '').slice(0, 80)}`,
  'Agent':  (i) => `🤖 Sub-agent: ${(i?.description || '').slice(0, 60)}`,
  'Task':   (i) => `🤖 Sub-agent: ${(i?.description || '').slice(0, 60)}`,
  'WebSearch': (i) => `🌐 Searching: ${(i?.query || '').slice(0, 60)}`,
  'WebFetch':  (i) => `🌐 Fetching page`,
}

function shortPath(p) {
  if (!p) return ''
  return p.replace(WORKSPACE_ROOT + '/', '').replace(/^\/Users\/[^/]+\//, '~/')
}

function labelTool(name, input) {
  const entry = TOOL_LABELS[name]
  if (!entry) return `⚙  ${name}`
  if (typeof entry === 'function') return entry(input)
  return entry
}

function parseStreamEvent(raw) {
  const trimmed = raw.trim()
  if (!trimmed) return null

  let event
  try { event = JSON.parse(trimmed) } catch { return trimmed }

  switch (event.type) {
    case 'system': {
      if (event.subtype !== 'init') return null
      const mcp = (event.mcp_servers || []).map(s => s.name).filter(Boolean)
      return mcp.length ? `Connected: ${mcp.join(', ')}` : null
    }

    case 'assistant': {
      const content = event.message?.content || []
      const parts = []
      for (const block of content) {
        if (block.type === 'thinking') continue        // hide internal reasoning
        if (block.type === 'text' && block.text?.trim()) {
          parts.push(block.text.trim())
        } else if (block.type === 'tool_use') {
          parts.push(labelTool(block.name, block.input))
        }
      }
      return parts.length ? parts.join('\n') : null
    }

    case 'user': {
      // Only surface tool errors — skip successful tool results (too noisy)
      const content = event.message?.content || []
      for (const block of content) {
        if (block.type === 'tool_result' && block.is_error) {
          const msg = typeof block.content === 'string' ? block.content : JSON.stringify(block.content)
          return `⚠  ${msg.slice(0, 120)}`
        }
      }
      return null
    }

    case 'result':
      if (event.subtype === 'error') return `✗  ${event.error || 'Unknown error'}`
      if (event.subtype === 'success') {
        const s = event.duration_ms ? Math.round(event.duration_ms / 1000) : null
        return `✓  Completed${s ? ` in ${s}s` : ''}`
      }
      return null

    default:
      return null
  }
}

// ── calendar date/meeting parser ──────────────────────────────────────────────

const MONTHS = {
  january:1, february:2, march:3, april:4, may:5, june:6,
  july:7, august:8, september:9, october:10, november:11, december:12,
  jan:1, feb:2, mar:3, apr:4, jun:6, jul:7, aug:8, sep:9, oct:10, nov:11, dec:12,
}
const WEEKDAYS = {
  sunday:0, monday:1, tuesday:2, wednesday:3, thursday:4, friday:5, saturday:6,
  sun:0, mon:1, tue:2, wed:3, thu:4, fri:5, sat:6,
}

function resolveMonthDay(day, month, ref) {
  let year = ref.getFullYear()
  const candidate = new Date(year, month - 1, day)
  if (candidate > new Date(ref.getTime() + 86400000)) year--
  return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`
}

function resolveLastWeekday(text, ref) {
  const match = text.match(new RegExp(`\\b(${Object.keys(WEEKDAYS).join('|')})\\b`, 'i'))
  if (!match) return ref.toISOString().slice(0, 10)
  const target = WEEKDAYS[match[1].toLowerCase()]
  const d = new Date(ref)
  const diff = ((d.getDay() - target + 7) % 7) || 7
  d.setDate(d.getDate() - diff)
  return d.toISOString().slice(0, 10)
}

function parseDateAndMeeting(raw) {
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const query = raw.trim()
  const strip = s => s.replace(/\b(from|on|at|the)\b|,/gi, '').replace(/\s+/g, ' ').trim()

  // ISO date (YYYY-MM-DD)
  const isoMatch = query.match(/\d{4}-\d{2}-\d{2}/)
  if (isoMatch) {
    const remainder = strip(query.replace(isoMatch[0], ''))
    return { resolvedDate: isoMatch[0], meetingName: remainder || null }
  }

  // Pure temporal: today / yesterday / last [weekday]
  if (/^(today|now)$/i.test(query)) return { resolvedDate: todayStr, meetingName: null }
  if (/^yesterday$/i.test(query)) {
    const d = new Date(today); d.setDate(d.getDate() - 1)
    return { resolvedDate: d.toISOString().slice(0, 10), meetingName: null }
  }
  if (/^last\s+\w+$/i.test(query)) return { resolvedDate: resolveLastWeekday(query, today), meetingName: null }

  // Month+day patterns anywhere in the string
  const monthNames = Object.keys(MONTHS).join('|')
  const dowNames = 'monday|tuesday|wednesday|thursday|friday|saturday|sunday'
  const dowPrefix = `(?:(?:${dowNames}),?\\s*)?`
  const dayMonthRe = new RegExp(`${dowPrefix}(\\d{1,2})\\s+(${monthNames})(?:\\s+\\d{4})?`, 'i')
  const monthDayRe = new RegExp(`${dowPrefix}(${monthNames})\\s+(\\d{1,2})(?:\\s+\\d{4})?`, 'i')

  const dm = query.match(dayMonthRe)
  if (dm) {
    const date = resolveMonthDay(parseInt(dm[1]), MONTHS[dm[2].toLowerCase()], today)
    return { resolvedDate: date, meetingName: strip(query.replace(dm[0], '')) || null }
  }
  const md = query.match(monthDayRe)
  if (md) {
    const date = resolveMonthDay(parseInt(md[2]), MONTHS[md[1].toLowerCase()], today)
    return { resolvedDate: date, meetingName: strip(query.replace(md[0], '')) || null }
  }

  // "last [weekday]" anywhere in the string (with surrounding meeting name)
  const lastMatch = query.match(new RegExp(`\\blast\\s+(${Object.keys(WEEKDAYS).join('|')})\\b`, 'i'))
  if (lastMatch) {
    const date = resolveLastWeekday(lastMatch[0], today)
    return { resolvedDate: date, meetingName: strip(query.replace(lastMatch[0], '')) || null }
  }

  return { resolvedDate: todayStr, meetingName: null }
}

// ── prompts ───────────────────────────────────────────────────────────────────

function calendarPrompt(dateOrQuery) {
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const nowISO = today.toISOString()

  const { resolvedDate, meetingName } = parseDateAndMeeting(dateOrQuery)
  const notesDir = join(WORKSPACE_ROOT, `personal/meeting-notes/${resolvedDate}`)

  if (meetingName) {
    return `Find and analyze the "${meetingName}" meeting on ${resolvedDate}. Today is ${todayStr}.

Follow these steps in order:

1. Use mcp__claude_ai_Google_Calendar__list_calendars, then mcp__claude_ai_Google_Calendar__list_events for date ${resolvedDate}.

2. Find the event whose title best matches "${meetingName}". If no match is found, stop and report it — do not analyze other meetings.

3. Search Google Drive for Gemini meeting notes for that specific event using mcp__claude_ai_Google_Drive__search_files. Try 2–3 search variations (event title, attendee names, date).

4. If no Drive notes are found for this meeting, stop and report: "No meeting notes found for ${meetingName} on ${resolvedDate}." Do not write any files.

5. Write ONE file: ${notesDir}/{HH-MM}-{slug}.md with:
   - Title, time, attendees
   - Summary of what was discussed (from Drive notes)
   - Key decisions
   - Action items
   - ⚠️ Critical items (blockers, risks, deadlines)

Do NOT analyze any other meetings. Do NOT write a daily summary. Only use the tools above. Do not run Bash commands or search the web.`
  }

  return `Analyze my Google Calendar for ${resolvedDate}. Today is ${todayStr}. Current time: ${nowISO}.

Follow these steps in order:

1. Use mcp__claude_ai_Google_Calendar__list_calendars, then mcp__claude_ai_Google_Calendar__list_events for ${resolvedDate}.

2. Filter to real meetings only — skip: reminders, OOO blocks, lunch blockers, focus/solo time, all-day events.
   Also skip any meeting whose start time is AFTER ${nowISO} — these are future meetings with no notes yet.

3. For each remaining past meeting, search Google Drive for Gemini notes using mcp__claude_ai_Google_Drive__search_files.
   Skip any meeting where no Drive notes are found.

4. Write ${notesDir}/00-raw-events.md with all calendar events for the day (including skipped ones, noting why they were skipped).

5. For each meeting WHERE notes were found, write ${notesDir}/{HH-MM}-{slug}.md with:
   - Title, time, attendees
   - Summary (from Drive notes)
   - Key decisions
   - Action items
   - ⚠️ Critical items

6. Write ${notesDir}/00-daily-summary.md covering only meetings for which notes were found. If no meetings had notes, note that.

Only use the tools above. Do not run Bash commands or search the web.`
}

function contextToPrdPrompt(featureSlug, activeProduct, skipMetrics, skipFeasibility) {
  const base = join(WORKSPACE_ROOT, `products/${activeProduct}/working/${featureSlug}`)
  const tplDir = join(WORKSPACE_ROOT, 'shared/templates')
  return `Transform the raw input at ${base}/00-input.md into a structured PRD.

Work through these phases in order:

Phase 1 — Context analysis:
Read ${base}/00-input.md. Extract: problem being solved, proposed solution, target users, success criteria, appetite/timeline. Write to ${base}/01-context.md.

${skipMetrics ? '' : `Phase 2 — Metrics review:
Read ${base}/01-context.md. Identify: which metrics are measurable, which are vague, which are missing. Write feedback to ${base}/02-metrics-review.md.

`}Phase ${skipMetrics ? 2 : 3} — PRD writing:
Read ${tplDir}/prd-confluence.md (template) and ${tplDir}/prd-confluence-examples.md (examples). Using the context from Phase 1${skipMetrics ? '' : ' and Phase 2'}, write a complete PRD to ${base}/03-prd.md. Follow the template structure exactly. Do not invent metrics or baselines — mark unknown values as TBD.

${skipFeasibility ? '' : `Phase ${skipMetrics ? 3 : 4} — Feasibility review:
Read ${base}/03-prd.md. As a senior architect, assess technical feasibility, identify risks, estimate complexity. Append a "## Architect Review" section to ${base}/03-prd.md.

`}Final output: ${base}/03-prd.md`
}

// ── spawn config per agent ────────────────────────────────────────────────────

function buildSpawnConfig(agentSlug, inputs) {
  const config = getConfig()
  const activeProduct = config.activeProduct || 'BrightLocal'
  const streamArgs = ['--print', '--verbose', '--output-format', 'stream-json', '--permission-mode', 'bypassPermissions']

  if (agentSlug === 'calendar-analyzer') {
    return {
      command: CLAUDE_BIN,
      args: [...streamArgs, calendarPrompt(inputs.dateOrQuery || 'today')],
      cwd: WORKSPACE_ROOT,
      env: { ...process.env, ACTIVE_PRODUCT: activeProduct },
      streamJson: true,
    }
  }

  if (agentSlug === 'context-to-prd') {
    const runsDir = join(WORKSPACE_ROOT, 'personal/ui-runs/context-to-prd')
    if (!existsSync(runsDir)) mkdirSync(runsDir, { recursive: true })
    return {
      command: CLAUDE_BIN,
      args: [...streamArgs, contextToPrdPrompt(inputs.featureSlug, activeProduct, inputs.skipMetrics, inputs.skipFeasibility)],
      cwd: WORKSPACE_ROOT,
      env: { ...process.env, ACTIVE_PRODUCT: activeProduct },
      streamJson: true,
      preRun: () => {
        const workingDir = join(WORKSPACE_ROOT, `products/${activeProduct}/working/${inputs.featureSlug}`)
        if (!existsSync(workingDir)) mkdirSync(workingDir, { recursive: true })
        writeFileSync(join(workingDir, '00-input.md'), inputs.inputText)
      },
    }
  }

  if (agentSlug === 'jira-to-pr') {
    return {
      command: join(WORKSPACE_ROOT, 'agents/jira-to-pr/scripts/run-agent.sh'),
      args: [inputs.jiraKey],
      cwd: join(WORKSPACE_ROOT, 'agents/jira-to-pr'),
      env: { ...process.env, ACTIVE_PRODUCT: activeProduct },
      streamJson: false,
    }
  }

  throw new Error(`Unknown agent: ${agentSlug}`)
}

// ── shared process runner ─────────────────────────────────────────────────────

function spawnAndStream(runId, spawnConfig, { onLine, onDone }) {
  const child = spawn(spawnConfig.command, spawnConfig.args, {
    cwd: spawnConfig.cwd,
    env: spawnConfig.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  function processLine(raw) {
    if (!raw.trim()) return
    const display = spawnConfig.streamJson ? parseStreamEvent(raw) : raw
    if (display !== null) onLine(display, raw)
  }

  let stdoutBuf = ''
  child.stdout.on('data', (chunk) => {
    stdoutBuf += chunk.toString()
    const lines = stdoutBuf.split('\n')
    stdoutBuf = lines.pop()
    lines.forEach(processLine)
  })

  let stderrBuf = ''
  child.stderr.on('data', (chunk) => {
    stderrBuf += chunk.toString()
    const lines = stderrBuf.split('\n')
    stderrBuf = lines.pop()
    lines.filter(l => l.trim()).forEach(l => onLine(l, l))
  })

  child.on('close', (exitCode) => {
    if (stdoutBuf.trim()) processLine(stdoutBuf)
    if (stderrBuf.trim()) onLine(stderrBuf, stderrBuf)
    onDone(exitCode ?? 1)
  })

  return child
}

// ── public API ────────────────────────────────────────────────────────────────

export function startRun(agentSlug, inputs) {
  if (activeRunsByAgent.has(agentSlug)) throw new Error('already_running')

  const runId = createRun(agentSlug, inputs)
  activeRunsByAgent.set(agentSlug, runId)

  const spawnConfig = buildSpawnConfig(agentSlug, inputs)
  if (spawnConfig.preRun) {
    try { spawnConfig.preRun() } catch (err) {
      activeRunsByAgent.delete(agentSlug)
      throw err
    }
    delete spawnConfig.preRun
  }

  broadcast(runId, { type: 'output', line: `Starting ${agentSlug}…` })

  spawnAndStream(runId, spawnConfig, {
    onLine(display, raw) {
      appendLine(runId, raw)
      broadcast(runId, { type: 'output', line: display })
    },
    onDone(exitCode) {
      finalizeRun(agentSlug, runId, exitCode)
      activeRunsByAgent.delete(agentSlug)
      frameBuffer.delete(runId)
      broadcast(runId, { type: exitCode === 0 ? 'done' : 'error', exitCode })
    },
  })

  return runId
}

export function getActiveRun(agentSlug) {
  return activeRunsByAgent.get(agentSlug) || null
}

// ── MCP connection attempts ───────────────────────────────────────────────────

const connectConfigs = {
  atlassian: {
    prompt: 'Use the atlassian MCP tool to list accessible Jira projects. Reply with only "CONNECTED" if successful.',
    cwd: WORKSPACE_ROOT,
  },
  google: {
    prompt: 'Use mcp__claude_ai_Google_Calendar__list_calendars to list my calendars. Reply with only "CONNECTED" if successful.',
    cwd: join(WORKSPACE_ROOT, 'agents/calendar-analyzer'),
  },
}

const activeConnects = new Map()

export function startConnect(service) {
  const cfg = connectConfigs[service]
  if (!cfg) throw new Error(`Unknown service: ${service}`)
  if (activeConnects.has(service)) return activeConnects.get(service)

  const connectId = `connect-${service}-${Date.now()}`
  activeConnects.set(service, connectId)

  const spawnConfig = {
    command: CLAUDE_BIN,
    args: ['--print', '--verbose', '--output-format', 'stream-json', '--permission-mode', 'bypassPermissions', cfg.prompt],
    cwd: cfg.cwd,
    env: { ...process.env },
    streamJson: true,
  }

  broadcast(connectId, { type: 'output', line: `Connecting to ${service}…` })

  spawnAndStream(connectId, spawnConfig, {
    onLine(display) { broadcast(connectId, { type: 'output', line: display }) },
    onDone(exitCode) {
      activeConnects.delete(service)
      frameBuffer.delete(connectId)
      broadcast(connectId, { type: exitCode === 0 ? 'done' : 'error', exitCode })
    },
  })

  return connectId
}

export function getActiveConnect(service) {
  return activeConnects.get(service) || null
}
