'use strict';
const fs = require('node:fs');
const express = require('express');
const { loadConfig } = require('./poller/config');
const { createJiraClient } = require('./poller/jira');
const { loadState, saveState } = require('./poller/state');
const { isPaused, checkRepos, checkContainers } = require('./poller/preflight');
const { acquireRunLock, releaseRunLock, readRunLock, clearStaleLock } = require('./poller/runlock');
const { runTicket, newRunId } = require('./poller/dispatcher');
const { handleRunResult, runPreflight, lockOwner, AI_LABELS } = require('./poller/tick');
const { startPollerLoop } = require('./poller/loop');

// The poller only works LM tickets; the manual trigger is held to the same project.
const JIRA_KEY_RE = /^LM-\d{1,6}$/;

// Manual trigger: same run lock and the same post-run handling as the poller.
// Label handling: if the ticket has an AI* label, swap it to AI-in-progress (keeps exactly
// one AI* label); if it has none, labels are untouched until the outcome label is added.
async function runManual(deps, key) {
  const issues = await deps.jira.search(`key = "${key}"`, ['labels']);
  const labels = (issues[0] && issues[0].labels) || [];
  const current = labels.find((l) => AI_LABELS.includes(l)) || null;
  if (current && current !== 'AI-in-progress') await deps.jira.setAiLabel(key, current, 'AI-in-progress');
  const from = current ? 'AI-in-progress' : null;

  const runId = newRunId(key, deps.now ? deps.now() : new Date());
  deps.log('info', `${key} manual run started`, { runId });
  const result = await deps.runTicket({ key, runId });
  await handleRunResult(deps, key, from, result, runId);
}

function createApp(deps) {
  const { config, lock } = deps;
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      paused: deps.preflight.isPaused(config.pauseFile),
      lock: lock.read(config.lockPath),
    });
  });

  app.post('/run-agent', (req, res) => {
    if (deps.webhookSecret && req.headers['x-webhook-secret'] !== deps.webhookSecret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const key = req.body && req.body.jira_key;
    if (!key || !JIRA_KEY_RE.test(key)) {
      return res.status(400).json({ error: 'jira_key is required and must match pattern LM-123' });
    }

    if (deps.preflight.isPaused(config.pauseFile)) {
      return res.status(409).json({ error: 'paused' });
    }

    if (!lock.acquire(config.lockPath, lockOwner('http', key))) {
      return res.status(409).json({ error: 'A run is already active', jira_key: key, lock: lock.read(config.lockPath) });
    }

    // Same repo/container pre-flight as the poller. A manual trigger that fails it is
    // refused outright: no Jira comment, no label change.
    const check = runPreflight(deps, deps.state.load());
    if (!check.ok) {
      lock.release(config.lockPath);
      deps.log('warn', `${key} manual trigger refused: ${check.reason}`);
      return res.status(409).json({ error: check.reason });
    }

    res.status(202).json({ status: 'accepted', jira_key: key });

    runManual(deps, key)
      .catch((e) => deps.log('error', `${key} manual run failed: ${e.message}`, { stack: e.stack }))
      .finally(() => lock.release(config.lockPath));
  });

  return app;
}

function log(level, msg, extra) {
  const line = `[${new Date().toISOString()}] ${level.toUpperCase()} ${msg}`;
  const out = level === 'error' || level === 'warn' ? console.error : console.log;
  if (extra === undefined) out(line);
  else out(line, JSON.stringify(extra));
}

function buildDeps(env) {
  const config = loadConfig(env);
  return {
    config,
    jira: createJiraClient({ baseUrl: config.jiraBaseUrl, email: config.jiraEmail, token: config.jiraToken }),
    state: { load: () => loadState(config.statePath), save: (s) => saveState(config.statePath, s) },
    preflight: { isPaused, checkRepos: (repos, set) => checkRepos(repos, set), checkContainers: (repos) => checkContainers(repos) },
    lock: { acquire: acquireRunLock, release: releaseRunLock, read: readRunLock, clearStale: clearStaleLock, exists: (p) => fs.existsSync(p) },
    runTicket: (args) => runTicket(args, { config }),
    now: () => new Date(),
    log,
    webhookSecret: env.WEBHOOK_SECRET,
  };
}

// Poller and HTTP trigger share one process, so at startup no run of ours can be active:
// any run.lock left over (crash, container restart reusing PID 1, empty/corrupt file) is
// released (ruling R13).
function recoverRunLock(deps) {
  const { lock, config } = deps;
  const existing = lock.read(config.lockPath);
  // read() returns null for an empty/unparseable file, so also probe for the file itself.
  const present = existing !== null || (typeof lock.exists === 'function' && lock.exists(config.lockPath));
  if (!present) return false;
  deps.log('warn', 'releasing run lock left over from a previous process', { lock: existing });
  lock.release(config.lockPath);
  return true;
}

module.exports = { createApp, buildDeps, recoverRunLock };

if (require.main === module) {
  const deps = buildDeps(process.env);
  const port = process.env.PORT || 3000;
  const server = createApp(deps).listen(port, () => {
    log('info', `ai-workspace server listening on port ${port}`);
    if (!deps.webhookSecret) log('warn', 'WEBHOOK_SECRET is not set — /run-agent is unprotected');
  });
  recoverRunLock(deps);
  const loop = startPollerLoop(deps);
  const shutdown = () => {
    loop.stop();
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
