import React, { useEffect, useRef, useState } from 'react'
import { createWebSocket } from '../api.js'

export default function LiveOutput({ runId, initialLines = [], initialStatus, onFinished }) {
  const [lines, setLines] = useState(initialLines)
  const [status, setStatus] = useState(initialStatus || 'running')
  const [wsReady, setWsReady] = useState(false)
  const bottomRef = useRef(null)
  const wsRef = useRef(null)

  // Reset when switching to a different run
  useEffect(() => {
    setLines(initialLines)
    setStatus(initialStatus || 'running')
    setWsReady(false)
  }, [runId])

  useEffect(() => {
    if (!runId || status === 'success' || status === 'failed') return

    const ws = createWebSocket(runId)
    wsRef.current = ws

    ws.onopen = () => setWsReady(true)
    ws.onclose = () => setWsReady(false)

    ws.onmessage = (event) => {
      try {
        const frame = JSON.parse(event.data)
        if (frame.type === 'output') {
          setLines((prev) => [...prev, frame.line])
        } else if (frame.type === 'done') {
          setStatus('success')
          onFinished?.()
          ws.close()
        } else if (frame.type === 'error') {
          setStatus('failed')
          onFinished?.()
          ws.close()
        }
      } catch {}
    }

    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [runId, status])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines])

  if (!runId) return null

  const isRunning = status === 'running'
  const isEmpty = lines.length === 0

  return (
    <div className="live-output-wrapper">
      <div className="live-output-toolbar">
        <span className="live-output-title">Output</span>
        <div className="live-output-toolbar-right">
          {isRunning && (
            <span className="live-output-status">
              <span className="pulse-dot" />
              {wsReady ? 'Live' : 'Connecting…'}
            </span>
          )}
          {status === 'success' && <span className="badge badge-success">Completed</span>}
          {status === 'failed' && <span className="badge badge-error">Failed</span>}
          {lines.length > 0 && (
            <span className="live-output-linecount">{lines.length} lines</span>
          )}
        </div>
      </div>

      <pre className="live-output">
        {isEmpty && isRunning ? (
          <span className="output-starting">
            <span className="pulse-dot" style={{ marginRight: 8 }} />
            Agent is starting, please wait…
          </span>
        ) : (
          lines.map((line, i) => (
            <span key={i} className={`output-line ${classifyLine(line)}`}>
              {line}{'\n'}
            </span>
          ))
        )}
        <span ref={bottomRef} />
      </pre>

      {status === 'failed' && (
        <div className="live-output-error-banner">
          Agent exited with an error. Check the output above for details.
        </div>
      )}
    </div>
  )
}

function classifyLine(line) {
  if (line.startsWith('✓')) return 'line-success'
  if (line.startsWith('✗') || line.toLowerCase().includes('error')) return 'line-error'
  if (line.startsWith('⚙')) return 'line-tool'
  if (line.startsWith('   ↳')) return 'line-result'
  if (line.startsWith('Agent started')) return 'line-meta'
  return ''
}
