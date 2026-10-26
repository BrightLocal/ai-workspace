'use strict';
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_SCRIPT = path.resolve(__dirname, '../../scripts/run-agent.sh');

function pad(n) { return String(n).padStart(2, '0'); }

function newRunId(key, now = new Date()) {
  const d = now;
  const ts = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `${ts}-${key}`;
}

function readResult(runDir) {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(runDir, 'result.json'), 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function killGroup(child, signal) {
  try { process.kill(-child.pid, signal); } catch { /* already gone */ }
}

function runTicket({ key, runId, resume }, { config, script = DEFAULT_SCRIPT, spawnImpl = spawn, killGraceMs = 10000 }) {
  const runDir = path.resolve(config.runsDir, runId);
  const args = [key, runId];
  if (resume) args.push('--resume', resume.sessionId, '--message', resume.message);
  const env = {
    ...process.env,
    MAX_TURNS: config.maxTurns == null ? '' : String(config.maxTurns),
    TARGET_ENV: config.targetEnv,
    RUNS_DIR: config.runsDir,
  };

  return new Promise((resolve) => {
    let timedOut = false;
    let settled = false;
    let killTimer;
    const child = spawnImpl(script, args, { env, detached: true, stdio: 'ignore' });

    const timer = setTimeout(() => {
      timedOut = true;
      killGroup(child, 'SIGTERM');
      killTimer = setTimeout(() => killGroup(child, 'SIGKILL'), killGraceMs);
    }, config.runTimeoutMs);

    const finish = (exitCode) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(killTimer);
      const raw = readResult(runDir);
      const failed = timedOut || !raw || typeof raw.status !== 'string';
      resolve({
        status: failed ? 'failed' : raw.status,
        summary: raw && raw.summary ? raw.summary : (timedOut ? 'Run timed out' : 'No valid result.json'),
        prs: raw && Array.isArray(raw.prs) ? raw.prs : [],
        branches: raw && raw.branches && typeof raw.branches === 'object' ? raw.branches : {},
        questionCommentId: raw && raw.question_comment_id != null ? String(raw.question_comment_id) : undefined,
        sessionId: raw ? raw.session_id : undefined,
        runDir,
        exitCode: exitCode === undefined ? null : exitCode,
        timedOut,
      });
    };

    child.on('error', () => finish(null));
    child.on('close', (code) => finish(code));
  });
}

module.exports = { runTicket, newRunId };
