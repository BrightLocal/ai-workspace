'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { acquireRunLock, releaseRunLock, readRunLock, clearStaleLock } = require('../poller/runlock');

const lockPath = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'lock-')), 'sub', 'run.lock');

test('acquireRunLock is exclusive', () => {
  const p = lockPath();
  assert.equal(acquireRunLock(p, 'poller:LM-1'), true);
  assert.equal(acquireRunLock(p, 'http:LM-2'), false);
  const l = readRunLock(p);
  assert.equal(l.owner, 'poller:LM-1');
  assert.equal(l.pid, process.pid);
  assert.ok(l.at);
});

test('releaseRunLock frees lock', () => {
  const p = lockPath();
  acquireRunLock(p, 'a:K-1');
  releaseRunLock(p);
  assert.equal(readRunLock(p), null);
  assert.equal(acquireRunLock(p, 'a:K-2'), true);
  releaseRunLock(p);
  releaseRunLock(p); // no throw when missing
});

test('readRunLock returns null for missing or unparseable', () => {
  const p = lockPath();
  assert.equal(readRunLock(p), null);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, '{bad');
  assert.equal(readRunLock(p), null);
});

test('clearStaleLock removes lock of dead pid', () => {
  const p = lockPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify({ owner: 'x:K-1', pid: 999999, at: 'now' }));
  assert.equal(clearStaleLock(p), true);
  assert.equal(fs.existsSync(p), false);
});

test('clearStaleLock keeps lock of live pid', () => {
  const p = lockPath();
  acquireRunLock(p, 'x:K-1');
  assert.equal(clearStaleLock(p), false);
  assert.ok(readRunLock(p));
  assert.equal(clearStaleLock(path.join(path.dirname(p), 'none')), false);
});
