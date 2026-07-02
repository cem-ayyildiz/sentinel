# Sentinel — Status & Handoff

> Single source of truth for picking up work on **Sentinel**, Cem Ayyildiz's personal AI
> chief-of-staff. Read this first. Complements `SENTINEL_DESIGN.md` (architecture rationale)
> and `CLAUDE.md` (deploy/test working agreement). Last updated: 2026-07-02 (§10 = briefing v3).

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
- ✅ Built (2026-06-27): **Phase 3 weekly SP** — folded into Friday's daily briefing (per-person
  actor-credited SP + agent MR deliveries), via `Load Context`. See §9.

**Registry-driven ClickUp optimization (2026-06-27) — see §9:**
- ✅ **Workspace registry** `infra/workspaces.json` → Postgres `workspaces` table (single source of
  truth for cadence/depth/routing per ClickUp space + Slack channel + Gmail rule). Sync:
  `infra/sync-workspaces.py [--emit-sql]`.
- ✅ Daily briefing reorganized **by company** (cockpit + FreshSens/GOHM/DIEFI/Personal blocks);
  Development = deep sprint board + comments + **board-hygiene** flags; weekly spaces (Sales/Team
  Leads/Fundraising) Friday-only + escalation; Slack channels tiered + org-tagged.
- ✅ Issue routing + chat now resolve target boards from the registry (default Management, ask if
  ambiguous).
- ⚠️ **Working n8n API key is in `~/.claude/settings.json` → `mcpServers.n8n-hr.env.N8N_API_KEY`.**
  The one in `~/.claude.json` is STALE (401).

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

Source for each lives under `workflows/sentinel-*/` (sanitized); catalog: `workflows/README.md`.

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

1. Read this file + `infra/schema.sql` + `infra/workspaces.json` + `workflows/sentinel-clickup-events/`.
2. Confirm the ledger is accumulating: query `clickup_events` / `clickup_comments` (via DB Test).
3. Memory index: `~/.claude/projects/-home-cem-temp-sentinel/memory/`.

---

## 9. Registry-driven cadence/tiering (built 2026-06-27)

**Single source of truth: `infra/workspaces.json`** → mirrored to Postgres `workspaces` table by
`infra/sync-workspaces.py --emit-sql` (run the SQL via DB Test). Holds per **ClickUp space** /
**Slack channel** / **Gmail rule**: `cadence` (daily | weekly-fri | mute), `depth` (deep|track|
summary), `routing_keywords`, `hygiene` flags, authored `readme`. **Edit the JSON, re-sync, done.**

**Spaces:** FreshSens Development (daily/deep), Management (daily/track, default issue landing),
Sales+PH&Ops / Team Leads / Fundraising (weekly-fri), Admin (mute); GOHM Management (daily, the live
hub) + villakurt/Home (personal); DIEFI Development (daily). Org→team: fs `9009068877`, gohm
`42085420`, diefi `9014647941`. Sprint folders: fs `90090412752`, gohm `90151692710`, diefi `90145177889`.

**Daily Briefing (`UR3IjaOiHX0guopW`):**
- New **`Load Registry`** Postgres node (Set Date Range → Load Registry → Collect All Sources).
  `set-dates.js` now emits `isFriday/isMonday/weekStart/weekAgo/weekdayName`.
- Collector ClickUp section is registry-tiered: Development = full active-sprint board (Review=done,
  SP rollup) + **board-hygiene** (stale_in_progress, missing_points, nothing_in_review); track spaces
  = recent 7d activity; weekly spaces folded only on Friday + always escalation-scanned (urgent/high ·
  overdue · blocker kw · Cem assigned). Slack channels tiered + **org-tagged** (weekly channels hidden
  off-Friday unless critical). `out.clickup = {daily, weekly, escalations, personal}`; `out.clickupOverdue`
  kept for Emit Signals.
- `Load Context` extended: `dev_comments` (24h from `clickup_comments`), `weekly_sp` (actor-credited,
  agent excluded via `NOT LIKE '%multica%'`), `weekly_agent` (agent_mr deliveries).
- `build-prompt.js` reorganized **by company**: cockpit (Since Yesterday · Schedule · Top Priorities ·
  Meetings) then FreshSens / GOHM / DIEFI / Personal blocks; incidents + inbox split per company;
  Friday **📊 Weekly Review** inside FreshSens.

**ClickUp Events (`4kQIG4Dhb7f5edWl`):** captures EVERY comment → `clickup_comments` (Route-by-table
via SQL `WHERE _table=...` guards on Insert Events + new Insert Comments node); org resolved from a
space→org map (fixed GOHM/DIEFI mislabel).

**Issue Router (`ICQRNBVKfn5kkMGO`) + Decision Capture (`tTq2dXFA8xc1C5uZ`):** proposals pick the
target space by registry keywords (default Management, flag ambiguous → asks Cem); on approval the task
is created in that space's active-sprint/first list (falls back to per-org Sentinel Inbox). + Load Registry.

**Chat (`jiC77CfK4B8yDtFm`):** referenced-board map built from registry routing_keywords (all spaces).
+ Load Registry (Gather Conversation → Load Registry → Gather ClickUp).

**New tables:** `clickup_comments`, `workspaces` (DDL in `infra/schema.sql`).

**Deploy/test gotchas learned:**
- n8n key: `~/.claude/settings.json` → `mcpServers.n8n-hr.env` (the `.claude.json` one is 401).
- Live Code nodes hold real secrets while repo is sanitized → deploy by **surgical string-replace of
  the changed (secret-free) block** inside the live `jsCode`, never a full overwrite (collector, ledger,
  router, chat, execute-approval all done this way). build-prompt/set-dates have no secrets → safe full
  overwrite. Helper: `/tmp/.../n8n.py` (get/put/run-sql with browser UA + settings-allowlist).
- To test the briefing without side effects: set `disabled:true` on Insert Signals / Execute Mail
  Cleaning / Send to Cem / Store Briefing / Trigger Queue, trigger `sentinel-test-trigger-001`, read the
  execution's node outputs, then re-enable. (Capture the exec by id>base & finished — the analyst step is slow.)

---

## 10. Briefing v3 — prioritization overhaul (built 2026-07-02)

Trigger: Cem's feedback — "not happy with report quality, cannot prioritize my tasks." Audit found:
his DM focus was NEVER captured (0 msgs in 12 runs — thread replies invisible to
`conversations.history`), continuity/day-counts were LLM-guessed from prose, 49 overdue Cem-tasks
were collected but had no output section, no links, no goal alignment, 1200-word cap ignored daily.

**Changes (all live in `UR3IjaOiHX0guopW`, repo synced):**
- **collector.js** — cemChat now walks DM *threads* via `conversations.replies` (top 6 threads,
  last 3 days, timestamps); meeting-notes **gap alarm** (≥2 meetings yesterday + 0 notes → errors);
  `spaceTasks` takes `sinceMs` (Home/personal fetches ALL open, `sinceMs:0`); sprint fallback
  prefers most recently *started* list (was: farthest future).
- **Load Context** (PG) — added `(SELECT left(doc,3000) FROM roadmap WHERE id=1) AS roadmap`.
- **build-prompt.js (v3)** — renders: 2026 GOALS block; **OPEN ISSUE LEDGER** from
  `last_briefing.open_issues` with day-counts computed in code (`first_seen` → "day N");
  Slack links `<url|text>` on all tasks/emails (Gmail deep links via
  `mail.google.com/mail/?authuser=<acct>#all/<id>`); overdue total. New output template:
  cockpit = 🎯 YOUR DAY (3–5 personal actions, rubric: prod impact → external deadline →
  unblocks person → 2026 goal; links + ⏱; ≤60 min) · 🔁 Since Yesterday (ledger-driven) ·
  📌 Schedule · 🔥 Top Priorities (goal tags [G: …]/[off-roadmap]) · ⏳ Overdue top-3 with
  do/reschedule/delegate verdicts (+ Friday sweep) · 🗣️ Meetings. Cockpit ≤400 words, total ≤1100.
  JSON contract now structured: `{"open_issues":[{title, org, severity, owner, next_action,
  first_seen}]}` — first_seen carried verbatim day-to-day (ledger discipline in prompt).
- **parse-output.js** — normalizes ledger entries (tolerates strings/missing fields;
  first_seen defaults to today; max 20).
- **send-to-slack.js** — splits at the first `───────────` divider: cockpit = main DM message
  (+ "_🧵 full company detail in the thread_"), company blocks = threaded replies.

**Deploy notes:** collector + send-to-slack patched via surgical block replacement (live nodes
carry real secrets); build-prompt/parse-output full overwrite; Load Context query PUT. Tested via
`sentinel-test-trigger-001` with the 5 side-effect nodes disabled, then re-enabled.

**Known follow-ups (in todo.md):** meeting-notes pipeline reliability (root cause), transcript
decision log (principle #4), `/focus` command, split analyst (per-company extraction + synthesis),
fallback LLM credential.

### §10.1 — v3.1 fixes from Cem's first-feedback round (2026-07-02, same day)
Cem's feedback on the first live v3 briefing:
1. **Email "safety net" REMOVED** — his contract is *inbox = needs something; archived = read AND
   handled (task created / delegated / skipped) = DONE*. Re-surfacing archived mail (DocuSign
   off-time form, THRIVE finalist thread) put handled items back on the board. Collector now
   fetches `in:inbox` ONLY (also stops archived mail leaking into signals/triage queue);
   all SAFETY NET / FSX / GOX rendering and prompt language deleted.
2. **NO-DUPLICATION rule** — an item appears in exactly ONE cockpit section (precedence:
   YOUR DAY > Top Priorities > Overdue > Schedule > Since Yesterday); company blocks may not
   restate cockpit items ("İsmail Abi salary" had appeared 3×).
3. **Cockpit tightened to ≤300 words** (was 400 target, 517 actual → cockpit spilled into the
   thread and Cem asked whether the report was "divided in half"). Schedule = one line per
   meeting; total briefing cap 1000 words. Cockpit must fit ONE Slack message.
