'use strict';
const fs = require('node:fs');
const path = require('node:path');

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error(`File missing: ${file}`);
      err.code = 'ENOENT_LOCK';
      throw err;
    }
    throw e;
  }
}

function compareLock(repoPath) {
  const lock = readJson(path.join(repoPath, 'composer.lock'));
  const installedRaw = readJson(path.join(repoPath, 'vendor/composer/installed.json'));
  const installedList = Array.isArray(installedRaw) ? installedRaw : installedRaw.packages || [];
  const installed = new Map(installedList.map((p) => [p.name, p.version]));
  const locked = [...(lock.packages || []), ...(lock['packages-dev'] || [])];
  const mismatches = [];
  for (const p of locked) {
    const have = installed.has(p.name) ? installed.get(p.name) : null;
    if (have !== p.version) mismatches.push({ name: p.name, locked: p.version, installed: have });
  }
  return mismatches.length === 0 ? { ok: true } : { ok: false, mismatches };
}

module.exports = { compareLock };

if (require.main === module) {
  const repoPath = process.argv[2];
  if (!repoPath) {
    console.error('Usage: node poller/lockcheck.js <repoPath>');
    process.exit(2);
  }
  try {
    const result = compareLock(repoPath);
    if (result.ok) {
      console.log('composer.lock matches installed vendor/');
      process.exit(0);
    }
    for (const m of result.mismatches) {
      console.log(`${m.name}: locked ${m.locked}, installed ${m.installed === null ? 'MISSING' : m.installed}`);
    }
    process.exit(3);
  } catch (e) {
    if (e.code === 'ENOENT_LOCK') {
      console.error(e.message);
      process.exit(2);
    }
    throw e;
  }
}
