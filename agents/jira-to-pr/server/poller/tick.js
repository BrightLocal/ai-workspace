'use strict';
// One deterministic poller tick. Claude writes comments; the poller owns labels.
// All side effects go through `deps` so the whole flow is testable with in-memory fakes.
const { isAgentComment, adfToText } = require('./marker');
const { getTicket, setTicket, agentBranches } = require('./state');
const { newRunId } = require('./dispatcher');

const NEEDS_INPUT_JQL = 'project = LM AND labels = "AI-needs-input"';
const STALE_JQL = 'project = LM AND labels = "AI-in-progress" AND updated < "-3h"';

const STATUS_LABELS = Object.freeze({
  done: 'AI-done',
  draft: 'AI-draft',
  needs_input: 'AI-needs-input',
  failed: 'AI-failed',
});

const AI_LABELS = Object.freeze(['AI', 'AI-in-progress', 'AI-needs-input', 'AI-done', 'AI-draft', 'AI-failed']);

function labelForStatus(status) {
  return Object.prototype.hasOwnProperty.call(STATUS_LABELS, status) ? STATUS_LABELS[status] : 'AI-failed';
}

function pad(n) { return String(n).padStart(2, '0'); }

// Run id for comments the poller posts without a Claude run (ruling R2).
function pollerRunId(now) {
  return `poller-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function lockOwner(source, key) {
  return `${source}:${key}`;
}

function nowOf(deps) {
  return deps.now ? deps.now() : new Date();
}

function ts(created) {
  const t = Date.parse(created);
  return Number.isNaN(t) ? null : t;
}

// All unmarked comments created after the question comment (by id), or — if that id is
// unknown or missing — after the last marked comment, oldest first (ruling R12: Vadym may
// answer in several comments). Comments are oldest-first. No marked comment at all → no
// replies (we never treat pre-agent discussion as an answer).
function findHumanReplies(comments, questionCommentId) {
  let threshold = null;
  if (questionCommentId != null) {
    const q = comments.find((c) => String(c.id) === String(questionCommentId));
    if (q) threshold = ts(q.created);
  }
  if (threshold === null) {
    for (const c of comments) if (isAgentComment(c.body)) threshold = ts(c.created);
  }
  if (threshold === null) return [];
  return comments
    .filter((c) => {
      const t = ts(c.created);
      return t !== null && t > threshold && !isAgentComment(c.body);
    })
    .sort((a, b) => ts(a.created) - ts(b.created));
}

// Newest human reply (or null) — kept for callers that only need "is there a reply?".
function findHumanReply(comments, questionCommentId) {
  const replies = findHumanReplies(comments, questionCommentId);
  return replies.length ? replies[replies.length - 1] : null;
}

// Resume message: every reply after the question, oldest first, blank line between.
function replyMessage(replies) {
  return replies.map((c) => adfToText(c.body)).join('\n\n');
}

// Pre-flight never throws: a throwing check (non-git path, docker missing) is a failed repo check.
function runPreflight(deps, state) {
  const { config, preflight } = deps;
  try {
    const repos = preflight.checkRepos(config.repos, agentBranches(state));
    if (!repos.ok) return repos;
    return preflight.checkContainers(config.repos);
  } catch (e) {
    return { ok: false, outcome: 'failed', reason: `pre-flight error: ${e.message}` };
  }
}

function saveTicket(deps, key, patch) {
  const next = setTicket(deps.state.load(), key, patch);
  deps.state.save(next);
  return next;
}

function failureComment(deps, result, runId) {
  const ms = deps.config && deps.config.runTimeoutMs;
  const head = result.timedOut
    ? `run timed out${ms ? ` after ${Math.round(ms / 60000)} min` : ''}`
    : 'run failed';
  return `${head} — see workspace/runs/${runId}. Check \`git status\` in the repos and any applied migrations before retrying.`;
}

// Shared post-run handling for the poller and the HTTP trigger (ruling R4):
// label from the status map, state save, failure comment.
async function handleRunResult(deps, key, fromLabel, result, runId) {
  let label = labelForStatus(result.status);
  // A run that claims done but opened a Draft PR is a draft (spec: Draft PR → AI-draft).
  if (result.status === 'done' && Array.isArray(result.prs) && result.prs.some((p) => p && p.draft === true)) {
    deps.log('warn', `${key} reported done but has a draft PR — labelling AI-draft`, { runId });
    label = 'AI-draft';
  }
  // State first: a Jira error on the label swap must not lose the session/branches,
  // or later pre-flights would reject the agent branch the repo is left on.
  const prev = getTicket(deps.state.load(), key) || {};
  saveTicket(deps, key, {
    sessionId: result.sessionId || prev.sessionId,
    runId,
    branches: { ...(prev.branches || {}), ...(result.branches || {}) },
    // Not carried over: a stale question id would make an old reply look new.
    questionCommentId: result.questionCommentId,
    lastStatus: result.status,
  });
  await deps.jira.setAiLabel(key, fromLabel, label);
  if (label === 'AI-failed') {
    await deps.jira.comment(key, failureComment(deps, result, runId), runId);
  }
  deps.log('info', `${key} finished: ${result.status} → ${label}`, { runId, summary: result.summary });
  return label;
}

// Comment + label for a failed pre-flight. `currentLabel` is the ticket's AI* label right now.
async function handlePreflightFailure(deps, key, currentLabel, check) {
  const pid = pollerRunId(nowOf(deps));
  if (check.outcome === 'needs_input') {
    const { id } = await deps.jira.comment(key, `${check.reason} — please start them and reply here`, pid);
    if (currentLabel !== 'AI-needs-input') await deps.jira.setAiLabel(key, currentLabel, 'AI-needs-input');
    // The park comment becomes the question, so only a reply posted after it resumes.
    saveTicket(deps, key, { questionCommentId: id, lastStatus: 'needs_input' });
  } else {
    await deps.jira.comment(key, `skipped: ${check.reason}`, pid);
    await deps.jira.setAiLabel(key, currentLabel, 'AI-failed');
    saveTicket(deps, key, { lastStatus: 'failed' });
  }
  deps.log('warn', `${key} pre-flight failed: ${check.reason}`);
  return { action: 'skipped', key, detail: check.reason };
}

async function staleCheck(deps) {
  const { jira, lock, config } = deps;
  const issues = await jira.search(STALE_JQL);
  for (const { key } of issues) {
    const owner = lock.read(config.lockPath)?.owner;
    if (typeof owner === 'string' && owner.endsWith(':' + key)) continue;
    await jira.comment(key, 'no progress for 3h, marking failed', pollerRunId(nowOf(deps)));
    await jira.setAiLabel(key, 'AI-in-progress', 'AI-failed');
    deps.log('warn', `${key} stale in AI-in-progress, marked AI-failed`);
  }
}

function acquire(deps, ctx, key) {
  if (!deps.lock.acquire(deps.config.lockPath, lockOwner('poller', key))) return false;
  ctx.held = true;
  return true;
}

function release(deps, ctx) {
  if (!ctx.held) return;
  ctx.held = false;
  deps.lock.release(deps.config.lockPath);
}

async function resumeStep(deps, ctx, state) {
  const issues = await deps.jira.search(NEEDS_INPUT_JQL);
  for (const { key } of issues) {
    const ticket = getTicket(state, key) || {};
    const replies = findHumanReplies(await deps.jira.getComments(key), ticket.questionCommentId);
    if (replies.length === 0) continue;

    const check = runPreflight(deps, state);
    if (!check.ok) return handlePreflightFailure(deps, key, 'AI-needs-input', check);

    if (!acquire(deps, ctx, key)) return { action: 'busy', key };
    try {
      await deps.jira.setAiLabel(key, 'AI-needs-input', 'AI-in-progress');
      const runId = newRunId(key, nowOf(deps));
      const resume = ticket.sessionId ? { sessionId: ticket.sessionId, message: replyMessage(replies) } : undefined;
      deps.log('info', `${key} ${resume ? 'resuming session' : 'starting fresh after reply'}`, { runId });
      const result = await deps.runTicket(resume ? { key, runId, resume } : { key, runId });
      await handleRunResult(deps, key, 'AI-in-progress', result, runId);
      return { action: 'resumed', key, detail: result.status };
    } finally {
      release(deps, ctx);
    }
  }
  return null;
}

async function newWorkStep(deps, ctx, state) {
  const issues = await deps.jira.search(deps.config.jql);
  if (issues.length === 0) return { action: 'idle' };
  const { key } = issues[0];

  // Run lock first, so a racing HTTP trigger cannot leave a picked-up ticket without a run.
  if (!acquire(deps, ctx, key)) return { action: 'busy', key };
  try {
    try {
      await deps.jira.setAiLabel(key, 'AI', 'AI-in-progress');
    } catch (e) {
      deps.log('warn', `${key} label swap failed, skipping this tick: ${e.message}`);
      return { action: 'skipped', key, detail: `label swap failed: ${e.message}` };
    }
    const runId = newRunId(key, nowOf(deps));
    await deps.jira.comment(key, `picked up (run ${runId})`, runId);

    const check = runPreflight(deps, state);
    if (!check.ok) {
      if (check.outcome === 'needs_input') saveTicket(deps, key, { sessionId: undefined });
      return await handlePreflightFailure(deps, key, 'AI-in-progress', check);
    }

    deps.log('info', `${key} starting run`, { runId });
    const result = await deps.runTicket({ key, runId });
    await handleRunResult(deps, key, 'AI-in-progress', result, runId);
    return { action: 'started', key, detail: result.status };
  } finally {
    release(deps, ctx);
  }
}

async function tick(deps) {
  const { config, preflight, lock } = deps;
  if (preflight.isPaused(config.pauseFile)) return { action: 'paused' };

  const ctx = { held: false };
  try {
    lock.clearStale(config.lockPath);
    if (lock.read(config.lockPath)) {
      await staleCheck(deps);
      return { action: 'busy' };
    }
    const state = deps.state.load();
    const report = (await resumeStep(deps, ctx, state)) || (await newWorkStep(deps, ctx, state));
    await staleCheck(deps);
    return report;
  } catch (e) {
    deps.log('error', `tick failed: ${e.message}`, { stack: e.stack });
    release(deps, ctx);
    return { action: 'error', detail: e.message };
  }
}

module.exports = {
  tick,
  handleRunResult,
  runPreflight,
  findHumanReply,
  findHumanReplies,
  replyMessage,
  failureComment,
  labelForStatus,
  pollerRunId,
  lockOwner,
  STATUS_LABELS,
  AI_LABELS,
  NEEDS_INPUT_JQL,
  STALE_JQL,
};
