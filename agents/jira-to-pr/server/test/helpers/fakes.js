'use strict';
// In-memory fakes for every tick/app dependency. No fs, no network, no processes.
const { markText, textToAdf } = require('../../poller/marker');

const NEEDS_INPUT_JQL = 'project = LM AND labels = "AI-needs-input"';
const STALE_JQL = 'project = LM AND labels = "AI-in-progress" AND updated < "-3h"';

function agentBody(text, runId = 'r0') {
  return textToAdf(markText(text, runId));
}

function humanBody(text) {
  return textToAdf(text);
}

function makeDeps(opts = {}) {
  const calls = [];
  const searches = { ...(opts.searches || {}) };
  const comments = { ...(opts.comments || {}) };
  let nextCommentId = 1000;
  let lockState = opts.lock || null;
  let stateStore = opts.state || { tickets: {} };

  const config = {
    jql: 'MAIN_JQL',
    lockPath: '/fake/run.lock',
    pauseFile: '/fake/paused',
    pollIntervalMs: 5,
    repos: [{ name: 'Tools', path: '/t', container: 'tools-app-1' }],
    ...(opts.config || {}),
  };

  const jira = {
    async search(jql) {
      calls.push(['search', jql]);
      if (opts.searchThrows && opts.searchThrows(jql)) throw new Error(`boom on ${jql}`);
      return searches[jql] || [];
    },
    async setAiLabel(key, from, to) {
      calls.push(['setAiLabel', key, from, to]);
      if (opts.labelThrows) throw new Error('label update failed');
    },
    async comment(key, text, runId) {
      calls.push(['comment', key, text, runId]);
      if (opts.commentThrows) throw new Error('comment failed');
      return { id: String(nextCommentId++) };
    },
    async getComments(key) {
      calls.push(['getComments', key]);
      return comments[key] || [];
    },
  };

  const runCalls = [];
  const deps = {
    config,
    jira,
    state: {
      load: () => JSON.parse(JSON.stringify(stateStore)),
      save: (s) => { calls.push(['saveState']); stateStore = JSON.parse(JSON.stringify(s)); },
    },
    preflight: {
      isPaused: () => !!opts.paused,
      checkRepos: (repos, set) => {
        calls.push(['checkRepos', [...set]]);
        if (opts.reposThrow) throw new Error('not a git repo');
        return opts.repos || { ok: true };
      },
      checkContainers: () => {
        calls.push(['checkContainers']);
        return opts.containers || { ok: true };
      },
    },
    lock: {
      acquire: (p, owner) => {
        calls.push(['lock.acquire', owner]);
        if (lockState) return false;
        lockState = { owner, pid: 1, at: 'now' };
        return true;
      },
      release: () => { calls.push(['lock.release']); lockState = null; },
      read: () => lockState,
      clearStale: () => false,
    },
    async runTicket(args) {
      runCalls.push(args);
      calls.push(['runTicket', args.key]);
      const lockDuringRun = lockState;
      runCalls[runCalls.length - 1].lockDuringRun = lockDuringRun;
      if (opts.runTicketImpl) return opts.runTicketImpl(args);
      return {
        status: 'done', summary: 'ok', prs: [], branches: { Tools: `task/${args.key}` },
        questionCommentId: undefined, sessionId: 'sess-1', runDir: `/runs/${args.runId}`,
        exitCode: 0, timedOut: false, ...(opts.result || {}),
      };
    },
    now: () => new Date(2026, 9, 26, 10, 11, 12),
    log: (level, msg, extra) => calls.push(['log', level, msg, extra]),
  };

  return {
    deps,
    calls,
    runCalls,
    labelCalls: () => calls.filter((c) => c[0] === 'setAiLabel'),
    commentCalls: () => calls.filter((c) => c[0] === 'comment'),
    getState: () => stateStore,
    getLock: () => lockState,
    setLock: (l) => { lockState = l; },
  };
}

module.exports = { makeDeps, agentBody, humanBody, NEEDS_INPUT_JQL, STALE_JQL };
