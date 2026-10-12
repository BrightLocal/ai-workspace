# dev-env-deployer

Deploys a branch (Tools by default, ListingSyncer via `--repo`) to one of `dev1`..`dev9` through
[Deployer](https://deployer.bll-i.co.uk), waits for it, checks it actually landed, and releases the
reservation when you're done.

Built on the `deployer` skill (`skills/engineering/deployer/`) — the CLI, credential and policy live
there; this agent adds branch resolution (branch / PR URL / Jira key), the approval question,
post-deploy verification and the hand-off to `dev-env-inspector`.

## Try it

```
deploy task/LM-4503-foursquare-diff to a dev env
deploy LM-4503 to dev4
put https://github.com/BrightLocal/Tools/pull/28833 on a free dev box
release dev4
```

It will list free envs, ask **one** question naming env + branch + what it replaces, deploy only on
an explicit yes, and keep the env reserved until you say `release devX`.

## Setup (once)

1. VPN up.
2. Grab the `deployer-sid` cookie from deployer.bll-i.co.uk (DevTools → Application → Cookies, or
   `document.cookie` in the console) and save it:
   ```
   # personal/credentials/deployer.env   (gitignored)
   DEPLOYER_SID=<value>
   ```
   It's valid ~180 days and logging out does **not** revoke it — treat it as a password.
3. `skills/engineering/deployer/scripts/deployer.mjs whoami` should print your name.
4. Node ≥ 22 (uses the built-in `fetch` and `WebSocket`).

## Guarantees

- Only `dev1`..`dev9`; `Live`/`staging`/`stg01`/`stg02` are refused by the CLI itself.
- Never deploys over someone else's reservation; never releases someone else's.
- Never writes to a dev box over SSH — Deployer is the only way in.
