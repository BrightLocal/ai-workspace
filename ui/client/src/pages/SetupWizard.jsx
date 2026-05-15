import React, { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, createWebSocket } from '../api.js'
import StepCheck from '../components/StepCheck.jsx'

const SKIPPABLE = new Set(['atlassian', 'google'])

// Regex to find OAuth/auth URLs in claude output
const AUTH_URL_RE = /https?:\/\/\S*(oauth|auth|authorize|login|accounts\.google|atlassian\.com\/login|atlassian\.net\/login|id\.atlassian)\S*/gi

function extractAuthUrls(lines) {
  const urls = []
  for (const line of lines) {
    const matches = line.match(AUTH_URL_RE) || []
    for (const url of matches) {
      const clean = url.replace(/[.,)'"]+$/, '')
      if (!urls.includes(clean)) urls.push(clean)
    }
  }
  return urls
}

function ConnectPanel({ service, onConnected }) {
  const [phase, setPhase] = useState('idle') // idle | connecting | waiting_auth | connected | failed
  const [lines, setLines] = useState([])
  const [authUrls, setAuthUrls] = useState([])
  const wsRef = useRef(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines])

  async function connect() {
    setPhase('connecting')
    setLines([])
    setAuthUrls([])

    let connectId
    try {
      const data = await api.setup.connect(service)
      connectId = data.connectId
    } catch (err) {
      setLines([`Error: ${err.message}`])
      setPhase('failed')
      return
    }

    const ws = createWebSocket(connectId)
    wsRef.current = ws

    ws.onmessage = (event) => {
      try {
        const frame = JSON.parse(event.data)
        if (frame.type === 'output') {
          setLines((prev) => {
            const next = [...prev, frame.line]
            const found = extractAuthUrls(next)
            if (found.length > 0) {
              setAuthUrls(found)
              setPhase('waiting_auth')
            }
            return next
          })
        } else if (frame.type === 'done') {
          setPhase((p) => p === 'waiting_auth' ? 'waiting_auth' : 'connected')
          ws.close()
          if (phase !== 'waiting_auth') onConnected?.()
        } else if (frame.type === 'error') {
          setPhase((p) => p === 'waiting_auth' ? 'waiting_auth' : 'failed')
          ws.close()
        }
      } catch {}
    }

    ws.onerror = () => {
      setPhase('failed')
    }
  }

  function recheckConnection() {
    connect()
    setAuthUrls([])
  }

  const labels = { atlassian: 'Atlassian', google: 'Google' }
  const label = labels[service] || service

  return (
    <div className="connect-panel">
      {phase === 'idle' && (
        <button className="btn btn-connect" onClick={connect}>
          Connect {label}
        </button>
      )}

      {(phase === 'connecting' || phase === 'waiting_auth' || phase === 'failed') && (
        <>
          {lines.length > 0 && (
            <div className="connect-output">
              <pre className="connect-log">
                {lines.map((l, i) => <span key={i} className="output-line">{l}{'\n'}</span>)}
                <span ref={bottomRef} />
              </pre>
            </div>
          )}

          {phase === 'connecting' && lines.length === 0 && (
            <p className="connect-status-text">
              <span className="pulse-dot" style={{ display: 'inline-block', marginRight: 8 }} />
              Connecting to {label}...
            </p>
          )}

          {authUrls.length > 0 && (
            <div className="auth-url-box">
              <p className="auth-url-label">Authorization required. Open this link in your browser:</p>
              {authUrls.map((url) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-auth-url"
                >
                  Open {label} authorization page ↗
                </a>
              ))}
              <p className="auth-url-hint">
                After authorizing, come back here and click the button below.
              </p>
              <button className="btn btn-connect" onClick={recheckConnection}>
                Check connection
              </button>
            </div>
          )}

          {phase === 'failed' && authUrls.length === 0 && (
            <div className="connect-failed">
              <p className="connect-status-text" style={{ color: 'var(--red)' }}>
                Connection failed. Check that Claude Code is logged in and try again.
              </p>
              <button className="btn btn-connect" onClick={connect}>
                Retry
              </button>
            </div>
          )}
        </>
      )}

      {phase === 'connected' && (
        <div className="connect-success">
          <span className="step-icon step-pass" style={{ display: 'inline-flex', marginRight: 8 }}>✓</span>
          <span>Connected to {label}</span>
        </div>
      )}
    </div>
  )
}

export default function SetupWizard({ onComplete }) {
  const navigate = useNavigate()
  const [checks, setChecks] = useState([])
  const [config, setConfig] = useState({})
  const [setupComplete, setSetupComplete] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeProduct, setActiveProduct] = useState('')
  const [skipped, setSkipped] = useState(new Set())
  const [saving, setSaving] = useState(false)
  const [connectedServices, setConnectedServices] = useState(new Set())
  const pollRef = useRef(null)

  async function loadChecks() {
    try {
      const data = await api.setup.checks()
      setChecks(data.checks)
      setConfig(data.config)
      setSetupComplete(data.setupComplete)
      if (data.config.activeProduct) setActiveProduct(data.config.activeProduct)
    } catch {}
  }

  useEffect(() => {
    loadChecks().finally(() => setLoading(false))
    pollRef.current = setInterval(loadChecks, 4000)
    return () => clearInterval(pollRef.current)
  }, [])

  function skip(id) {
    setSkipped((prev) => new Set([...prev, id]))
  }

  function markConnected(service) {
    setConnectedServices((prev) => new Set([...prev, service]))
  }

  function canComplete() {
    return checks.every((c) => {
      if (c.id === 'active_product') return !!activeProduct
      if (c.optional || skipped.has(c.id) || connectedServices.has(c.id)) return true
      return c.status === 'pass' || c.status === 'info'
    })
  }

  async function handleComplete() {
    if (!canComplete()) return
    setSaving(true)
    try {
      if (activeProduct) await api.setup.saveConfig({ activeProduct })
      await api.setup.complete()
      setSetupComplete(true)
      onComplete?.()
      navigate('/')
    } catch (e) {
      alert('Setup failed: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="loading">Running checks...</div>

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Setup</h1>
        <p className="page-subtitle">
          {setupComplete
            ? 'Setup is complete. You can re-run checks anytime from here.'
            : 'Complete these steps before using the agents.'}
        </p>
      </div>

      <div className="setup-layout">
        <div className="card setup-card">
          {checks.map((check) => {
            if (check.id === 'active_product') {
              return (
                <StepCheck
                  key={check.id}
                  check={{ ...check, status: activeProduct ? 'pass' : 'info' }}
                >
                  <div className="step-select-wrapper">
                    <label className="field-label" htmlFor="active_product">
                      Active product
                    </label>
                    <select
                      id="active_product"
                      className="field-input"
                      value={activeProduct}
                      onChange={(e) => setActiveProduct(e.target.value)}
                    >
                      <option value="">— select —</option>
                      {(check.products || []).map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                </StepCheck>
              )
            }

            const isConnected = connectedServices.has(check.id)
            const isSkipped = skipped.has(check.id)

            // For MCP services: show Connect button instead of static instructions
            if (check.id === 'atlassian' || check.id === 'google') {
              const overrideStatus = isConnected ? 'pass'
                : isSkipped ? 'pass'
                : check.status

              const overrideDetail = isConnected
                ? `Connected to ${check.id === 'atlassian' ? 'Atlassian' : 'Google'}`
                : isSkipped ? 'Skipped'
                : check.detail

              return (
                <StepCheck
                  key={check.id}
                  check={{ ...check, status: overrideStatus, detail: overrideDetail }}
                  onSkip={!isConnected ? () => skip(check.id) : undefined}
                >
                  {!isConnected && !isSkipped && (
                    <div className="step-connect-wrapper">
                      <ConnectPanel
                        service={check.id}
                        onConnected={() => markConnected(check.id)}
                      />
                    </div>
                  )}
                </StepCheck>
              )
            }

            return (
              <StepCheck
                key={check.id}
                check={isSkipped ? { ...check, status: 'pass', detail: 'Skipped' } : check}
                onSkip={SKIPPABLE.has(check.id) ? () => skip(check.id) : undefined}
              />
            )
          })}

          <div className="setup-footer">
            <button
              className="btn btn-primary"
              onClick={handleComplete}
              disabled={!canComplete() || saving}
            >
              {saving ? 'Saving...' : setupComplete ? 'Update settings' : 'Complete setup'}
            </button>
            {!canComplete() && (
              <p className="setup-hint">
                Complete the required steps above to continue.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
