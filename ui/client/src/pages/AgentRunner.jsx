import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { api } from '../api.js'
import LiveOutput from '../components/LiveOutput.jsx'

function Field({ field, value, onChange }) {
  if (field.type === 'textarea') {
    return (
      <div className="field">
        <label className="field-label" htmlFor={field.name}>
          {field.label}
          {field.required && <span className="required">*</span>}
        </label>
        <textarea
          id={field.name}
          className="field-textarea"
          placeholder={field.placeholder}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          rows={8}
          required={field.required}
        />
        {field.hint && <p className="field-hint">{field.hint}</p>}
      </div>
    )
  }

  if (field.type === 'checkbox') {
    return (
      <div className="field field-checkbox">
        <label className="checkbox-label">
          <input
            type="checkbox"
            id={field.name}
            checked={value || false}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span>{field.label}</span>
        </label>
        {field.hint && <p className="field-hint">{field.hint}</p>}
      </div>
    )
  }

  return (
    <div className="field">
      <label className="field-label" htmlFor={field.name}>
        {field.label}
        {field.required && <span className="required">*</span>}
      </label>
      <input
        id={field.name}
        type="text"
        className="field-input"
        placeholder={field.placeholder}
        value={value ?? (field.defaultValue || '')}
        onChange={(e) => onChange(e.target.value)}
        required={field.required}
      />
      {field.hint && <p className="field-hint">{field.hint}</p>}
      {field.examples && (
        <div className="field-examples">
          {field.examples.map((group) => (
            <div key={group.group} className="field-examples-group">
              <span className="field-examples-label">{group.group}:</span>
              {group.items.map((item) => (
                <button
                  key={item}
                  type="button"
                  className="example-chip"
                  onClick={() => onChange(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AgentRunner() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [agent, setAgent] = useState(null)
  const [inputs, setInputs] = useState({})
  const [runId, setRunId] = useState(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    api.agents.get(slug).then((a) => {
      setAgent(a)
      if (a.activeRunId) {
        setRunId(a.activeRunId)
        setRunning(true)
      }
    }).catch(() => navigate('/'))
  }, [slug])

  function setInput(name, value) {
    setInputs((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    setRunning(true)

    try {
      const { runId: newRunId } = await api.runs.start(slug, inputs)
      setRunId(newRunId)
    } catch (err) {
      if (err.status === 409) {
        setRunId(err.data.runId)
        setError('Agent is already running — attaching to live output.')
      } else {
        setRunning(false)
        setError(err.message || 'Failed to start run')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (!agent) return <div className="loading">Loading...</div>

  return (
    <div className="page">
      <div className="page-header">
        <div className="breadcrumb">
          <Link to="/" className="breadcrumb-link">Agents</Link>
          <span className="breadcrumb-sep">›</span>
          <span>{agent.name}</span>
        </div>
        <div className="page-header-row">
          <div>
            <h1 className="page-title">{agent.name}</h1>
            <p className="page-subtitle">{agent.longDescription}</p>
          </div>
          <Link to={`/agents/${slug}/runs`} className="btn btn-ghost">
            View history
          </Link>
        </div>
      </div>

      <div className="runner-layout">
        <div className="runner-form-col">
          <div className="card">
            <h2 className="card-title">Run configuration</h2>
            <form onSubmit={handleSubmit}>
              {agent.inputFields.map((field) => (
                <Field
                  key={field.name}
                  field={field}
                  value={inputs[field.name]}
                  onChange={(val) => setInput(field.name, val)}
                />
              ))}

              {error && <p className="form-error">{error}</p>}

              <button
                type="submit"
                className="btn btn-primary"
                disabled={running || submitting}
              >
                {running ? 'Running…' : submitting ? 'Starting…' : 'Run agent'}
              </button>
            </form>
          </div>

          {agent.requiresAtlassian && (
            <div className="info-box">
              Requires Atlassian MCP — authorize once in Setup if you haven't.
            </div>
          )}
          {agent.requiresGoogle && (
            <div className="info-box">
              Requires Google OAuth — authorize once in Setup if you haven't.
            </div>
          )}
        </div>

        <div className="runner-output-col">
          {runId ? (
            <LiveOutput
              runId={runId}
              initialStatus={running ? 'running' : undefined}
              onFinished={() => setRunning(false)}
            />
          ) : (
            <div className="output-placeholder">
              <p>Output will appear here when the agent runs.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
