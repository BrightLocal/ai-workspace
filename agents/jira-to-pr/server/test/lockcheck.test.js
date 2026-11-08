'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { compareLock } = require('../poller/lockcheck');

function repo({ lock, installed }) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'lc-'));
  if (lock) fs.writeFileSync(path.join(d, 'composer.lock'), JSON.stringify(lock));
  if (installed) {
    fs.mkdirSync(path.join(d, 'vendor/composer'), { recursive: true });
    fs.writeFileSync(path.join(d, 'vendor/composer/installed.json'), JSON.stringify(installed));
  }
  return d;
}
const lock = { packages: [{ name: 'a/a', version: '1.0.0' }], 'packages-dev': [{ name: 'b/b', version: '2.0.0' }] };

test('compareLock ok when equal (extras ignored)', () => {
  const d = repo({ lock, installed: { packages: [
    { name: 'a/a', version: '1.0.0' }, { name: 'b/b', version: '2.0.0' }, { name: 'x/x', version: '9' }] } });
  assert.deepEqual(compareLock(d), { ok: true });
});

test('compareLock detects version mismatch and missing package', () => {
  const d = repo({ lock, installed: { packages: [{ name: 'a/a', version: '1.1.0' }] } });
  assert.deepEqual(compareLock(d), { ok: false, mismatches: [
    { name: 'a/a', locked: '1.0.0', installed: '1.1.0' },
    { name: 'b/b', locked: '2.0.0', installed: null },
  ] });
});

test('compareLock handles v1 installed.json array', () => {
  const d = repo({ lock, installed: [{ name: 'a/a', version: '1.0.0' }, { name: 'b/b', version: '2.0.0' }] });
  assert.deepEqual(compareLock(d), { ok: true });
});

test('compareLock throws ENOENT_LOCK on missing files', () => {
  for (const d of [repo({ installed: { packages: [] } }), repo({ lock })]) {
    assert.throws(() => compareLock(d), (e) => e.code === 'ENOENT_LOCK');
  }
});
