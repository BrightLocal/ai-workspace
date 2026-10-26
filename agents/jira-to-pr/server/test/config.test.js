'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadConfig } = require('../poller/config');

const ROOT = '/tmp/ws-root';
const base = { JIRA_EMAIL: 'a@b.c', JIRA_API_TOKEN: 'tok', GH_TOKEN: 'gh', WORKSPACE_ROOT: ROOT };

test('loadConfig applies defaults', () => {
  const c = loadConfig(base);
  assert.equal(c.targetEnv, 'local');
  assert.equal(c.envFile, `${ROOT}/agents/jira-to-pr/config/environments/local.md`);
  assert.equal(c.jiraBaseUrl, 'https://brightlocal.atlassian.net');
  assert.equal(c.jiraEmail, 'a@b.c');
  assert.equal(c.jiraToken, 'tok');
  assert.equal(c.jql, 'project = LM AND sprint in openSprints() AND labels = AI AND status != Done ORDER BY created ASC');
  assert.equal(c.pollIntervalMs, 300000);
  assert.equal(c.runTimeoutMs, 5400000);
  assert.equal(c.staleMs, 10800000);
  assert.equal(c.maxTurns, null);
  assert.equal(c.workspaceRoot, ROOT);
  assert.equal(c.pauseFile, `${ROOT}/personal/ai-poller.paused`);
  assert.equal(c.statePath, `${ROOT}/agents/jira-to-pr/workspace/state.json`);
  assert.equal(c.lockPath, `${ROOT}/agents/jira-to-pr/workspace/run.lock`);
  assert.equal(c.runsDir, `${ROOT}/agents/jira-to-pr/workspace/runs`);
  assert.deepEqual(c.repos, [
    { name: 'Tools', path: `${ROOT}/products/Tools/codebase/Tools`, container: 'tools-app-1' },
    { name: 'ListingSyncer', path: `${ROOT}/products/ListingSyncer/codebase/ListingSyncer`, container: 'listing_syncer' },
  ]);
  assert.ok(Object.isFrozen(c));
});

test('loadConfig defaults workspace root to repo root', () => {
  const { WORKSPACE_ROOT, ...env } = base;
  assert.equal(loadConfig(env).workspaceRoot, path.resolve(__dirname, '../../../..'));
});

test('loadConfig honours overrides', () => {
  const c = loadConfig({
    ...base, POLL_INTERVAL_SEC: '60', RUN_TIMEOUT_MIN: '10', JIRA_JQL: 'project = X',
    MAX_TURNS: '40', TARGET_ENV: 'dev2', JIRA_BASE_URL: 'https://x.example',
  });
  assert.equal(c.pollIntervalMs, 60000);
  assert.equal(c.runTimeoutMs, 600000);
  assert.equal(c.jql, 'project = X');
  assert.equal(c.maxTurns, 40);
  assert.equal(c.targetEnv, 'dev2');
  assert.equal(c.envFile, `${ROOT}/agents/jira-to-pr/config/environments/dev2.md`);
  assert.equal(c.jiraBaseUrl, 'https://x.example');
});

test('loadConfig treats empty optional values as unset', () => {
  const c = loadConfig({ ...base, MAX_TURNS: '', JIRA_JQL: '', POLL_INTERVAL_SEC: '' });
  assert.equal(c.maxTurns, null);
  assert.equal(c.pollIntervalMs, 300000);
  assert.match(c.jql, /^project = LM/);
});

for (const name of ['JIRA_EMAIL', 'JIRA_API_TOKEN', 'GH_TOKEN']) {
  test(`loadConfig throws on missing ${name}`, () => {
    const env = { ...base };
    delete env[name];
    assert.throws(() => loadConfig(env), new Error(`Missing required env: ${name}`));
  });
}
