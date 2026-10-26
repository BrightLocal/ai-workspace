'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createApp, recoverRunLock } = require('../index');
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
  assert.match(f.commentCalls().at(-1)[2], /^run failed — see workspace\/runs\/\d{8}-\d{6}-LM-1\. Check `git status` in the repos and any applied migrations before retrying\.$/);
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
    assert.equal((await post(base, { jira_key: 'CE-1' }, { 'X-Webhook-Secret': 's3cret' })).status, 400, 'only LM keys');
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

for (const [name, opts, reason] of [
  ['dirty repo', { repos: { ok: false, outcome: 'failed', reason: 'uncommitted changes in Tools' } }, 'uncommitted changes in Tools'],
  ['containers down', { containers: { ok: false, outcome: 'needs_input', reason: 'containers not running: tools-app-1' } }, 'containers not running: tools-app-1'],
  ['pre-flight throws', { reposThrow: true }, 'pre-flight error: not a git repo'],
]) {
  test(`http trigger refuses on ${name} without touching Jira`, async () => {
    const f = makeDeps(opts);
    await withServer(createApp(f.deps), async (base) => {
      const res = await post(base, { jira_key: 'LM-1' });
      assert.equal(res.status, 409);
      assert.deepEqual(await res.json(), { error: reason });
    });
    assert.equal(f.getLock(), null, 'lock released');
    assert.equal(f.runCalls.length, 0);
    assert.equal(f.labelCalls().length, 0);
    assert.equal(f.commentCalls().length, 0);
  });
}

test('http trigger refuses when paused', async () => {
  const f = makeDeps({ paused: true });
  await withServer(createApp(f.deps), async (base) => {
    const res = await post(base, { jira_key: 'LM-1' });
    assert.equal(res.status, 409);
    assert.deepEqual(await res.json(), { error: 'paused' });
  });
  assert.equal(f.getLock(), null);
  assert.equal(f.runCalls.length, 0);
});

test('recoverRunLock releases a pre-existing lock and logs it', () => {
  const f = makeDeps();
  f.setLock({ owner: 'poller:LM-3', pid: 1, at: 'x' });
  assert.equal(recoverRunLock(f.deps), true);
  assert.equal(f.getLock(), null);
  const warn = f.calls.find((c) => c[0] === 'log' && c[1] === 'warn');
  assert.ok(warn, 'warn logged');
  assert.deepEqual(warn[3], { lock: { owner: 'poller:LM-3', pid: 1, at: 'x' } });
});

test('recoverRunLock is a no-op without a lock', () => {
  const f = makeDeps();
  assert.equal(recoverRunLock(f.deps), false);
  assert.ok(!f.calls.some((c) => c[0] === 'lock.release'));
});

test('recoverRunLock releases an empty/unparseable lock file', () => {
  const f = makeDeps();
  let exists = true;
  f.deps.lock.exists = () => exists;
  const origRelease = f.deps.lock.release;
  f.deps.lock.release = (p) => { exists = false; origRelease(p); };
  assert.equal(f.getLock(), null, 'read() sees nothing parseable');
  assert.equal(recoverRunLock(f.deps), true);
  assert.equal(exists, false);
  const warn = f.calls.find((c) => c[0] === 'log' && c[1] === 'warn');
  assert.deepEqual(warn[3], { lock: null });
});
