import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api.js'

function AgentCard({ agent, onClick }) {
  const isRunning = !!agent.activeRunId

  return (
    <div className="card agent-card" onClick={onClick} role="button" tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}>
      <div className="agent-card-header">
        <div>
          <h2 className="agent-name">{agent.name}</h2>
          {isRunning && <span className="badge badge-running">Running</span>}
        </div>
        <div className="agent-badges">
          {agent.requiresAtlassian && <span className="badge badge-dep">Atlassian</span>}
          {agent.requiresGoogle && <span className="badge badge-dep">Google</span>}
        </div>
      </div>
      <p className="agent-description">{agent.description}</p>
      <div className="agent-card-footer">
        <span className="agent-action">Run agent →</span>
      </div>
    </div>
  )
}

export default function AgentCatalog() {
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    api.agents.list().then(setAgents).finally(() => setLoading(false))
    const interval = setInterval(() => {
      api.agents.list().then(setAgents).catch(() => {})
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  if (loading) return <div className="loading">Loading agents...</div>

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Agents</h1>
        <p className="page-subtitle">
          Select an agent to run it. Each agent is an autonomous AI pipeline.
        </p>
      </div>
      <div className="agent-grid">
        {agents.map((agent) => (
          <AgentCard
            key={agent.slug}
            agent={agent}
            onClick={() => navigate(`/agents/${agent.slug}`)}
          />
        ))}
      </div>
    </div>
  )
}
