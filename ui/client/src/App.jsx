import React, { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, NavLink, useNavigate, Navigate } from 'react-router-dom'
import AgentCatalog from './pages/AgentCatalog.jsx'
import AgentRunner from './pages/AgentRunner.jsx'
import RunHistory from './pages/RunHistory.jsx'
import SetupWizard from './pages/SetupWizard.jsx'
import { api } from './api.js'

function Layout({ children, setupComplete }) {
  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="#6366f1"/>
              <circle cx="16" cy="16" r="8" stroke="white" strokeWidth="2"/>
              <path d="M12 16l3 3 5-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="logo-text">AI Workspace</span>
          </div>
          <nav className="nav">
            <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              Agents
            </NavLink>
            <NavLink to="/setup" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              {!setupComplete && <span className="nav-dot" />}
              Setup
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="main">{children}</main>
    </div>
  )
}

export default function App() {
  const [setupComplete, setSetupComplete] = useState(true)

  useEffect(() => {
    api.setup.checks().then((data) => setSetupComplete(data.setupComplete)).catch(() => {})
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <Layout setupComplete={setupComplete}>
              <AgentCatalog />
            </Layout>
          }
        />
        <Route
          path="/agents/:slug"
          element={
            <Layout setupComplete={setupComplete}>
              <AgentRunner />
            </Layout>
          }
        />
        <Route
          path="/agents/:slug/runs"
          element={
            <Layout setupComplete={setupComplete}>
              <RunHistory />
            </Layout>
          }
        />
        <Route
          path="/agents/:slug/runs/:runId"
          element={
            <Layout setupComplete={setupComplete}>
              <RunHistory />
            </Layout>
          }
        />
        <Route
          path="/setup"
          element={
            <Layout setupComplete={setupComplete}>
              <SetupWizard onComplete={() => setSetupComplete(true)} />
            </Layout>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
