'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../index');
const { makeDeps } = require('./helpers/fakes');

async function withServer(app, fn) {
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    return await fn(base);
  } finally {
    await new Promise((r) => server.close(r));
  }
}

function post(base, body, headers = {}) {
  return fetch(`${base}/run-agent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

function deferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}

test('http trigger respects run lock', async () => {
  const f = makeDeps();
  f.setLock({ owner: 'poller:LM-2', pid: 1, at: 'x' });
  await withServer(createApp(f.deps), async (base) => {
    const res = await post(base, { jira_key: 'LM-1' });
    assert.equal(res.status, 409);
    const json = await res.json();
    assert.equal(json.lock.owner, 'poller:LM-2');
  });
  assert.equal(f.runCalls.length, 0);
});

test('http trigger acquires lock, returns 202, runs in background, then releases', async () => {
  const gate = deferred();
  const runStarted = deferred();
  const f = makeDeps({
    searches: { 'key = "LM-1"': [{ key: 'LM-1', labels: ['backend', 'AI'] }] },
    runTicketImpl: async (args) => {
      runStarted.resolve();
      await gate.promise;
      return { status: 'draft', branches: {}, prs: [], sessionId: 's', runDir: `/runs/${args.runId}` };
    },
  });
  await withServer(createApp(f.deps), async (base) => {
    const res = await post(base, { jira_key: 'LM-1' });
    assert.equal(res.status, 202);
    assert.equal(f.getLock().owner, 'http:LM-1');
    await runStarted.promise;
    assert.equal(f.getLock().owner, 'http:LM-1', 'held during the run');
    const again = await post(base, { jira_key: 'LM-1' });
    assert.equal(again.status, 409);
    gate.resolve();
    for (let i = 0; i < 50 && f.getLock(); i++) await new Promise((r) => setTimeout(r, 5));
  });
  assert.equal(f.getLock(), null, 'released after the run');
  assert.deepEqual(f.labelCalls(), [
    ['setAiLabel', 'LM-1', 'AI', 'AI-in-progress'],
    ['setAiLabel', 'LM-1', 'AI-in-progress', 'AI-draft'],
  ]);
  assert.equal(f.getState().tickets['LM-1'].lastStatus, 'draft');
});

test('http trigger on ticket without AI label only adds the outcome label', async () => {
  const f = makeDeps({ searches: { 'key = "LM-1"': [{ key: 'LM-1', labels: [] }] }, result: { status: 'failed' } });
  await withServer(createApp(f.deps), async (base) => {
    const res = await post(base, { jira_key: 'LM-1' });
    assert.equal(res.status, 202);
    for (let i = 0; i < 50 && f.getLock(); i++) await new Promise((r) => setTimeout(r, 5));
  });
  assert.deepEqual(f.labelCalls(), [['setAiLabel', 'LM-1', null, 'AI-failed']]);
  assert.match(f.commentCalls().at(-1)[2], /^run failed — see workspace\/runs\/\d{8}-\d{6}-LM-1$/);
});

test('http trigger releases lock when the background run throws', async () => {
  const f = makeDeps({ searchThrows: () => true });
  await withServer(createApp(f.deps), async (base) => {
    const res = await post(base, { jira_key: 'LM-1' });
    assert.equal(res.status, 202);
    for (let i = 0; i < 50 && f.getLock(); i++) await new Promise((r) => setTimeout(r, 5));
  });
  assert.equal(f.getLock(), null);
  assert.ok(f.calls.some((c) => c[0] === 'log' && c[1] === 'error'));
});

test('http trigger checks secret and key format', async () => {
  const f = makeDeps();
  f.deps.webhookSecret = 's3cret';
  await withServer(createApp(f.deps), async (base) => {
    assert.equal((await post(base, { jira_key: 'LM-1' })).status, 401);
    assert.equal((await post(base, { jira_key: 'LM-1' }, { 'X-Webhook-Secret': 'wrong' })).status, 401);
    assert.equal((await post(base, { jira_key: 'nope' }, { 'X-Webhook-Secret': 's3cret' })).status, 400);
  });
  assert.equal(f.getLock(), null);
});

test('health reports paused and lock', async () => {
  const f = makeDeps({ paused: true });
  f.setLock({ owner: 'poller:LM-4', pid: 7, at: 'x' });
  await withServer(createApp(f.deps), async (base) => {
    const res = await fetch(`${base}/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: 'ok', paused: true, lock: { owner: 'poller:LM-4', pid: 7, at: 'x' } });
  });
});
