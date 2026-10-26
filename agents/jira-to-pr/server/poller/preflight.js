'use strict';
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

function execGit(repoPath, args) {
  return execFileSync('git', ['-C', repoPath, ...args], { encoding: 'utf8' });
}

function execDocker(args) {
  return execFileSync('docker', args, { encoding: 'utf8' });
}

function isPaused(pauseFile) {
  return fs.existsSync(pauseFile);
}

function checkRepos(repos, agentBranchSet, run = execGit) {
  for (const repo of repos) {
    if (run(repo.path, ['status', '--porcelain']).trim() !== '') {
      return { ok: false, outcome: 'failed', reason: `uncommitted changes in ${repo.name}` };
    }
    const branch = run(repo.path, ['rev-parse', '--abbrev-ref', 'HEAD']).trim();
    if (branch !== 'master' && !agentBranchSet.has(branch)) {
      return { ok: false, outcome: 'failed', reason: `${repo.name} is on ${branch}` };
    }
  }
  return { ok: true };
}

function checkContainers(repos, run = execDocker) {
  const running = new Set(run(['ps', '--format', '{{.Names}}']).split('\n').map((s) => s.trim()).filter(Boolean));
  const missing = repos.filter((r) => !running.has(r.container)).map((r) => r.container);
  if (missing.length === 0) return { ok: true };
  return { ok: false, outcome: 'needs_input', reason: `containers not running: ${missing.join(', ')}` };
}

module.exports = { isPaused, checkRepos, checkContainers, execGit, execDocker };
