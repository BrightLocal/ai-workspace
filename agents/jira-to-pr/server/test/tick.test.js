'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { tick, findHumanReply } = require('../poller/tick');
const { makeDeps, agentBody, humanBody, NEEDS_INPUT_JQL, STALE_JQL } = require('./helpers/fakes');

const POLLER_RUN_ID = 'poller-20261026-101112';
const RUN_ID = '20261026-101112-LM-1';

test('tick does nothing when paused', async () => {
  const f = makeDeps({ paused: true, searches: { MAIN_JQL: [{ key: 'LM-1' }] } });
  const r = await tick(f.deps);
  assert.deepEqual(r, { action: 'paused' });
  assert.equal(f.calls.filter((c) => c[0] !== 'log').length, 0);
});

test('tick picks oldest AI ticket, swaps label, comments, runs, sets AI-done', async () => {
  const f = makeDeps({ searches: { MAIN_JQL: [{ key: 'LM-1' }, { key: 'LM-2' }] } });
  const r = await tick(f.deps);
  assert.equal(r.action, 'started');
  assert.equal(r.key, 'LM-1');
  assert.deepEqual(f.labelCalls(), [
    ['setAiLabel', 'LM-1', 'AI', 'AI-in-progress'],
    ['setAiLabel', 'LM-1', 'AI-in-progress', 'AI-done'],
  ]);
  assert.deepEqual(f.commentCalls(), [['comment', 'LM-1', `picked up (run ${RUN_ID})`, RUN_ID]]);
  assert.equal(f.runCalls.length, 1);
  assert.equal(f.runCalls[0].key, 'LM-1');
  assert.equal(f.runCalls[0].runId, RUN_ID);
  assert.equal(f.runCalls[0].resume, undefined);
  assert.deepEqual(f.runCalls[0].lockDuringRun.owner, 'poller:LM-1');
  assert.equal(f.getLock(), null, 'lock released');
  const t = f.getState().tickets['LM-1'];
  assert.equal(t.sessionId, 'sess-1');
  assert.equal(t.runId, RUN_ID);
  assert.equal(t.lastStatus, 'done');
  assert.deepEqual(t.branches, { Tools: 'task/LM-1' });
  // the label swap happens before the run starts
  const idxLabel = f.calls.findIndex((c) => c[0] === 'setAiLabel');
  const idxRun = f.calls.findIndex((c) => c[0] === 'runTicket');
  const idxComment = f.calls.findIndex((c) => c[0] === 'comment');
  assert.ok(idxLabel < idxComment && idxComment < idxRun);
});

for (const [status, label] of [
  ['draft', 'AI-draft'],
  ['needs_input', 'AI-needs-input'],
  ['failed', 'AI-failed'],
  ['weird', 'AI-failed'],
]) {
  test(`tick maps ${status} result to ${label}`, async () => {
    const f = makeDeps({
      searches: { MAIN_JQL: [{ key: 'LM-1' }] },
      result: { status, questionCommentId: status === 'needs_input' ? '77' : undefined },
    });
    const r = await tick(f.deps);
    assert.equal(r.action, 'started');
    assert.deepEqual(f.labelCalls().at(-1), ['setAiLabel', 'LM-1', 'AI-in-progress', label]);
    const t = f.getState().tickets['LM-1'];
    assert.equal(t.lastStatus, status);
    if (status === 'needs_input') assert.equal(t.questionCommentId, '77');
    const failComments = f.commentCalls().filter((c) => c[2].startsWith('run failed'));
    if (label === 'AI-failed') {
      assert.deepEqual(failComments, [['comment', 'LM-1', `run failed — see workspace/runs/${RUN_ID}`, RUN_ID]]);
    } else {
      assert.equal(failComments.length, 0);
    }
    assert.equal(f.getLock(), null);
  });
}

test('tick skips ticket when label swap fails', async () => {
  const f = makeDeps({ searches: { MAIN_JQL: [{ key: 'LM-1' }] }, labelThrows: true });
  const r = await tick(f.deps);
  assert.equal(r.action, 'skipped');
  assert.equal(r.key, 'LM-1');
  assert.equal(f.runCalls.length, 0);
  assert.equal(f.commentCalls().length, 0);
  assert.equal(f.labelCalls().length, 1);
  assert.equal(f.getLock(), null);
});

test('tick marks AI-failed on dirty repo without running', async () => {
  const f = makeDeps({
    searches: { MAIN_JQL: [{ key: 'LM-1' }] },
    repos: { ok: false, outcome: 'failed', reason: 'uncommitted changes in Tools' },
  });
  const r = await tick(f.deps);
  assert.equal(r.action, 'skipped');
  assert.equal(f.runCalls.length, 0);
  assert.deepEqual(f.commentCalls().at(-1), ['comment', 'LM-1', 'skipped: uncommitted changes in Tools', POLLER_RUN_ID]);
  assert.deepEqual(f.labelCalls().at(-1), ['setAiLabel', 'LM-1', 'AI-in-progress', 'AI-failed']);
  assert.equal(f.getLock(), null);
});

test('tick treats a throwing pre-flight as a failed pre-flight', async () => {
  const f = makeDeps({ searches: { MAIN_JQL: [{ key: 'LM-1' }] }, reposThrow: true });
  const r = await tick(f.deps);
  assert.equal(r.action, 'skipped');
  assert.equal(f.runCalls.length, 0);
  assert.match(f.commentCalls().at(-1)[2], /^skipped: pre-flight error: not a git repo/);
  assert.deepEqual(f.labelCalls().at(-1), ['setAiLabel', 'LM-1', 'AI-in-progress', 'AI-failed']);
  assert.equal(f.getLock(), null);
});

test('tick parks ticket as AI-needs-input when containers are down', async () => {
  const f = makeDeps({
    searches: { MAIN_JQL: [{ key: 'LM-1' }] },
    containers: { ok: false, outcome: 'needs_input', reason: 'containers not running: tools-app-1' },
    state: { tickets: { 'LM-1': { sessionId: 'old-sess', branches: { Tools: 'task/LM-1' } } } },
  });
  const r = await tick(f.deps);
  assert.equal(r.action, 'skipped');
  assert.equal(f.runCalls.length, 0);
  const c = f.commentCalls().at(-1);
  assert.deepEqual(c, ['comment', 'LM-1', 'containers not running: tools-app-1 — please start them and reply here', POLLER_RUN_ID]);
  assert.deepEqual(f.labelCalls().at(-1), ['setAiLabel', 'LM-1', 'AI-in-progress', 'AI-needs-input']);
  const t = f.getState().tickets['LM-1'];
  assert.equal(t.sessionId, undefined, 'no session so the reply starts fresh');
  assert.equal(t.lastStatus, 'needs_input');
  assert.equal(t.questionCommentId, '1001', 'park comment becomes the question');
  assert.equal(f.getLock(), null);
});

function needsInputDeps(extra = {}) {
  return makeDeps({
    searches: { [NEEDS_INPUT_JQL]: [{ key: 'LM-5' }], MAIN_JQL: [{ key: 'LM-9' }] },
    comments: {
      'LM-5': [
        { id: '10', created: '2026-10-26T09:00:00.000+0000', body: humanBody('old human note') },
        { id: '11', created: '2026-10-26T09:10:00.000+0000', body: agentBody('Question: which table?') },
        { id: '12', created: '2026-10-26T09:20:00.000+0000', body: humanBody('first reply') },
        { id: '13', created: '2026-10-26T09:30:00.000+0000', body: humanBody('use table X') },
      ],
    },
    state: { tickets: { 'LM-5': { sessionId: 'sess-5', questionCommentId: '11', branches: { Tools: 'task/LM-5' } } } },
    ...extra,
  });
}

test('tick resumes needs-input ticket on unmarked reply with sessionId', async () => {
  const f = needsInputDeps();
  const r = await tick(f.deps);
  assert.equal(r.action, 'resumed');
  assert.equal(r.key, 'LM-5');
  assert.equal(f.runCalls.length, 1);
  assert.deepEqual(f.runCalls[0].resume, { sessionId: 'sess-5', message: 'use table X' });
  assert.equal(f.runCalls[0].lockDuringRun.owner, 'poller:LM-5');
  assert.deepEqual(f.labelCalls(), [
    ['setAiLabel', 'LM-5', 'AI-needs-input', 'AI-in-progress'],
    ['setAiLabel', 'LM-5', 'AI-in-progress', 'AI-done'],
  ]);
  // pre-flight accepts the ticket's own agent branch
  assert.deepEqual(f.calls.find((c) => c[0] === 'checkRepos')[1], ['task/LM-5']);
  assert.ok(!f.calls.some((c) => c[0] === 'search' && c[1] === 'MAIN_JQL'), 'new work not polled');
  assert.equal(f.getLock(), null);
});

test('tick ignores marked comments as replies', async () => {
  const f = makeDeps({
    searches: { [NEEDS_INPUT_JQL]: [{ key: 'LM-5' }] },
    comments: {
      'LM-5': [
        { id: '10', created: '2026-10-26T09:00:00.000+0000', body: humanBody('before question') },
        { id: '11', created: '2026-10-26T09:10:00.000+0000', body: agentBody('Question?') },
        { id: '12', created: '2026-10-26T09:20:00.000+0000', body: agentBody('follow-up from agent') },
      ],
    },
    state: { tickets: { 'LM-5': { sessionId: 'sess-5', questionCommentId: '11' } } },
  });
  const r = await tick(f.deps);
  assert.equal(r.action, 'idle');
  assert.equal(f.runCalls.length, 0);
  assert.equal(f.labelCalls().length, 0);
});

test('findHumanReply falls back to the last marked comment when no question id', () => {
  const comments = [
    { id: '1', created: '2026-10-26T09:00:00.000+0000', body: agentBody('q1') },
    { id: '2', created: '2026-10-26T09:05:00.000+0000', body: humanBody('reply to q1') },
    { id: '3', created: '2026-10-26T09:10:00.000+0000', body: agentBody('q2') },
  ];
  assert.equal(findHumanReply(comments, undefined), null);
  comments.push({ id: '4', created: '2026-10-26T09:15:00.000+0000', body: humanBody('reply to q2') });
  assert.equal(findHumanReply(comments, undefined).id, '4');
  // unknown question id also falls back
  assert.equal(findHumanReply(comments, '999').id, '4');
  // explicit question id: reply after it
  assert.equal(findHumanReply(comments, '1').id, '4');
  // no marked comment at all → no reply
  assert.equal(findHumanReply([{ id: '9', created: '2026-10-26T09:00:00.000+0000', body: humanBody('x') }], undefined), null);
});

test('tick starts fresh when needs-input ticket has no session', async () => {
  const f = needsInputDeps({
    state: { tickets: { 'LM-5': { questionCommentId: '11' } } },
  });
  const r = await tick(f.deps);
  assert.equal(r.action, 'resumed');
  assert.equal(f.runCalls.length, 1);
  assert.equal(f.runCalls[0].resume, undefined);
  assert.match(f.runCalls[0].runId, /^\d{8}-\d{6}-LM-5$/);
});

test('tick keeps needs-input and re-asks when containers still down on reply', async () => {
  const f = needsInputDeps({
    containers: { ok: false, outcome: 'needs_input', reason: 'containers not running: listing_syncer' },
  });
  const r = await tick(f.deps);
  assert.equal(r.action, 'skipped');
  assert.equal(f.runCalls.length, 0);
  assert.equal(f.labelCalls().length, 0, 'label stays AI-needs-input');
  assert.match(f.commentCalls().at(-1)[2], /containers not running: listing_syncer — please start them and reply here/);
  assert.equal(f.getState().tickets['LM-5'].questionCommentId, '1000', 'new question so the old reply is not reused');
  assert.equal(f.getState().tickets['LM-5'].sessionId, 'sess-5', 'session kept');
});

test('tick fails needs-input ticket when repo pre-flight fails on reply', async () => {
  const f = needsInputDeps({ repos: { ok: false, outcome: 'failed', reason: 'Tools is on feature/x' } });
  const r = await tick(f.deps);
  assert.equal(r.action, 'skipped');
  assert.equal(f.runCalls.length, 0);
  assert.deepEqual(f.labelCalls(), [['setAiLabel', 'LM-5', 'AI-needs-input', 'AI-failed']]);
  assert.equal(f.commentCalls().at(-1)[2], 'skipped: Tools is on feature/x');
});

test('tick flags stale in-progress ticket', async () => {
  const f = makeDeps({
    searches: { [STALE_JQL]: [{ key: 'LM-7' }, { key: 'LM-8' }] },
    lock: { owner: 'http:LM-8', pid: 1, at: 'x' },
  });
  const r = await tick(f.deps);
  assert.equal(r.action, 'busy');
  assert.deepEqual(f.commentCalls(), [['comment', 'LM-7', 'no progress for 3h, marking failed', POLLER_RUN_ID]]);
  assert.deepEqual(f.labelCalls(), [['setAiLabel', 'LM-7', 'AI-in-progress', 'AI-failed']]);
  assert.ok(!f.calls.some((c) => c[0] === 'search' && c[1] !== STALE_JQL), 'busy tick only runs the stale check');
  assert.deepEqual(f.getLock().owner, 'http:LM-8', 'foreign lock untouched');
});

test('tick runs the stale check on idle ticks too', async () => {
  const f = makeDeps({ searches: { [STALE_JQL]: [{ key: 'LM-7' }] } });
  const r = await tick(f.deps);
  assert.equal(r.action, 'idle');
  assert.deepEqual(f.labelCalls(), [['setAiLabel', 'LM-7', 'AI-in-progress', 'AI-failed']]);
});

test('tick survives jira error', async () => {
  const f = makeDeps({ searchThrows: () => true });
  const r = await tick(f.deps);
  assert.equal(r.action, 'error');
  assert.match(r.detail, /boom/);
  assert.equal(f.labelCalls().length, 0);
  assert.equal(f.getLock(), null);
  assert.ok(f.calls.some((c) => c[0] === 'log' && c[1] === 'error'));
});

test('tick releases its lock when an error happens mid-run handling', async () => {
  const f = makeDeps({ searches: { MAIN_JQL: [{ key: 'LM-1' }] }, commentThrows: true });
  const r = await tick(f.deps);
  assert.equal(r.action, 'error');
  assert.equal(f.getLock(), null);
  assert.equal(f.runCalls.length, 0);
});

test('tick does not release a lock it did not acquire', async () => {
  const f = makeDeps({ searches: { MAIN_JQL: [{ key: 'LM-1' }] } });
  f.setLock({ owner: 'http:LM-3', pid: 1, at: 'x' });
  const r = await tick(f.deps);
  assert.equal(r.action, 'busy');
  assert.equal(f.getLock().owner, 'http:LM-3');
  assert.ok(!f.calls.some((c) => c[0] === 'lock.release'));
});

test('handleRunResult saves state before the outcome label swap', async () => {
  const f = makeDeps({ searches: { MAIN_JQL: [{ key: 'LM-1' }] } });
  const orig = f.deps.jira.setAiLabel;
  f.deps.jira.setAiLabel = async (key, from, to) => {
    if (from === 'AI-in-progress') throw new Error('jira 503');
    return orig(key, from, to);
  };
  const r = await tick(f.deps);
  assert.equal(r.action, 'error');
  const t = f.getState().tickets['LM-1'];
  assert.equal(t.sessionId, 'sess-1');
  assert.deepEqual(t.branches, { Tools: 'task/LM-1' });
  assert.equal(t.lastStatus, 'done');
  assert.equal(f.getLock(), null);
});
