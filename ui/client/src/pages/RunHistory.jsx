import React, { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import LiveOutput from '../components/LiveOutput.jsx'

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function formatDuration(startIso, endIso) {
  if (!startIso || !endIso) return null
  const ms = new Date(endIso) - new Date(startIso)
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

function StatusBadge({ status }) {
  const map = { success: 'badge-success', failed: 'badge-error', running: 'badge-running' }
  return <span className={`badge ${map[status] || 'badge-neutral'}`}>{status}</span>
}

function RunRow({ run, isSelected, onClick }) {
  return (
    <div
      className={`run-row ${isSelected ? 'run-row-selected' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      <div className="run-row-main">
        <StatusBadge status={run.status} />
        <span className="run-date">{formatDate(run.startedAt)}</span>
        {formatDuration(run.startedAt, run.finishedAt) && (
          <span className="run-duration">{formatDuration(run.startedAt, run.finishedAt)}</span>
        )}
      </div>
      <div className="run-row-inputs">
        {Object.entries(run.inputs || {})
          .filter(([, v]) => v && typeof v !== 'boolean')
          .slice(0, 2)
          .map(([k, v]) => (
            <span key={k} className="run-input-chip">
              {String(v).slice(0, 40)}
            </span>
          ))}
      </div>
    </div>
  )
}

export default function RunHistory() {
  const { slug, runId } = useParams()
  const navigate = useNavigate()
  const [agentName, setAgentName] = useState(slug)
  const [runs, setRuns] = useState([])
  const [selectedRun, setSelectedRun] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.agents.get(slug).then((a) => setAgentName(a.name)).catch(() => {})
    api.runs.list(slug)
      .then((list) => {
        setRuns(list)
        // Auto-select run from URL or most recent
        const target = runId || list[0]?.runId
        if (target) loadRun(target)
      })
      .finally(() => setLoading(false))
  }, [slug])

  useEffect(() => {
    if (runId) loadRun(runId)
  }, [runId])

  async function loadRun(id) {
    try {
      const run = await api.runs.get(slug, id)
      setSelectedRun(run)
      navigate(`/agents/${slug}/runs/${id}`, { replace: true })
    } catch {}
  }

  if (loading) return <div className="loading">Loading history...</div>

  return (
    <div className="page">
      <div className="page-header">
        <div className="breadcrumb">
          <Link to="/" className="breadcrumb-link">Agents</Link>
          <span className="breadcrumb-sep">›</span>
          <Link to={`/agents/${slug}`} className="breadcrumb-link">{agentName}</Link>
          <span className="breadcrumb-sep">›</span>
          <span>History</span>
        </div>
        <div className="page-header-row">
          <h1 className="page-title">Run history</h1>
          <Link to={`/agents/${slug}`} className="btn btn-primary">
            New run
          </Link>
        </div>
      </div>

      {runs.length === 0 ? (
        <div className="empty-state">
          <p>No runs yet. <Link to={`/agents/${slug}`}>Run the agent</Link> to see history here.</p>
        </div>
      ) : (
        <div className="history-layout">
          <div className="history-list">
            {runs.map((run) => (
              <RunRow
                key={run.runId}
                run={run}
                isSelected={selectedRun?.runId === run.runId}
                onClick={() => loadRun(run.runId)}
              />
            ))}
          </div>
          <div className="history-detail">
            {selectedRun ? (
              <>
                <div className="history-detail-header">
                  <StatusBadge status={selectedRun.status} />
                  <span className="run-date">{formatDate(selectedRun.startedAt)}</span>
                  {formatDuration(selectedRun.startedAt, selectedRun.finishedAt) && (
                    <span className="run-duration">
                      {formatDuration(selectedRun.startedAt, selectedRun.finishedAt)}
                    </span>
                  )}
                </div>
                {selectedRun.inputs && (
                  <div className="history-inputs">
                    {Object.entries(selectedRun.inputs)
                      .filter(([, v]) => v)
                      .map(([k, v]) => (
                        <div key={k} className="history-input-row">
                          <span className="history-input-key">{k}</span>
                          <span className="history-input-val">
                            {typeof v === 'boolean' ? (v ? 'yes' : 'no') : String(v).slice(0, 200)}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
                <LiveOutput
                  runId={selectedRun.runId}
                  initialLines={selectedRun.outputLines || []}
                  status={selectedRun.status}
                />
              </>
            ) : (
              <div className="empty-state">Select a run to view its output.</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
