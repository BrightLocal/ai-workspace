'use strict';
const fs = require('node:fs');
const path = require('node:path');

function acquireRunLock(lockPath, owner) {
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  let fd;
  try {
    fd = fs.openSync(lockPath, 'wx');
  } catch (e) {
    if (e.code === 'EEXIST') return false;
    throw e;
  }
  try {
    fs.writeSync(fd, JSON.stringify({ owner, pid: process.pid, at: new Date().toISOString() }));
  } finally {
    fs.closeSync(fd);
  }
  return true;
}

function releaseRunLock(lockPath) {
  try { fs.unlinkSync(lockPath); } catch (e) { if (e.code !== 'ENOENT') throw e; }
}

function readRunLock(lockPath) {
  try { return JSON.parse(fs.readFileSync(lockPath, 'utf8')); } catch (_) { return null; }
}

function clearStaleLock(lockPath) {
  const lock = readRunLock(lockPath);
  if (!lock || !Number.isInteger(lock.pid)) return false;
  try {
    process.kill(lock.pid, 0);
    return false;
  } catch (e) {
    if (e.code !== 'ESRCH') return false; // EPERM: alive
  }
  releaseRunLock(lockPath);
  return true;
}

module.exports = { acquireRunLock, releaseRunLock, readRunLock, clearStaleLock };
