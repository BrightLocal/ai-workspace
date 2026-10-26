'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { runTicket, newRunId } = require('../poller/dispatcher');

const FAKE = path.join(__dirname, 'fixtures/fake-run-agent.sh');
const REAL = path.join(__dirname, '../../scripts/run-agent.sh');

function mkConfig(extra = {}) {
  const runsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'disp-'));
  return { runsDir, runTimeoutMs: 10000, maxTurns: null, targetEnv: 'local', ...extra };
}

test('newRunId formats timestamp and key', () => {
  assert.match(newRunId('LM-1'), /^\d{8}-\d{6}-LM-1$/);
});

test('runTicket returns parsed result and session id', async () => {
  const config = mkConfig();
  process.env.FAKE_MODE = 'write';
  process.env.FAKE_RESULT = JSON.stringify({
    status: 'needs_input', summary: 's', prs: [{ repo: 'Tools', url: 'u', draft: false }],
    branches: { Tools: 'b' }, question_comment_id: '42', session_id: 'sess-9',
  });
  const r = await runTicket({ key: 'LM-1', runId: 'r1' }, { config, script: FAKE, killGraceMs: 50 });
  assert.equal(r.status, 'needs_input');
  assert.equal(r.questionCommentId, '42');
  assert.equal(r.sessionId, 'sess-9');
  assert.equal(r.prs.length, 1);
  assert.deepEqual(r.branches, { Tools: 'b' });
  assert.equal(r.exitCode, 0);
  assert.equal(r.timedOut, false);
  assert.equal(r.runDir, path.join(config.runsDir, 'r1'));
});

test('missing arrays default', async () => {
  const config = mkConfig();
  process.env.FAKE_MODE = 'write';
  process.env.FAKE_RESULT = '{"status":"done","summary":"x"}';
  const r = await runTicket({ key: 'LM-1', runId: 'r2' }, { config, script: FAKE, killGraceMs: 50 });
  assert.deepEqual(r.prs, []);
  assert.deepEqual(r.branches, {});
});

test('missing result.json maps to failed', async () => {
  const config = mkConfig();
  process.env.FAKE_MODE = 'none';
  const r = await runTicket({ key: 'LM-1', runId: 'r3' }, { config, script: FAKE, killGraceMs: 50 });
  assert.equal(r.status, 'failed');
  assert.equal(r.timedOut, false);
});

test('unparseable result.json maps to failed', async () => {
  const config = mkConfig();
  process.env.FAKE_MODE = 'write';
  process.env.FAKE_RESULT = '{nope';
  const r = await runTicket({ key: 'LM-1', runId: 'r4' }, { config, script: FAKE, killGraceMs: 50 });
  assert.equal(r.status, 'failed');
});

test('timeout kills the run and maps to failed', async () => {
  const config = mkConfig({ runTimeoutMs: 200 });
  process.env.FAKE_MODE = 'sleep';
  const t = Date.now();
  const r = await runTicket({ key: 'LM-1', runId: 'r5' }, { config, script: FAKE, killGraceMs: 50 });
  assert.equal(r.timedOut, true);
  assert.equal(r.status, 'failed');
  assert.ok(Date.now() - t < 4000);
});

test('resume passes --resume and --message args', async () => {
  const config = mkConfig();
  process.env.FAKE_MODE = 'write';
  process.env.FAKE_ECHO_ARGS = '1';
  const r = await runTicket(
    { key: 'LM-1', runId: 'r6', resume: { sessionId: 'sid', message: 'hello' } },
    { config, script: FAKE, killGraceMs: 50 });
  delete process.env.FAKE_ECHO_ARGS;
  assert.match(r.summary, /LM-1 r6 --resume sid --message hello/);
});

function runReal(args) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ra-'));
  const bin = path.join(tmp, 'bin');
  fs.mkdirSync(bin);
  const runs = path.join(tmp, 'runs');
  fs.mkdirSync(runs);
  const fake = path.join(bin, 'claude');
  fs.writeFileSync(fake, `#!/usr/bin/env bash
jq -n '$ARGS.positional' --args -- "$@" > "$RUNS_DIR/argv.json"
mkdir -p "$RUNS_DIR/rid"
echo '{"status":"done","summary":"x"}' > "$RUNS_DIR/rid/result.json"
echo '{"session_id":"sess-123","result":"ok"}'
`);
  fs.chmodSync(fake, 0o755);
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, RUNS_DIR: runs, WORKSPACE_ROOT: tmp, TARGET_ENV: 'local' };
  const p = spawnSync(REAL, args, { env, encoding: 'utf8' });
  const argv = JSON.parse(fs.readFileSync(path.join(runs, 'argv.json'), 'utf8'));
  return { p, tmp, runs, argv };
}

test('run-agent.sh merges session_id into result.json', () => {
  const { p, runs } = runReal(['LM-7', 'rid']);
  assert.equal(p.status, 0, p.stderr);
  const res = JSON.parse(fs.readFileSync(path.join(runs, 'rid/result.json'), 'utf8'));
  assert.equal(res.session_id, 'sess-123');
  assert.equal(res.status, 'done');
});

test('run-agent.sh puts the prompt right after -p and keeps add-dir paths', () => {
  const { p, tmp, runs, argv } = runReal(['LM-7', 'rid']);
  assert.equal(p.status, 0, p.stderr);
  const rootDir = path.resolve(__dirname, '../..');
  const envFile = path.join(rootDir, 'config/environments/local.md');
  assert.equal(argv[0], '-p');
  assert.equal(argv[1], `Execute the full workflow for Jira task LM-7. Run id: rid. Target environment: ${envFile}. Follow the phase sequence from CLAUDE.md. Write result.json to ${path.join(runs, 'rid')} as specified in CLAUDE.md.`);
  const dirs = argv.map((a, i) => (a === '--add-dir' ? argv[i + 1] : null)).filter(Boolean);
  assert.deepEqual(dirs, [
    path.join(tmp, 'products/Tools/codebase/Tools'),
    path.join(tmp, 'products/ListingSyncer/codebase/ListingSyncer'),
  ]);
  assert.ok(!argv.includes('--resume'));
});

test('run-agent.sh resume keeps a hostile message verbatim in one prompt arg', () => {
  const msg = 'say "hi" and \'bye\'\nline2 $(echo pwned)';
  const { p, argv } = runReal(['LM-7', 'rid', '--resume', 'old-sess', '--message', msg]);
  assert.equal(p.status, 0, p.stderr);
  assert.equal(argv[0], '-p');
  assert.ok(argv[1].includes(`Vadym replied on LM-7: ${msg}.`));
  assert.ok(!argv[1].includes('pwned\n') && argv[1].includes('$(echo pwned)'));
  assert.equal(argv[argv.indexOf('--resume') + 1], 'old-sess');
});
