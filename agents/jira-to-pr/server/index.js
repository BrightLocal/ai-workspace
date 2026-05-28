const express = require('express');
const { spawn } = require('child_process');
const path = require('path');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const AGENT_DIR = path.resolve(__dirname, '..');

// Jira key format: 1-6 uppercase letters, dash, 1-6 digits
const JIRA_KEY_RE = /^[A-Z]{1,6}-[0-9]{1,6}$/;

// In-memory set to prevent concurrent runs for the same issue
const activeRuns = new Set();

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', activeRuns: Array.from(activeRuns) });
});

app.post('/run-agent', (req, res) => {
  // Validate shared secret
  if (WEBHOOK_SECRET && req.headers['x-webhook-secret'] !== WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { jira_key } = req.body;

  if (!jira_key || !JIRA_KEY_RE.test(jira_key)) {
    return res.status(400).json({ error: 'jira_key is required and must match pattern PROJECT-123' });
  }

  if (activeRuns.has(jira_key)) {
    return res.status(409).json({ error: 'Agent already running for this issue', jira_key });
  }

  activeRuns.add(jira_key);

  const child = spawn('./scripts/run-agent.sh', [jira_key], {
    cwd: AGENT_DIR,
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, SERVER_MODE: 'true' },
  });

  child.on('close', (code) => {
    activeRuns.delete(jira_key);
    console.log(`[${jira_key}] agent finished with exit code ${code}`);
  });

  child.unref();

  console.log(`[${jira_key}] agent started (pid ${child.pid})`);
  res.status(202).json({ status: 'accepted', jira_key });
});

app.listen(PORT, () => {
  console.log(`ai-workspace server listening on port ${PORT}`);
  if (!WEBHOOK_SECRET) {
    console.warn('WARNING: WEBHOOK_SECRET is not set — endpoint is unprotected');
  }
});
