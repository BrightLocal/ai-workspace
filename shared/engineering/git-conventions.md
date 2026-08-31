# Git Conventions — BrightLocal Engineering

Authoritative reference for branch naming, commit messages, and PR rules. All engineering agents and skills read this file instead of duplicating the rules inline.

## Branch Naming (ADR-0019)

Branch names MUST follow this table:

| Prefix | Format | Example |
|---|---|---|
| `hotfix/` | `hotfix/<lowercase-kebab-description>` | `hotfix/check-empty-user-name` |
| `fix/` | `fix/<TICKET-ID>[-<short-desc>]` | `fix/BUG-909`, `fix/LM-4033-email-alerts` |
| `task/` | `task/<TICKET-ID>[-<short-desc>]` | `task/TEC-127`, `task/CE-3605-migrate-endpoints` |
| `feature/` | `feature/<TICKET-ID>[-<short-desc>]` | `feature/ADMIN-1291` |
| `epic/` | `epic/<lowercase-kebab-description>` | `epic/rm-refactoring` |

**Rules:**
- MUST start with one of: `hotfix/`, `fix/`, `task/`, `feature/`, `epic/`
- After the prefix: a real ticket ID (e.g. `CE-3605`) optionally followed by `-<lowercase-kebab-desc>`, OR a lowercase-kebab-description (no ticket)
- **The ticket ID MUST be UPPERCASE** (`[A-Z]+-\d+`, e.g. `LM-4103`). A lowercase ticket like `task/lm-4103-...` FAILS the CI branch-name check. Only the optional `-<short-desc>` part after the ticket is lowercase-kebab.
- FORBIDDEN: pseudo-IDs like `TASK-0000`, `XXX-0000`, `TICKET-1`, or using the prefix word itself as the ticket key
- No additional `/` after the prefix
- Description parts (after the ticket, or the whole name for `hotfix/`/`epic/`): lowercase, `-` separators, no spaces

**CI enforcement regex** (Tools repo — branch name must match):
```
^(revert-\d+-)*(feature|task|fix|hotfix|epic)\/[A-Z]+-\d+(?:[a-zA-Z0-9\-_]+)*$|^(revert-\d+-)*(fix|hotfix|epic)\/([a-zA-Z0-9\-_]+)$|^main$|^master$|^develop$
```
Note: `task/` and `feature/` branches MUST carry an uppercase ticket ID; only `fix/`, `hotfix/`, `epic/` may use a bare lowercase-kebab description with no ticket.

### Jira issue type → branch prefix

When creating a branch from a Jira task, choose the prefix by issue type:

| Jira type | Prefix |
|---|---|
| Bug / Defect | `fix/` |
| Task / Story / Sub-task | `task/` |
| Feature | `feature/` |
| Epic | `epic/` |
| Hotfix (urgent, no ticket) | `hotfix/` |

Never use `agent/` as a prefix.

## Commit Messages (Conventional Commits)

Format: `<type>: <short imperative description>`

| Type | When |
|---|---|
| `feat:` | New behavior visible to the product |
| `fix:` | Bug fix |
| `refactor:` | Code change with no behavior change |
| `test:` | Adding or updating tests |
| `chore:` | Tooling, config, deps, CI |
| `docs:` | Documentation only |

**Rules:**
- One logical change = one commit. Do not batch unrelated changes.
- Body explains **why**, not what — the diff already shows what.
- No emoji in commit messages.
- No "Co-authored-by: Claude" or similar AI footers — keep commits professional.

**Example:**
```
feat: add phoneNumber field to User model

Required for the new SMS notification feature (PROJ-1234).
Field is optional to keep backward compatibility with existing users.
```

## Push & PR Rules

- NEVER `git push --force` (including `--force-with-lease`)
- NEVER `git reset --hard` on existing branches
- NEVER delete branches other than ones you created locally in this session
- Use `--draft` when the plan contains HIGH-risk items or changes touching security / auth / payments
- Backend PR first when the plan affects multiple repos — frontend may depend on the API
