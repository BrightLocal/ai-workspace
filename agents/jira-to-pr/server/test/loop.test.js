'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { startPollerLoop } = require('../poller/loop');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test('loop ticks immediately, repeats, never overlaps, survives errors, stops', async () => {
  let active = 0;
  let maxActive = 0;
  let count = 0;
  const logs = [];
  const deps = { config: { pollIntervalMs: 2 }, log: (l, m) => logs.push([l, m]) };
  const tickImpl = async () => {
    count++;
    active++;
    maxActive = Math.max(maxActive, active);
    await wait(10);
    active--;
    if (count === 2) throw new Error('tick blew up');
    return { action: 'idle' };
  };
  const loop = startPollerLoop(deps, { tickImpl });
  assert.equal(count, 1, 'first tick starts synchronously');
  await wait(80);
  loop.stop();
  const atStop = count;
  await wait(40);
  assert.ok(atStop >= 3, `ticked ${atStop} times`);
  assert.ok(count <= atStop + 1, 'no new ticks after stop (an in-flight one may finish)');
  assert.equal(maxActive, 1);
  assert.ok(logs.some(([l]) => l === 'error'));
});
