# Domain Evidence Map Template

> This template defines the companion artifact of the codebase-to-domain-doc
> pipeline: the definition → code contract that makes the domain document
> verifiable now and refreshable later. Each section contains:
> - The literal heading (must appear verbatim in output)
> - `<!-- AGENT INSTRUCTIONS -->` comments — these guide the gap-auditor agent
>   and MUST be removed from the final output
>
> This file is INTERNAL: it is never published to Confluence and never leaves
> the working directory.

---

# Evidence map: {domain-slug}

> Companion to 03-domain-definitions.md — internal, never published.
> Repos: {Tools @ {sha} ({date}) · ListingSyncer @ {sha} ({date})}

<!--
AGENT INSTRUCTIONS — header:

The repo SHAs and dates come from 00-inputs/repo-state.md verbatim — NEVER
invent or omit them; they are what makes refresh runs possible. One
"{repo} @ {sha} ({date})" entry per scanned repo.
-->

## Evidence

<!--
AGENT INSTRUCTIONS — Evidence section:

Compiled from the evidence tables in 02-research/*.md. One or more rows per
D-ID; multiple sources per definition are multiple rows. Status is the
definition's overall research status (confirmed / partial / not-found /
conflict); Type is per row (doc / code / inferred). Source format:
"{repo}:{path} § {section}" for doc rows, "{repo}:{path} — {symbol}" for code
rows, "—" for inferred rows. A definition with no evidence still gets one row:
status not-found, type —, source —, and the searched-where note in the last
column. Never drop a definition because evidence is missing.
-->

| ID | Term | Status | Type | Source | What it shows |
|---|---|---|---|---|---|
| D-1 | {term} | {confirmed/partial/not-found/conflict} | {doc/code/inferred} | {repo:path § section} | {one line} |

## Refresh procedure

<!--
AGENT INSTRUCTIONS — Refresh procedure:

Keep this section verbatim as written below (fill only the placeholders).
It is instructions to the NEXT run's human and agents, not to you.
-->

To refresh this map after the code moves on:

1. Re-run `scripts/run.sh {domain-slug} <same-input>` — it records the new
   repo SHAs in `00-inputs/repo-state.md`.
2. Compare the new SHAs with this file's header. Per repo, list what changed:
   `git -C products/{repo}/codebase/{repo} diff --name-only {old-sha}..{new-sha}`
3. Rows whose Source path appears in that diff need re-verification: delete
   the affected units' files in `02-research/` and re-invoke
   `branch-researcher` for those units only.
4. Re-run Phase 2 (writer) and Phase 3 (auditor). D-IDs are stable — the new
   map supersedes this one.
