# AI Workspace for Product Work

A personal AI workspace for product management, engineering oversight, and analytics
in the Local SEO niche. Built on Claude Code.

## What this is

A coordinated set of AI roles (PM, Architect, Analyst, PMM) and automation pipelines
(`jira-to-pr`, `context-to-prd`, etc.) that share common knowledge about your products
and your industry.

The goal is to cover expertise gaps and to compress repetitive product work.

## What this is not

- A chatbot. There is no single "agent" — there are pipelines and roles.
- A replacement for thinking. The roles surface considerations; you make decisions.
- A black box. Every subagent is a markdown file you can read and edit.

## Quick start

### Prerequisites
- Claude Code installed (https://docs.claude.com/claude-code)
- Git (for the workspace itself)

### Setup
```bash
# Clone or unzip into your preferred location
cd ai-workspace

# (Optional) initialize git if you want version control
git init
git add .
git commit -m "Initial workspace"

# Open in Claude Code
claude
```

### First steps
1. Open `CLAUDE.md` in the root — it explains the architecture
2. Open `products/BrightLocal/CONTEXT.md` and fill in what's relevant for your product
3. Open `shared/domain/local-seo.md` and add any niche-specific knowledge
4. Try the first pipeline: `agents/context-to-prd/README.md`

## Folder map

```
ai-workspace/
├── CLAUDE.md                 # Architecture overview (read first)
├── README.md                 # This file
│
├── shared/                   # Cross-cutting knowledge
│   ├── personas/             # PM, Architect, Analyst, PMM as system prompts
│   ├── domain/               # Local SEO concepts, Shape Up method
│   ├── templates/            # PRD template, user story template
│   └── style/                # Voice and tone (optional)
│
├── personal/                 # Personal settings (gitignored)
│
├── skills/                   # Methodology modules
│   ├── product/              # PRD writing, story decomposition, etc.
│   ├── engineering/
│   ├── analytics/
│   └── marketing/
│
├── agents/                   # Autonomous pipelines
│   └── context-to-prd/       # Free context → PRD draft
│
└── products/                 # Product-specific context
    ├── BrightLocal/
    └── pet-project/
```

## Working with multiple products

Each product has its own folder under `products/`. To switch the active product,
set the environment variable before invoking a pipeline:

```bash
export ACTIVE_PRODUCT=BrightLocal
# or
export ACTIVE_PRODUCT=pet-project
```

Pipelines read `products/$ACTIVE_PRODUCT/CONTEXT.md` automatically.

## Adding a new product

1. Create `products/{your-product-slug}/`
2. Copy `products/BrightLocal/CONTEXT.md` as a starting point
3. Fill in the questions in CONTEXT.md
4. (Optional) add `architecture.md` and `glossary.md` for richer context

That's it. No code changes needed.

## Adding a new role

1. Create `shared/personas/{role}.md` — the system prompt for the role
2. Reference it from any subagent that should adopt this perspective

## Adding a new pipeline

1. Create `agents/{pipeline-name}/`
2. Add `CLAUDE.md` (orchestrator), `.claude/agents/*.md` (subagents),
   `scripts/run.sh` (entry point), and `README.md` (how to use)
3. Use `agents/context-to-prd/` as a reference

## Sharing this workspace

If you decide to share with teammates:

1. Make sure `.gitignore` is excluding `personal/`, `products/*/working/`, and
   any `*.env` or credential files
2. Push to a private repo
3. Have teammates clone and run their own `personal/` setup

## Troubleshooting

**Subagent doesn't have product context.**
Check that `ACTIVE_PRODUCT` is set and that `products/$ACTIVE_PRODUCT/CONTEXT.md` exists.

**Subagent ignores the persona.**
Verify the subagent's frontmatter includes the persona file in its context loading.

**Working doc not appearing.**
Check `products/$ACTIVE_PRODUCT/working/` exists and is writable. It's in `.gitignore`
by default, so newly created folders won't be tracked.
