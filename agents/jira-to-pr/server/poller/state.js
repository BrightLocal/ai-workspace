'use strict';
const fs = require('node:fs');
const path = require('node:path');

function loadState(file) {
  try {
    const s = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (s && typeof s === 'object' && s.tickets && typeof s.tickets === 'object') return s;
  } catch (_) { /* missing or corrupt */ }
  return { tickets: {} };
}

function saveState(file, state) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, file);
}

function getTicket(state, key) {
  return state.tickets[key];
}

function setTicket(state, key, patch) {
  return {
    ...state,
    tickets: {
      ...state.tickets,
      [key]: { ...state.tickets[key], ...patch, updatedAt: new Date().toISOString() },
    },
  };
}

function agentBranches(state) {
  const out = new Set();
  for (const t of Object.values(state.tickets)) {
    for (const b of Object.values(t.branches || {})) out.add(b);
  }
  return out;
}

module.exports = { loadState, saveState, getTicket, setTicket, agentBranches };
