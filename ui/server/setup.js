import { execSync, exec } from 'child_process'
import { existsSync, readdirSync } from 'fs'
import { join, resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const WORKSPACE_ROOT = resolve(__dirname, '../../')

function run(cmd) {
  try {
    return { ok: true, output: execSync(cmd, { encoding: 'utf8', timeout: 5000 }).trim() }
  } catch (e) {
    return { ok: false, output: e.message }
  }
}

export async function runChecks() {
  const checks = []

  // Step 1: Node.js version
  const nodeResult = run('node --version')
  const nodeVersion = nodeResult.output?.replace('v', '') || ''
  const nodeMajor = parseInt(nodeVersion.split('.')[0], 10)
  checks.push({
    id: 'node',
    label: 'Node.js ≥ 18',
    status: nodeResult.ok && nodeMajor >= 18 ? 'pass' : 'fail',
    detail: nodeResult.ok ? `Found ${nodeResult.output}` : 'Node.js not found',
    fix: nodeResult.ok && nodeMajor < 18
      ? `Your Node.js is v${nodeVersion}. Download Node.js 18+ from https://nodejs.org`
      : 'Download Node.js 18+ from https://nodejs.org',
    fixUrl: 'https://nodejs.org',
  })

  // Step 2: Claude CLI
  const claudeResult = run('claude --version')
  checks.push({
    id: 'claude',
    label: 'Claude Code CLI',
    status: claudeResult.ok ? 'pass' : 'fail',
    detail: claudeResult.ok ? `Found ${claudeResult.output}` : 'claude command not found',
    fix: 'Install Claude Code: https://docs.anthropic.com/en/docs/claude-code',
    fixUrl: 'https://docs.anthropic.com/en/docs/claude-code',
  })

  // Step 3: Claude Code login (attempt a quick --print)
  let loginStatus = 'fail'
  let loginDetail = 'Not logged in'
  if (claudeResult.ok) {
    const loginTest = run('claude --print "echo ok" 2>&1 | head -5')
    if (loginTest.ok && !loginTest.output.includes('login') && !loginTest.output.includes('auth')) {
      loginStatus = 'pass'
      loginDetail = 'Logged in'
    } else {
      loginDetail = 'Run "claude login" in your terminal to authenticate'
    }
  }
  checks.push({
    id: 'login',
    label: 'Claude Code login',
    status: loginStatus,
    detail: loginDetail,
    fix: 'Run this command in your terminal: claude login',
    fixCommand: 'claude login',
  })

  // Step 4: ACTIVE_PRODUCT (always pass — user picks from dropdown)
  const products = existsSync(join(WORKSPACE_ROOT, 'products'))
    ? readdirSync(join(WORKSPACE_ROOT, 'products')).filter((f) =>
        existsSync(join(WORKSPACE_ROOT, 'products', f, 'CONTEXT.md'))
      )
    : []
  checks.push({
    id: 'active_product',
    label: 'Active product',
    status: 'info',
    detail: 'Select which product context agents should use',
    products,
  })

  // Step 5: Atlassian MCP (optional — check .mcp.json exists)
  const mcpPath = join(WORKSPACE_ROOT, 'agents/jira-to-pr/.mcp.json') +
    '|' + join(WORKSPACE_ROOT, '.mcp.json')
  const hasMcp = mcpPath.split('|').some(existsSync)
  checks.push({
    id: 'atlassian',
    label: 'Atlassian MCP (for Jira to PR)',
    status: hasMcp ? 'info' : 'warn',
    detail: hasMcp
      ? 'MCP config found. Authorize once by opening jira-to-pr in Claude Code.'
      : 'Only needed for the Jira to PR agent. Skip if not using it.',
    optional: true,
    fix: 'Open a terminal, run: cd agents/jira-to-pr && claude — then follow the Atlassian auth prompt.',
    fixCommand: 'cd agents/jira-to-pr && claude',
  })

  // Step 6: Google OAuth (optional — presence of calendar-analyzer directory)
  checks.push({
    id: 'google',
    label: 'Google OAuth (for Calendar Analyzer)',
    status: 'info',
    detail: 'Only needed for the Calendar Analyzer agent. Skip if not using it.',
    optional: true,
    fix: 'Open a terminal, run: cd agents/calendar-analyzer && claude — then follow the Google auth prompt.',
    fixCommand: 'cd agents/calendar-analyzer && claude',
  })

  return checks
}
