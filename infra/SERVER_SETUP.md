# Sentinel — Server Setup (what to do on the host)

Everything Sentinel needs on the `flow.gohm.tech` host before the Phase-1 workflows can
be built. Items are ordered; **bold = blocks the build**, the rest can follow.

## 0. What's already in place ✅
- **n8n** at flow.gohm.tech (Docker) with the **Claude CLI node + `claudeCliApi` credential**
  (`xEpaYqT9ncGcZwHj`, used by the Tunahan chatbot). All Sentinel reasoning reuses this.
- n8n runs on **SQLite** (confirmed from the compose) and is on its compose's default
  network — so we add a **dedicated** Postgres on a shared network, not reuse n8n's DB.

## 1–2. **Bring up Sentinel Postgres** (blocks everything)
Use [docker-compose.sentinel-pg.yml](docker-compose.sentinel-pg.yml) — it creates the DB,
runs [schema.sql](schema.sql) automatically on first start, and stays off the public internet.

```bash
cd infra                                   # schema.sql + the compose file live here
docker network create sentinel-net
printf 'SENTINEL_PG_PASSWORD=%s\n' "$(openssl rand -hex 24)" > .env
docker compose -f docker-compose.sentinel-pg.yml up -d
docker ps                                  # find the n8n container name
docker network connect sentinel-net n8n-n8n-1   # attach n8n, no restart
```
Now n8n can reach Postgres at host `sentinel-pg`, port `5432`, db/user `sentinel`.

## 3. **n8n Postgres credential** (blocks everything — I create this for you)
Send me the **password** from `infra/.env`. I create the n8n `postgres` credential via the
API: host `sentinel-pg`, port `5432`, db `sentinel`, user `sentinel`, SSL off (same docker
network). Then I start building the Phase-1 workflows.

## 4. Slack Events API — for Decision Capture (needed for the learning loop, Phase 1)
So a 👍/✅/🗑️ reaction on a briefing item becomes a `Decision` row:
1. api.slack.com → your **sentinel** app → **Event Subscriptions** → enable.
2. Request URL → an n8n webhook (I'll create `Sentinel · Decision Capture` and give you the URL).
3. Subscribe to bot event **`reaction_added`** (and optionally `reaction_removed`).
4. Add bot scope **`reactions:read`**; reinstall the app.

## 5. Credential hygiene (security — do early)
The current briefing nodes have inline secrets. Move to the n8n credential store, then rotate:
| Secret | → n8n credential | Then |
|---|---|---|
| `xoxb-…` Slack bot | `slackApi` | regenerate token |
| `pk_54229113_…` ClickUp | `clickUpApi` | rotate key |
| `GOCSPX-…` ×2 Google | `googleOAuth2Api` | rotate in Cloud Console |
| `1//03…` refresh tokens | google cred store | — |
| n8n API key (JWT) | — | rotate; it's currently in deploy.py runs |

Run `gitleaks detect` before every commit (the repo is already sanitized; keep it that way).

## 6. Phase-2 prerequisites (later, not now)
- **git repos mounted** into the n8n container (a volume) so the `claude-cli` node can do repo
  work in a real working dir.
- Confirm the n8n image can run `claude` non-interactively with the baked credential.

---

### The one thing blocking me right now
**Steps 1–3.** Provision the `sentinel` DB, run `schema.sql`, and send me the connection
details. Then I build, in order: `Sentinel · Ingest` → refactor sources into adapters →
Postgres-backed `Daily Briefing` (with learning context) → `Decision Capture` → `Profile`.
