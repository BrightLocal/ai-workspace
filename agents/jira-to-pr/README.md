# Jira-to-PR Agent

An autonomous agent built on **Claude Code** that receives a Jira task link and drives it all the way to a Pull Request with minimal human involvement.

## Workflow

1. You give it a Jira link
2. The agent reads the task via Atlassian MCP
3. Analyses the locally cloned repositories
4. Builds an implementation plan
5. Creates branches, writes code, runs tests
6. Opens a PR on GitHub
7. Leaves a comment in Jira with the plan and links to the PR

## Structure

```
jira-pr-agent/
├── CLAUDE.md                    # Orchestrator instructions
├── .mcp.json                    # Atlassian MCP config
├── .claude/
│   └── agents/                  # Subagents
│       ├── jira-analyzer.md
│       ├── code-researcher.md
│       ├── planner.md
│       └── implementer.md
├── config/
│   └── repos.txt                # List of your git repos
├── scripts/
│   ├── clone-repos.sh           # Clones/updates repositories
│   └── run-agent.sh             # Runs the agent on a task
└── workspace/                   # Working space (gitignored)
    ├── {repo-name}/             # Cloned repos
    ├── plans/                   # Generated plans
    └── runs/                    # Run logs
```

## Installation

### 1. Prerequisites

```bash
# Node.js 18+
node --version

# GitHub CLI
gh --version
gh auth login   # authenticate with your account

# Claude Code
npm install -g @anthropic-ai/claude-code
claude --version
```

### 2. Setup

```bash
# Navigate to the project directory
cd jira-pr-agent

# Fill in config/repos.txt with your repositories
$EDITOR config/repos.txt

# Make scripts executable
chmod +x scripts/*.sh

# Clone repositories
./scripts/clone-repos.sh
```

### 3. Atlassian MCP authorisation

On the first run of `claude` in the project directory, it will prompt you to authorise via OAuth for Atlassian. Accept the prompt in the browser.

Alternatively, you can use an API token (for headless scenarios) — see https://github.com/atlassian/atlassian-mcp-server

### 4. Verification

```bash
cd jira-pr-agent
claude
# in Claude Code:
> /mcp        # should show atlassian as connected
> /agents     # should show your 4 custom subagents
```

## Usage

### Interactively

```bash
cd jira-pr-agent
claude
# in Claude Code:
> Execute the task https://your-company.atlassian.net/browse/PROJ-1234
```

### Headless (full autonomy)

```bash
./scripts/run-agent.sh https://your-company.atlassian.net/browse/PROJ-1234
# or simply
./scripts/run-agent.sh PROJ-1234
```

The run log will be saved to `workspace/runs/{timestamp}-{JIRA-KEY}/agent.log`.

## Security

⚠️ **Read before running in autonomous mode:**

- The `run-agent.sh` script uses `--permission-mode acceptEdits`. This allows the agent to modify files and run commands without confirmation.
- If you want maximum isolation — run the agent inside a Docker container or a devcontainer.
- IMPORTANT: the agent has access to your git credentials (via `gh auth`) and can create PRs on your behalf. Consider using a dedicated service account.
- Atlassian MCP respects the permissions of your Atlassian account. The agent will not be able to see projects you do not have access to.

## Adapting to your stack

Customise the subagents in `.claude/agents/` for your project:

- **`code-researcher.md`** — add specific paths where business logic lives, test setup, conventions
- **`planner.md`** — add domain-specific knowledge about your system (architecture, patterns)
- **`implementer.md`** — update the linter and test commands for your stack (`npm run lint` vs `pnpm`, `pytest` vs `unittest`, etc.)

After changing files in `.claude/agents/` — restart the Claude Code session.

## Fine-tuning CLAUDE.md

The `CLAUDE.md` file in the project root is read by the orchestrator and defines the workflow. Adapt it to your processes: branch naming, PR description format, code review rules, etc.

## Troubleshooting

**"Atlassian MCP not connected"** — restart `claude` and authorise via `/mcp`.

**"gh command not found"** — install the GitHub CLI and run `gh auth login`.

**The agent writes low-quality code** — the most common cause is insufficient context. Consider:
- Adding a `CLAUDE.md` inside each repository (it is read automatically)
- Expanding the instructions in `code-researcher.md` with specifics about your codebase
- Breaking large tasks into smaller ones in `planner.md`

**The agent creates overly large PRs** — add an explicit rule to `planner.md`: "if the plan touches >5 files, suggest splitting into a series of PRs".

## Further development

Things worth adding in future iterations:

- **Hooks** — `.claude/hooks/` for automatically running linters after every `Edit`
- **Permission policy** — `.claude/settings.json` with fine-grained control over allowed commands
- **Additional subagents** — for security review, performance analysis, etc.
- **Self-review subagent** — a separate subagent that reads the created PR and performs self-critique before submission
- **Slack/Discord notifications** — via a dedicated MCP, so you know when a PR is ready
