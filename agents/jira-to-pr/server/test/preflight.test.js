'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { isPaused, checkRepos, checkContainers } = require('../poller/preflight');

const repos = [
  { name: 'Tools', path: '/r/Tools', container: 'tools-app-1' },
  { name: 'ListingSyncer', path: '/r/LS', container: 'listing_syncer' },
];

function fakeGit(map) {
  return (repoPath, args) => {
    const key = args[0] === 'status' ? 'status' : 'branch';
    const v = map[repoPath] && map[repoPath][key];
    return v === undefined ? (key === 'status' ? '' : 'master\n') : v;
  };
}

test('checkRepos fails on dirty tree', () => {
  const run = fakeGit({ '/r/Tools': { status: ' M a.php\n' } });
  assert.deepEqual(checkRepos(repos, new Set(), run), {
    ok: false, outcome: 'failed', reason: 'uncommitted changes in Tools',
  });
});

test('checkRepos fails when on a human branch', () => {
  const run = fakeGit({ '/r/Tools': { branch: 'task/LM-4507-x\n' } });
  assert.deepEqual(checkRepos(repos, new Set(), run), {
    ok: false, outcome: 'failed', reason: 'Tools is on task/LM-4507-x',
  });
});

test('checkRepos treats detached HEAD as not free', () => {
  const run = fakeGit({ '/r/Tools': { branch: 'HEAD\n' } });
  assert.equal(checkRepos(repos, new Set(), run).reason, 'Tools is on HEAD');
});

test('checkRepos passes on master and on agent branch', () => {
  assert.deepEqual(checkRepos(repos, new Set(), fakeGit({})), { ok: true });
  const run = fakeGit({ '/r/LS': { branch: 'task/LM-1-agent\n' } });
  assert.deepEqual(checkRepos(repos, new Set(['task/LM-1-agent']), run), { ok: true });
});

test('checkRepos returns first failure in config order, dirty before branch', () => {
  const run = fakeGit({
    '/r/Tools': { status: 'x', branch: 'human' },
    '/r/LS': { status: 'x' },
  });
  assert.equal(checkRepos(repos, new Set(), run).reason, 'uncommitted changes in Tools');
});

test('checkContainers reports missing containers', () => {
  assert.deepEqual(checkContainers(repos, () => 'tools-app-1\nother\n'), {
    ok: false, outcome: 'needs_input', reason: 'containers not running: listing_syncer',
  });
  assert.equal(checkContainers(repos, () => '').reason,
    'containers not running: tools-app-1, listing_syncer');
  assert.deepEqual(checkContainers(repos, () => 'listing_syncer\ntools-app-1\n'), { ok: true });
});

test('isPaused reflects pause file', () => {
  const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pf-')), 'paused');
  assert.equal(isPaused(p), false);
  fs.writeFileSync(p, '');
  assert.equal(isPaused(p), true);
});
