# Coding standards for generated code

Applies to every line the agent adds or changes in Tools and ListingSyncer. Reviewers
have rejected agent PRs for exactly the things below, so they are checked three times:
when the planner names things, by `scripts/diff-lint.py` before each commit, and by the
`code-reviewer` subagent before the PR is opened.

## 1. Comments

The diff carries no ticket. The branch name, the commit body and the PR body carry it.

Never add:

- a Jira key (`LM-4358`, `CE-1234`) in code, docblocks, test names, fixtures, SQL or a
  migration description;
- a comment that narrates the change: "added for", "new field", "updated to", "fix for",
  "as per ticket";
- `TODO`, `FIXME`, `XXX`, `HACK` — open points go to the PR's *Additional comments*;
- a comment that restates the code (`// increment the counter`).

Allowed, rarely:

- a *why* that stays true without the ticket — an external API quirk, a non-obvious
  invariant — in one or two lines;
- what the project convention requires: `#[CoversClass]`, `@codeCoverageIgnore` with a
  reason, PHPStan annotations;
- comments that already exist on lines you did not change. Leave them alone.

## 2. Naming

Name things the way the surrounding module names its domain concepts, not after the
shape of the data.

Before introducing any name:

1. Grep the module (`src/Modules/{Module}/`, or the `src/App/...` area for legacy code)
   for the concept: entity, DTO, repository method, event, query. Reuse those words.
2. Read the two or three classes closest to the one you edit and mirror their style:
   singular or plural, suffixes such as `Finder`, `Provider`, `Generator`, `Updater`.
3. If the concept has no name yet, build it from the domain vocabulary in
   `cl-team-entry-points.md` and the product glossary, not from the array shape.

Rules:

- Variables name the domain thing: `$expiredConnections`, not `$rows`;
  `$locationSettings`, not `$data`; `$matchedListing`, not `$result`.
- Collections are plural, elements singular: `foreach ($alerts as $alert)`.
- Booleans read as predicates: `$isConnected`, `$hasPendingUpdate`, `shouldRetry()`.
- Abbreviations only where the module already uses them (`gmb`, `cb`, `lsrc`, `as`);
  otherwise full words.
- Methods: verb + domain noun, same tense as their neighbours (`findByLocationUuid`,
  `markAsArchived`).
- Classes follow the module's patterns: `{Verb}{Noun}Command`, `{Noun}Query`,
  `…Handler`, `…Repository`, `…Test`.
- Tests: `test{Behaviour}` or the module's existing scheme, with AAA comments, never a
  ticket key.

Banned when the agent introduces them (assignment, `foreach`, parameter, closure):

```
PHP:    $object $obj $item $row $data $result $res $value $val $tmp $temp
        $arr $array $el $element $info $thing $x $y
JS/TS:  obj item row data result res value val tmp temp arr el element info thing
```

Exceptions: a line that already used the name before your change; `$i` as a numeric
loop index; `$e` in `catch`. Even in a generic utility prefer a typed name
(`$firstAlert`, `$remainingLocations`).

## 3. Shape of the change

- The smallest diff that does the job. No drive-by renames, reformatting or refactors
  outside the plan.
- Match the file's existing style; ECS fixes the rest.
- New code lands in `src/Modules/` as Tools' `AGENTS.md` says; legacy areas get patched,
  not extended.

## 4. How it is checked

- **Planner** fills the *Names to introduce* table in the plan, with the vocabulary source
  for each name. Naming is reviewed there, where changing it is free.
- **Implementer** runs `scripts/diff-lint.py` before every commit and fixes what it
  reports instead of allowing it away.
- **code-reviewer** reads the diff against the surrounding module and returns renames and
  comments to delete; the implementer applies them before pushing.
