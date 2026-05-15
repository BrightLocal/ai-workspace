import React from 'react'

function Icon({ status }) {
  if (status === 'pass') return <span className="step-icon step-pass">✓</span>
  if (status === 'fail') return <span className="step-icon step-fail">✗</span>
  if (status === 'warn') return <span className="step-icon step-warn">!</span>
  if (status === 'loading') return <span className="step-icon step-loading">⋯</span>
  return <span className="step-icon step-info">ℹ</span>
}

export default function StepCheck({ check, onSkip, children }) {
  const { label, status, detail, fix, fixCommand, fixUrl, optional } = check

  return (
    <div className={`step-check step-${status}`}>
      <div className="step-check-header">
        <Icon status={status} />
        <span className="step-label">{label}</span>
        {optional && <span className="step-optional">optional</span>}
        {optional && onSkip && status !== 'pass' && (
          <button className="btn-skip" onClick={onSkip}>Skip</button>
        )}
      </div>

      {detail && <p className="step-detail">{detail}</p>}

      {status === 'fail' && fix && (
        <div className="step-fix">
          {fixCommand ? (
            <code className="step-command">{fixCommand}</code>
          ) : (
            <p>{fix}</p>
          )}
          {fixUrl && (
            <a href={fixUrl} target="_blank" rel="noreferrer" className="step-link">
              {fixUrl}
            </a>
          )}
        </div>
      )}

      {children}
    </div>
  )
}
