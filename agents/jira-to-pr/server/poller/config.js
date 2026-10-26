'use strict';
const path = require('node:path');

const DEFAULT_JQL =
  'project = LM AND sprint in openSprints() AND labels = AI AND status != Done ORDER BY created ASC';

function required(env, name) {
  const v = env[name];
  if (v === undefined || v === '') throw new Error(`Missing required env: ${name}`);
  return v;
}

function optional(env, name) {
  const v = env[name];
  return v === undefined || v === '' ? undefined : v;
}

function toNumber(env, name, fallback) {
  const v = optional(env, name);
  if (v === undefined) return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`Invalid numeric env: ${name}`);
  return n;
}

function loadConfig(env) {
  const jiraEmail = required(env, 'JIRA_EMAIL');
  const jiraToken = required(env, 'JIRA_API_TOKEN');
  required(env, 'GH_TOKEN');

  const root = optional(env, 'WORKSPACE_ROOT') || path.resolve(__dirname, '../../../..');
  const targetEnv = optional(env, 'TARGET_ENV') || 'local';
  const workspaceDir = path.join(root, 'agents/jira-to-pr/workspace');
  const maxTurns = toNumber(env, 'MAX_TURNS', null);

  return Object.freeze({
    targetEnv,
    envFile: path.join(root, 'agents/jira-to-pr/config/environments', `${targetEnv}.md`),
    jiraBaseUrl: optional(env, 'JIRA_BASE_URL') || 'https://brightlocal.atlassian.net',
    jiraEmail,
    jiraToken,
    jql: optional(env, 'JIRA_JQL') || DEFAULT_JQL,
    pollIntervalMs: toNumber(env, 'POLL_INTERVAL_SEC', 300) * 1000,
    runTimeoutMs: toNumber(env, 'RUN_TIMEOUT_MIN', 90) * 60 * 1000,
    staleMs: 3 * 60 * 60 * 1000,
    maxTurns: maxTurns === null ? null : Math.trunc(maxTurns),
    workspaceRoot: root,
    pauseFile: path.join(root, 'personal/ai-poller.paused'),
    statePath: path.join(workspaceDir, 'state.json'),
    lockPath: path.join(workspaceDir, 'run.lock'),
    runsDir: path.join(workspaceDir, 'runs'),
    repos: Object.freeze([
      Object.freeze({ name: 'Tools', path: path.join(root, 'products/Tools/codebase/Tools'), container: 'tools-app-1' }),
      Object.freeze({ name: 'ListingSyncer', path: path.join(root, 'products/ListingSyncer/codebase/ListingSyncer'), container: 'listing_syncer' }),
    ]),
  });
}

module.exports = { loadConfig, DEFAULT_JQL };
