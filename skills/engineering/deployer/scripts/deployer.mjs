#!/usr/bin/env node
// Deployer CLI — list / inspect / deploy / release BrightLocal dev environments.
// Zero dependencies: Node >= 22 (global fetch + WebSocket with custom headers).
// Contract: skills/engineering/deployer/SKILL.md ("API contract").
//
//   deployer.mjs whoami
//   deployer.mjs envs   [--repo Tools] [--free] [--json]
//   deployer.mjs status <env> [--repo Tools] [--json]
//   deployer.mjs deploy <env> <branch> [--repo Tools] [--no-busy]
//   deployer.mjs unhold <env> [--repo Tools]
//
// Exit codes: 0 ok · 1 deploy failed · 2 usage / precondition / auth / network error.

import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'https://deployer.bll-i.co.uk';
const WORKSPACE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const CREDENTIALS_FILE = resolve(WORKSPACE_ROOT, 'personal/credentials/deployer.env');
const PROTECTED_ENVS = new Set(['live', 'staging', 'stg01', 'stg02']);
// The only envs this workspace may deploy to or release.
const DEPLOYABLE_ENV = /^dev[1-9]$/;
const DEPLOY_TIMEOUT_MS = 20 * 60 * 1000;

class CliError extends Error {
  constructor(message, code = 2) {
    super(message);
    this.code = code;
  }
}

const log = (msg = '') => process.stdout.write(`${msg}\n`);

function loadSid() {
  if (process.env.DEPLOYER_SID) return process.env.DEPLOYER_SID.trim();
  if (existsSync(CREDENTIALS_FILE)) {
    const line = readFileSync(CREDENTIALS_FILE, 'utf8')
      .split('\n')
      .find((l) => l.trim().startsWith('DEPLOYER_SID='));
    const value = line?.slice(line.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '');
    if (value) return value;
  }
  throw new CliError(
    `DEPLOYER_SID is not set. Put DEPLOYER_SID=<deployer-sid cookie> in ${CREDENTIALS_FILE} ` +
      '(or export it). Never commit or print it.',
  );
}

function parseArgs(argv) {
  const positional = [];
  const flags = { repo: 'Tools', free: false, json: false, busy: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--repo') flags.repo = argv[++i];
    else if (a.startsWith('--repo=')) flags.repo = a.slice('--repo='.length);
    else if (a === '--free') flags.free = true;
    else if (a === '--json') flags.json = true;
    else if (a === '--no-busy') flags.busy = false;
    else if (a.startsWith('--')) throw new CliError(`unknown flag ${a}`);
    else positional.push(a);
  }
  if (!flags.repo) throw new CliError('--repo needs a value');
  return { positional, flags };
}

async function api(sid, method, path, body) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        Cookie: `deployer-sid=${sid}`,
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });
  } catch (e) {
    throw new CliError(`cannot reach Deployer (${e.cause?.code ?? e.name}) — is the VPN up?`);
  }
  if (res.status === 401 || res.status === 403) {
    throw new CliError('Deployer rejected the session — fetch a fresh deployer-sid cookie (or check the VPN).');
  }
  const text = await res.text();
  if (!res.ok) throw new CliError(`${method} ${path} -> HTTP ${res.status}: ${text.slice(0, 300)}`);
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

const isProtected = (name) => PROTECTED_ENVS.has(String(name).toLowerCase());
const isBusy = (env) => Boolean(env.is_busy) && env.is_busy !== '0';
const isFree = (env) => env.state === 'free' && !isBusy(env) && !isProtected(env.env_name);

async function whoami(sid) {
  const me = await api(sid, 'GET', '/api/check_auth');
  if (!me?.name) throw new CliError('Deployer rejected the session — fetch a fresh deployer-sid cookie.');
  return me;
}

async function listEnvs(sid, repo) {
  const data = await api(sid, 'GET', `/api/repo/${encodeURIComponent(repo)}`);
  const envs = data?.Environments;
  if (!Array.isArray(envs)) throw new CliError(`repo "${repo}" not found on Deployer (or unexpected response)`);
  return envs;
}

async function findEnv(sid, repo, envName) {
  const env = (await listEnvs(sid, repo)).find((e) => e.env_name === envName);
  if (!env) throw new CliError(`environment "${envName}" does not exist for ${repo}`);
  return env;
}

async function lastDeploy(sid, repo, envName) {
  const rows = await api(sid, 'GET', `/api/deploys/${encodeURIComponent(`${repo}_${envName}`)}/0/1`);
  return Array.isArray(rows) ? rows[0] ?? null : null;
}

function assertDeployable(envName) {
  if (isProtected(envName)) throw new CliError(`${envName} is a protected environment — never a deploy target.`);
  if (!DEPLOYABLE_ENV.test(envName)) throw new CliError(`${envName} is not one of dev1..dev9 — refusing.`);
}

function printEnvTable(envs) {
  const pad = (s, n) => String(s ?? '-').padEnd(n);
  log(`${pad('env', 12)}${pad('state', 12)}${pad('reserved by', 24)}${pad('autodeploy', 12)}last branch`);
  for (const e of envs) {
    const reserved = isBusy(e) ? e.is_busy_updated_by || 'someone' : '-';
    log(`${pad(e.env_name, 12)}${pad(e.state, 12)}${pad(reserved, 24)}${pad(e.is_autodeploy ? 'on' : 'off', 12)}${e.last_branch ?? '-'}`);
  }
}

async function cmdEnvs(sid, { flags }) {
  let envs = await listEnvs(sid, flags.repo);
  if (flags.free) envs = envs.filter((e) => isFree(e) && DEPLOYABLE_ENV.test(e.env_name));
  envs.sort((a, b) => String(a.env_name).localeCompare(String(b.env_name), undefined, { numeric: true }));
  if (flags.json) return log(JSON.stringify(envs, null, 2));
  log(`[DEPLOYER] ${flags.repo}: ${envs.length} environment(s)${flags.free ? ' free, unreserved, dev1..dev9' : ''}\n`);
  printEnvTable(envs);
}

async function cmdStatus(sid, { positional, flags }) {
  const [envName] = positional;
  if (!envName) throw new CliError('usage: status <env> [--repo Tools]');
  const env = await findEnv(sid, flags.repo, envName);
  const deploy = await lastDeploy(sid, flags.repo, envName);
  if (flags.json) return log(JSON.stringify({ env, lastDeploy: deploy }, null, 2));
  printEnvTable([env]);
  if (deploy) {
    log(`\nlast deploy: ${deploy.status === 1 ? 'OK' : 'FAILED'} · commit ${deploy.commit_hash} · by ${deploy.deploy_user ?? '?'}` +
      (deploy.comment ? ` · ${deploy.comment}` : ''));
  }
  if (env.url) log(`url: ${env.url}`);
}

function streamDeploy(sid, repo, envName, sha) {
  const channel = `${repo}_${envName}`;
  const freeMarker = `${repo}/${envName}->free`;
  const startMarker = `${repo}/${envName}->deploying`;
  return new Promise((resolvePromise, reject) => {
    const ws = new WebSocket(`${BASE.replace(/^http/, 'ws')}/api/ws`, {
      headers: { Cookie: `deployer-sid=${sid}` },
    });
    let started = false;
    let failed = null;
    let lastStep = null;
    const timer = setTimeout(() => {
      ws.close();
      reject(new CliError(`no "->free" after ${DEPLOY_TIMEOUT_MS / 60000} min — check ${BASE}`, 1));
    }, DEPLOY_TIMEOUT_MS);
    const finish = () => {
      clearTimeout(timer);
      ws.close();
      resolvePromise({ failed });
    };

    ws.addEventListener('open', () => {
      ws.send(JSON.stringify({ repo_name: repo, env_name: envName, commit_hash: sha }));
      log(`  deploy started on ${envName}`);
    });
    ws.addEventListener('error', () => {
      clearTimeout(timer);
      reject(new CliError('WebSocket to Deployer failed (VPN? expired cookie?)'));
    });
    ws.addEventListener('close', () => {
      clearTimeout(timer);
      if (!started) reject(new CliError('WebSocket closed before the deploy started'));
      else resolvePromise({ failed: failed ?? 'connection closed before "->free"' });
    });
    ws.addEventListener('message', (ev) => {
      const raw = typeof ev.data === 'string' ? ev.data : Buffer.from(ev.data).toString('utf8');
      if (raw.includes(startMarker)) started = true;
      if (raw.includes(freeMarker) && started) return finish();
      let frame;
      try {
        frame = JSON.parse(raw);
      } catch {
        return;
      }
      if (frame?.channel !== channel) return;
      started = true;
      const m = frame.message ?? {};
      if (m.step && m.step !== lastStep) {
        lastStep = m.step;
        log(`  [${m.step}]`);
      }
      if ((m.status_code && m.status_code !== 0) || m.err) {
        failed ??= `step ${m.step ?? '?'}: ${m.err ?? m.message ?? `status_code ${m.status_code}`}`;
        log(`  ! ${String(m.err ?? m.message ?? '').slice(0, 500)}`);
      }
      if (typeof m.message === 'string' && m.message.includes(freeMarker)) finish();
    });
  });
}

async function cmdDeploy(sid, { positional, flags }) {
  const [envName, branch] = positional;
  if (!envName || !branch) throw new CliError('usage: deploy <env> <branch> [--repo Tools] [--no-busy]');
  assertDeployable(envName);
  const repo = flags.repo;
  const me = await whoami(sid);

  const env = await findEnv(sid, repo, envName);
  if (env.state === 'deploying') throw new CliError(`${envName} is already deploying — wait or pick another env.`);
  const holder = isBusy(env) ? env.is_busy_updated_by : null;
  if (holder && holder !== me.name) {
    throw new CliError(`${envName} is reserved by ${holder} — not deploying over someone else's reservation.`);
  }

  const detail = await api(sid, 'GET', `/api/repo/${encodeURIComponent(repo)}/deploy/${encodeURIComponent(envName)}`);
  const sha = detail?.branches?.find((b) => b.name === branch)?.commit?.sha;
  if (!sha) throw new CliError(`branch "${branch}" does not exist on ${repo} (push it first; use the exact name)`);

  log(`[DEPLOYER] ${repo}/${envName} <- ${branch} @ ${sha.slice(0, 9)}`);
  log(`  replacing: ${env.last_branch ?? '-'} (last deployed by ${env.last_deployer ?? '?'})`);
  if (flags.busy && !holder) {
    await api(sid, 'PUT', `/api/env/set_busy/${env.env_id}`, { username: me.name });
    log(`  reserved for ${me.name}`);
  }
  await api(sid, 'PUT', '/api/env/save_last_branch', { env_id: env.env_id, last_branch: branch });

  const { failed } = await streamDeploy(sid, repo, envName, sha);
  const result = await lastDeploy(sid, repo, envName);
  const shaMatches = result?.commit_hash && (sha.startsWith(result.commit_hash) || result.commit_hash.startsWith(sha));
  if (result) {
    log(`  deploy log: status ${result.status} · commit ${result.commit_hash} · ${result.deploy_user ?? '?'}`);
  }
  if (failed || !shaMatches || result?.status !== 1) {
    throw new CliError(`deploy FAILED${failed ? ` (${failed})` : ''} — full log: ${BASE}`, 1);
  }
  log(`[DEPLOYER] ${envName} now runs ${branch}${env.url ? ` — ${env.url}` : ''}`);
}

async function cmdUnhold(sid, { positional, flags }) {
  const [envName] = positional;
  if (!envName) throw new CliError('usage: unhold <env> [--repo Tools]');
  assertDeployable(envName);
  const me = await whoami(sid);
  const env = await findEnv(sid, flags.repo, envName);
  if (!isBusy(env)) return log(`[DEPLOYER] ${envName} is not reserved — nothing to release.`);
  if (env.is_busy_updated_by && env.is_busy_updated_by !== me.name) {
    throw new CliError(`${envName} is reserved by ${env.is_busy_updated_by} — not releasing someone else's hold.`);
  }
  await api(sid, 'PUT', `/api/env/set_unbusy/${env.env_id}`, { username: me.name });
  log(`[DEPLOYER] ${envName} released (still running ${env.last_branch ?? 'its current branch'}).`);
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  const commands = {
    whoami: async (sid) => log(`[DEPLOYER] authenticated as ${(await whoami(sid)).name}`),
    envs: cmdEnvs,
    status: cmdStatus,
    deploy: cmdDeploy,
    unhold: cmdUnhold,
  };
  if (!commands[command]) throw new CliError('usage: deployer.mjs <whoami|envs|status|deploy|unhold> … (see header)');
  await commands[command](loadSid(), args);
}

main().catch((e) => {
  process.stderr.write(`[DEPLOYER] ${e.message}\n`);
  process.exit(e instanceof CliError ? e.code : 2);
});
