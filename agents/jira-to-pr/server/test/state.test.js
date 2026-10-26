'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadState, saveState, getTicket, setTicket, agentBranches } = require('../poller/state');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'state-'));

test('loadState returns empty on missing file', () => {
  assert.deepEqual(loadState(path.join(tmp(), 'state.json')), { tickets: {} });
});

test('loadState tolerates corrupt json', () => {
  const p = path.join(tmp(), 'state.json');
  fs.writeFileSync(p, '{nope');
  assert.deepEqual(loadState(p), { tickets: {} });
});

test('saveState round-trips and creates parent dir', () => {
  const p = path.join(tmp(), 'sub', 'state.json');
  const s = setTicket({ tickets: {} }, 'LM-1', { sessionId: 'abc' });
  saveState(p, s);
  assert.deepEqual(loadState(p), s);
  assert.equal(fs.existsSync(p + '.tmp'), false);
});

test('setTicket merges, stamps updatedAt, does not mutate', () => {
  const s0 = { tickets: {} };
  const s1 = setTicket(s0, 'LM-1', { sessionId: 'a' });
  const s2 = setTicket(s1, 'LM-1', { runId: 'r' });
  assert.deepEqual(s0, { tickets: {} });
  assert.equal(getTicket(s2, 'LM-1').sessionId, 'a');
  assert.equal(getTicket(s2, 'LM-1').runId, 'r');
  assert.ok(!Number.isNaN(Date.parse(getTicket(s2, 'LM-1').updatedAt)));
  assert.equal(getTicket(s2, 'LM-2'), undefined);
});

test('agentBranches collects branches', () => {
  let s = setTicket({ tickets: {} }, 'LM-1', { branches: { Tools: 'a', LS: 'b' } });
  s = setTicket(s, 'LM-2', { branches: { Tools: 'c' } });
  s = setTicket(s, 'LM-3', { sessionId: 'x' });
  assert.deepEqual(agentBranches(s), new Set(['a', 'b', 'c']));
});
