# Sentinel — Status & Handoff

> Single source of truth for picking up work on **Sentinel**, Cem Ayyildiz's personal AI
> chief-of-staff. Read this first. Complements `SENTINEL_DESIGN.md` (architecture rationale).
> Last updated: 2026-06-26.

---

## 0. TL;DR — what's live and what's next

Sentinel is a set of **n8n workflows** (host: `https://flow.gohm.tech`) backed by **Postgres**
(`sentinel-pg`) and a **Claude CLI** LLM node. It runs Cem's 3-part vision end-to-end:
1. **Cut noise** — daily briefing, learning-gated triage queue, mail cleaning.
2. **Team roadmap reports** — weekly 2026-goals-vs-ClickUp report.
3. **Create issues with approval** — Slack-approved ClickUp tasks.
Plus a **Chat** assistant (DM it questions / commands).

**Active focus (story points / agent throughput):**
- ✅ Built: `clickup_events` ledger + ClickUp webhook capturing status/assignee/comment events live.
- ✅ Built: Multica **agent detection from comments** + **auto-estimate story points** on delivery.
- ⏳ **NEXT TODO: Phase 3 — weekly SP snapshot report** (read the ledger, output the per-person
  weekly story-point column automatically + agent deliveries). See §6.

---

## 1. Who / context

- **Cem Ayyildiz** — CTO of **FreshSens**, GM of **GOHM**, lead on **DIEFI** (EU project).
- Slack user id `UEL80DGQ5`; Sentinel DM channel `D0BBRKKPGUE`. **Only Cem's events are processed**
  (hard lock in Decision Capture: `CEM='UEL80DGQ5'`).
- Cem's stated intent (verbatim): (1) decrease background noise — read all sources, clean mail,
  read notes, check ClickUp; (2) create team roadmap reports (teams vs the plan); (3) create issues
  for him/team with Slack approval. Plus a chatbot ("who is doing what?").

---

## 2. Infrastructure

### n8n
- Base: `https://flow.gohm.tech`, public API at `/api/v1`.
- **API key + URL live in `.mcp.json` → `mcpServers.n8n-hr.env`** (`N8N_API_KEY`, `N8N_API_URL`).
  NOT in the repo otherwise (deploy scripts carry `__N8N_API_KEY__` placeholder).
- **Deploy/patch pattern** (when `/tmp` working copies are gone): GET workflow → patch node
  `jsCode`/`query` → PUT back. Two gotchas:
  - **Cloudflare blocks the default urllib User-Agent (error 1010)** → send a browser
    `User-Agent` header on every n8n API call.
  - PUT body must include only schema-allowed `settings` keys
    (`saveExecutionProgress, saveManualExecutions, saveDataErrorExecution,
    saveDataSuccessExecution, executionTimeout, errorWorkflow, timezone, executionOrder`) —
    strip extras like `binaryMode` or it 400s.
  - Executions API does **not** sort by id reliably → fetch a batch and `sort by int(id) desc`.
- The `n8n-hr` MCP server (get/update/list workflows + executions) is also available when connected.

### Postgres
- Container `sentinel-pg` (postgres:16) on docker network `sentinel-net`; n8n is attached to it.
  Host-only admin port `127.0.0.1:5433`. DB `sentinel`, user `sentinel`. Password in server
  `infra/.env` only.
- n8n credential **"Sentinel Postgres"** id `1TBwe9uebXBQKUhV`.
- **n8n postgres node gotcha:** creating the credential via API needs `ssl` AND `sshTunnel:false`
  set explicitly. `executeQuery` binds params via `options.queryReplacement` as an expression
  array `={{ [$json.a, ...] }}`.
- Schema: `infra/schema.sql`. Tables: `signals, decisions, outcomes, briefings, decision_profile,
  actions, roadmap, clickup_events`.
- To run ad-hoc SQL/DDL: repurpose the **`Sentinel · DB Test`** workflow (set its `PG` node query,
  GET its webhook `sentinel-db-test-001`, read the execution output).

### LLM
- **Claude CLI** node `@chrishdx/n8n-nodes-claude-cli` via LangChain `chainLlm`. Credential
  **`claudeCliApi`** id `xEpaYqT9ncGcZwHj` ("Tunahan Chatbot · Claude CLI"), model
  `claude-sonnet-4-6`. **The direct Anthropic API key is out of credits — use the Claude CLI node.**
- Reliable build pattern: **avoid native n8n credential nodes**; use Code nodes with
  `this.helpers.httpRequest` + embedded refresh tokens/API keys (sanitized in the repo).

### Secrets / repo hygiene
- Working copies with real secrets used to live in `/tmp/sentinel/` (ephemeral; may be gone).
- Repo commits are **sanitized**: `__CLICKUP_API_KEY__`, `__SLACK_BOT_TOKEN__`,
  `__GOOGLE_REFRESH_TOKEN__`, `__GOOGLE_CLIENT_SECRET__`, `__N8N_API_KEY__`, `__MIRO_TOKEN__`.
  **Always regex-scan for `pk_54229113_`, `xoxb-`, `GOCSPX-` before committing.**
- `.gitignore` excludes `credentials/`, `.mcp.json`, `.env`, `infra/.env`, `infra/pg_data/`.

---

## 3. External systems & IDs

### ClickUp (API v2, key `pk_54229113_…` = Cem's; sanitized in repo)
- Teams: **FreshSens `9009068877`**, **GOHM `42085420`**, **DIEFI `9014647941`**.
- **Agent account: "Agent Multica" user id `106715754`.**
- FreshSens spaces: **Development `90090136601`**, Management `90010053606`,
  Sales/Marketing/PH&Ops `90152680846`, **Team Leads `90155478263`**, Admin `901511184184`,
  Fundraising `90159399897`.
- **Active-sprint folders** (Sentinel finds the list where `start_date<=now<=due_date`):
  FreshSens `90090412752`, GOHM `90151692710`, DIEFI `90145177889`.
  (GOHM/DIEFI currently have **no active sprint** → fall back to latest.)
- Key lists: **Dev Sprint 64 (current) = `901524043562`**, Sprint 63 = `901523674208`,
  Team Leads "June 2026" = `901523773592`, FreshSens "Sentinel Inbox" = `901524068347`.
- Issue-router inbox lists: freshsens `901524068347`, gohm `901524068348`, diefi `1000360000000408`.
- **ClickUp webhook** (FreshSens team): id `c349e1ab-7dc1-4210-9c88-4b55f792a706`, endpoint
  `…/webhook/sentinel-clickup-events`, events `taskStatusUpdated, taskAssigneeUpdated,
  taskCommentPosted`.

### Slack
- Bot HTTP API (token `xoxb-…`, sanitized). Mrkdwn = single `*bold*`, **no markdown tables**.
- Event Subscriptions → `…/webhook/sentinel-slack-events` (reaction_added + message.im).
- Cem DM channel `D0BBRKKPGUE`.

### Google / Miro
- Gmail + Calendar + Drive via OAuth refresh tokens (FS + GOHM), embedded in Code nodes.
- Miro 2026 roadmap board `uXjVLxVQ_qI=` ("FS - Tech Roadmapping"), **"Frame 1"** = 5 strategic
  2026 goals. Stored in the `roadmap` table (id=1). Refresh via `infra/refresh-roadmap.py`
  (cursor pagination; offset doesn't work; board is huge ~1343 items).

---

## 4. Workflows (all ACTIVE unless noted)

| Workflow | id | Trigger | Purpose |
|---|---|---|---|
| **Ingest** | `k3rAxpxlhVFrD8fp` | webhook `sentinel-ingest` | Front door: normalize+dedup any signal into Postgres `signals` (content_hash, djb2). |
| **Daily Briefing** | `UR3IjaOiHX0guopW` | cron `0 4 * * *` (07:00 IST) + webhook `sentinel-test-trigger-001` | Reads mail/calendar/notes/ClickUp → stores signals → posts morning briefing to Slack; routes triage queue. |
| **Post Queue** | `zV37n3aaFQxMD0sd` | webhook `sentinel-postqueue` | Learning-gated triage: AI classifies vs profile, auto-skips clear noise, surfaces ≤5 needing a call. Auto-refills as the board clears. |
| **Decision Capture** | `tTq2dXFA8xc1C5uZ` | webhook `sentinel-slack-events` | Slack reactions/replies → decisions (verdict+reason) → cleans board, triggers mail-clean, handles issue approvals. Routes chat questions. **Cem-only.** |
| **Profile** | `tvUyWOphKOHpR6Wi` | cron `0 17 * * 0` + webhook `sentinel-profile-test` | Weekly: rewrites the learned "how Cem decides" profile from decisions. |
| **Mail Cleaner** | `scMAvwvO967CgDSh` | webhook `sentinel-clean-mail` | Archives `skip`-verdict emails (remove INBOX, add `Sentinel/FYI-Archived`). **Never deletes.** |
| **Roadmap Report** | `7IMt0zEgyJyp8It2` | cron `0 5 * * 1` (Mon 08:00 IST) + webhook `sentinel-roadmap` | Correlates 2026 Miro goals vs ClickUp → goal-by-goal status to Slack. |
| **Issue Router** | `ICQRNBVKfn5kkMGO` | webhook `sentinel-issue-router` | delegate/do_later decisions → drafted ClickUp tasks → Slack proposal → ✅ creates / ❌ rejects. |
| **Issue Router (DRY RUN)** | `LzUyFvtfzTgj7wW9` | webhook `sentinel-router-test` | Safe simulation of the above. Scaffolding. |
| **Chat** | `jiC77CfK4B8yDtFm` | webhook `sentinel-chat` | DM Q&A + commands. See §5. |
| **ClickUp Events (ledger)** | `4kQIG4Dhb7f5edWl` | webhook `sentinel-clickup-events` | Captures status/assignee/comment changes → `clickup_events`. Agent detection + SP auto-estimate. See §6. |
| **DB Test** | `wefU83D11JiQ44I6` | webhook `sentinel-db-test-001` | Throwaway SQL/DDL runner utility. Not user-facing. |

Source for each lives under `workflows/sentinel-*/` (sanitized).

---

## 5. Chat workflow (`jiC77CfK4B8yDtFm`) — current behavior

Node chain: `Chat In` → `Gather Conversation` (last ~14 msgs, thread or DM) → `Gather ClickUp`
→ `Gather Mail & Calendar` → `Load Context` (Postgres: roadmap + recent decisions/actions) →
`Build Prompt` → `Chat LLM` (Claude CLI) → `Execute Action` → `Post Answer`.

Capabilities (all built + verified):
- **Accurate board counts** — "Gather ClickUp" pulls each org's **active sprint** board fully
  (paginated, `include_closed`), grouped by real status + assignee, **with story points + SP
  rollup**. "FreshSens development board" = the current sprint. (Earlier bug: it used 7-day,
  page-0, all-spaces data → wrong counts. Fixed.)
- **Referenced boards** — detects a board Cem names by **ClickUp URL/list-id or name**
  ("team leads", "management", "sales", "fundraising"), loads its real tasks (id/assignee/status/
  points) as a REFERENCED BOARD. **Never guesses a comment target** — asks if the board isn't loaded.
- **Commands**: create task (active sprint, **multiple assignees on ONE task**), comment on a task
  (real task_id only), multi-action in one message.
- `executionTimeout` raised to 220s (heavier gathers).

---

## 6. Story points / agent throughput (active build)

**Goal:** reproduce Cem's manual weekly SP sheet automatically — per-person story points completed
per week (review counts as completed), plus the **Multica agent's** weekly output.

### Why it's hard (proven)
- ClickUp **`date_closed` is corrupted by sprint bulk-closeout** (Sprint 63 closed 2026-06-23
  stamped 34 tasks done in early June). **Review has no entry-timestamp.** ⇒ weekly SP **cannot be
  reconstructed after the fact** — it must be captured **live**. This is why the ledger exists.
- Story `points` are set on only ~36/112 Sprint-64 tasks; the Team Leads board has **none**.

### The agent is identified from COMMENTS (Cem's correction — NOT the assignee field)
Markers (posted by Agent Multica or the Şevval integration token):
- `synced to Multica` + `FRE-NN` → handed to agent (`agent_synced`)
- `Multica update … in_progress` → working (`agent_working`)
- **`MR opened for review` + `gitlab.gohm.tech/.../merge_requests/NNN` → DELIVERED (`agent_mr`) =
  agent-completed**
- `needs_clarification` → blocked (`agent_clarify`)
- (human) `Checked the following merge request … Fix is good` → merged

### What's built (`Sentinel · ClickUp Events`, id `4kQIG4Dhb7f5edWl`)
- Webhook → **Parse & Enrich** (one row per history_item; comment events scan the latest comment
  for Multica markers; enriches with task name/list/points/org) → **Insert Events** (Postgres
  `clickup_events`, `ON CONFLICT DO NOTHING`).
- **GOTCHA:** ClickUp assignee history `field` = **`assignee_add` / `assignee_rem`** (not
  `assignee`); status `field` = `status` with `before/after.status`.
- **Auto-estimate branch:** `agent_mr` with no points → `Need Estimate` → `Build SP Prompt`
  (title+description) → `Estimate SP` (Claude CLI, Fibonacci 1/2/3/5/8/13) → `Set Points`
  (PUT points to ClickUp) → `Log Estimate` (`agent_points_est` row).
  Verified end-to-end: a points-less backend task → estimated **5** → set on task → logged.

### `clickup_events` schema (in `infra/schema.sql`)
`task_id, task_name, org, list_id, list_name, event, field, before_val, after_val, assignee_user,
points, actor, event_time, raw(jsonb), ingested_at`. Unique dedup on
`(task_id, field, COALESCE(after_val,''), event_time)`. Field values:
`status | assignee_add | assignee_rem | agent_synced | agent_working | agent_mr | agent_clarify |
agent_points_est`.

### Definitions Cem chose
- **Agent "completed" = `agent_mr`** (MR opened for review).
- **Missing points → estimate** (Claude), don't just count tasks.
- Weekly metric = **live weekly snapshot** (SP that entered Review/Closed that week).

### ⏳ NEXT: Phase 3 — weekly SP snapshot report (NOT built yet)
Build a workflow (cron weekly, e.g. Mon) that reads `clickup_events` for the ISO week and outputs:
- **per person**: SP whose status entered `Review`/`Closed` that week (`field='status'`,
  `after_val in (review, Closed)`, sum `points`).
- **Multica Agent**: count of `agent_mr` deliveries that week + their (auto-estimated) SP.
- Post to Slack / store so Cem can paste the column. Mirror his sheet rows:
  Gabby, Sevval, Sina Can, Sultan, Muhammad, Multica Agent.
- Note: the ledger only has data **from 2026-06-26 forward** — it can't backfill history.

### This week's column already given (Sprint 64 to-date snapshot, overlaps Week 25)
`Gabby 11 · Sevval 14 · Sina Can 2 · Sultan 4 · Muhammad 5 · Multica Agent 0`.

---

## 7. Key gotchas / lessons (don't re-learn these)

- **Board = active sprint.** The ClickUp space Board *view* endpoint returns ALL space tasks and
  ignores the view's `show_closed:false` filter — do NOT use it for counts. Use the active sprint list.
- **Cloudflare 1010** on n8n API → browser `User-Agent`.
- **n8n PUT** → strip non-schema `settings` keys.
- **ClickUp assignee** history fields are `assignee_add`/`assignee_rem`.
- **Agent = comments, not assignee.** The agent reassigns away, so current-assignee loses the signal.
- **One task, many assignees** — never one task per person.
- **Mail is archived, never deleted.**
- **Manual Slack message cleanup** → reset `signals.slack_ts=NULL` for undecided items or auto-refill jams.
- Bulk sprint closeout overwrites `date_closed` — never trust it for weekly metrics.

---

## 8. How to resume next session

1. Read this file + `infra/schema.sql` + `workflows/sentinel-clickup-events/`.
2. Confirm the ledger is accumulating: query `clickup_events` (via DB Test) — expect status/assignee
   rows from live team activity, plus any `agent_mr`/`agent_points_est`.
3. **Build Phase 3** (weekly SP snapshot report) — the one remaining piece.
4. Memory index: `~/.claude/projects/-home-cem-temp-sentinel/memory/` (`sentinel-phase1-postgres.md`
   has the running build log).
