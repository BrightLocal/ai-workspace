const BASE = '/api'

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    const err = new Error(body.error || res.statusText)
    err.status = res.status
    err.data = body
    throw err
  }
  return res.json()
}

export const api = {
  health: () => request('/health'),

  agents: {
    list: () => request('/agents'),
    get: (slug) => request(`/agents/${slug}`),
  },

  runs: {
    start: (agentSlug, inputs) =>
      request('/runs', { method: 'POST', body: JSON.stringify({ agentSlug, inputs }) }),
    list: (agentSlug) => request(`/runs/${agentSlug}`),
    get: (agentSlug, runId) => request(`/runs/${agentSlug}/${runId}`),
  },

  setup: {
    checks: () => request('/setup/checks'),
    saveConfig: (data) =>
      request('/setup/config', { method: 'POST', body: JSON.stringify(data) }),
    complete: () => request('/setup/complete', { method: 'POST' }),
    getConfig: () => request('/setup/config'),
    connect: (service) =>
      request(`/setup/connect/${service}`, { method: 'POST' }),
  },
}

export function createWebSocket(runId) {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  return new WebSocket(`${proto}//${location.host}/ws?runId=${runId}`)
}
