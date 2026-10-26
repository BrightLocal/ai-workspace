'use strict';
const express = require('express');
const { loadConfig } = require('./poller/config');
const { createJiraClient } = require('./poller/jira');
const { loadState, saveState } = require('./poller/state');
const { isPaused, checkRepos, checkContainers } = require('./poller/preflight');
const { acquireRunLock, releaseRunLock, readRunLock, clearStaleLock } = require('./poller/runlock');
const { runTicket, newRunId } = require('./poller/dispatcher');
const { handleRunResult, lockOwner, AI_LABELS } = require('./poller/tick');
const { startPollerLoop } = require('./poller/loop');

// Jira key format: 1-6 uppercase letters, dash, 1-6 digits
const JIRA_KEY_RE = /^[A-Z]{1,6}-[0-9]{1,6}$/;

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
      return res.status(400).json({ error: 'jira_key is required and must match pattern PROJECT-123' });
    }

    if (!lock.acquire(config.lockPath, lockOwner('http', key))) {
      return res.status(409).json({ error: 'A run is already active', jira_key: key, lock: lock.read(config.lockPath) });
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
    lock: { acquire: acquireRunLock, release: releaseRunLock, read: readRunLock, clearStale: clearStaleLock },
    runTicket: (args) => runTicket(args, { config }),
    now: () => new Date(),
    log,
    webhookSecret: env.WEBHOOK_SECRET,
  };
}

module.exports = { createApp, buildDeps };

if (require.main === module) {
  const deps = buildDeps(process.env);
  const port = process.env.PORT || 3000;
  const server = createApp(deps).listen(port, () => {
    log('info', `ai-workspace server listening on port ${port}`);
    if (!deps.webhookSecret) log('warn', 'WEBHOOK_SECRET is not set — /run-agent is unprotected');
  });
  const loop = startPollerLoop(deps);
  const shutdown = () => {
    loop.stop();
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
