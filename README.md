# Sentinel

A personal **chief-of-staff AI** for Cem Ayyildiz — CTO of FreshSens, GM of GOHM, and lead on the DIEFI EU research project.

Every morning at **07:00 Istanbul**, Sentinel gathers Cem's entire working world (email, calendar, meeting transcripts, team Slack, and task boards across three organizations), reasons over it like an analyst, triages the inbox, checks for incidents, and delivers a single prioritized briefing to his Slack DM — with day-over-day continuity and real actions (it cleans the inbox).

It is built as an **n8n workflow** driven by Claude, with all integrations done through direct API calls.

---

## What it does

- **Reads everything** — both Gmail inboxes, both calendars, Gemini meeting notes from Drive, every Slack channel it's in (public + private), and ClickUp across FreshSens / GOHM / DIEFI.
- **Reasons, doesn't summarize** — correlates signals across sources (e.g. an API outage → cascading backend 500s), weighs what matters, and ranks priorities.
- **Tracks continuity** — compares against yesterday's briefing: what's still open (and now riskier), what resolved, what's new.
- **Organizes by your real structure** — FreshSens by functional team, GOHM by funded project, plus a personal/smart-home view.
- **Triages the inbox** — every email gets a disposition: reply / delegate / archive.
- **Acts** — archives FYI email (reversible, never deletes), with a security guardrail.

---

## Architecture

Sentinel is a set of **n8n workflows** backed by **Postgres** and a **Claude CLI** node. The whole
system is a loop: **signal → decide → act → learn → (smarter next signal)**. A **workspace registry**
(`infra/workspaces.json` → Postgres) tells every workflow how each ClickUp space / Slack channel / Gmail
rule should be reported and routed.

```mermaid
flowchart TB
    subgraph SRC["📥 Sources"]
      direction LR
      GM["Gmail ×2"]
      CAL["Calendar ×2"]
      NOTES["Gemini notes"]
      SL["Slack (all channels)"]
      CU["ClickUp FS · GOHM · DIEFI"]
    end

    REG[("🗂️ Workspace Registry<br/>cadence · depth · routing")]
    PG[("🗄️ Postgres<br/>signals · decisions · outcomes<br/>briefings · profile · actions<br/>clickup_events · clickup_comments")]

    SRC --> BRIEF["☀️ Daily Briefing — 07:00<br/>collect · tier by registry · reason"]
    REG -. tiers / depth .-> BRIEF
    BRIEF --> PG
    BRIEF --> DM["💬 Slack DM<br/>company-grouped briefing"]

    DM --> QUEUE["🎚️ Decision Queue<br/>learning-gated triage"]
    QUEUE --> CAP["✅ Decision Capture<br/>reaction / reply → verdict"]
    CAP --> PG
    PG -. recent decisions + profile .-> BRIEF
    PG --> PROF["🧠 Profile (weekly)<br/>rewrite how-Cem-decides"]
    PROF --> PG

    CAP --> ROUTER["📋 Issue Router<br/>draft → registry-route → approve"]
    REG -. target space .-> ROUTER
    ROUTER --> TASK["🆕 ClickUp task"]
    CAP --> MAIL["🧹 Mail Cleaner<br/>archive skips (reversible)"]

    CU --> LEDGER["📒 ClickUp Events (webhook)<br/>status · assignee · comments"]
    LEDGER --> PG
    DM <--> CHAT["🤖 Chat — ask Sentinel"]
    REG -. boards .-> CHAT
    PG --> ROAD["🗺️ Roadmap Report (weekly)<br/>2026 goals vs ClickUp"]
    ROAD --> DM
```

- **Daily Briefing** (07:00 IST) gathers everything, tiers ClickUp/Slack by the registry, reasons like an
  analyst, and DMs a company-grouped briefing — pre-classifying new items by how Cem has decided before.
- **Decision Queue → Capture → Profile** is the learning loop: surfaced items get a verdict (reaction/reply);
  verdicts become a compact profile that sharpens tomorrow's triage.
- **Issue Router** turns decisions into registry-routed ClickUp tasks (Cem approves with ✅).
- **ClickUp Events** ledger captures live status/assignee/comment changes (exact weekly story points + the
  daily "new comments" view). **Chat** answers "who's doing what?". **Roadmap Report** tracks 2026 goals.

> **Design choice:** Code nodes + `this.helpers.httpRequest` with refresh tokens / API keys throughout
> (native n8n credential nodes proved unreliable); each source is isolated so one failure never kills the run.

The full per-workflow catalog (triggers, flows, IDs, files) lives in
[`workflows/README.md`](workflows/README.md); architecture rationale in
[`SENTINEL_DESIGN.md`](SENTINEL_DESIGN.md).

---

## Data sources

| Source | Detail |
|---|---|
| **Gmail** | FreshSens (`ca@freshsens.ai`) + GOHM (`cem.ayyildiz@gohm.tech`) — ~25 inbox emails/account with triage signals (category, bulk, automated). |
| **Calendar** | Both accounts' primary calendars, yesterday → today. |
| **Meeting notes** | Gemini "Notes by Gemini" Google Docs in Drive (both accounts), since yesterday — summary extract for real meeting context. |
| **Slack** | Auto-discovers **every channel the bot belongs to** (currently 25: 6 public + 19 private). Invite `@sentinel` to a channel and it appears in the next briefing automatically. |
| **ClickUp** | FreshSens (`9009068877`), GOHM (`42085420`), DIEFI (`9014647941`) — **registry-tiered**: Development as a full sprint board (Review=done, story points, hygiene), Management/GOHM/DIEFI daily, Sales/Team-Leads/Fundraising weekly, plus live task comments + Cem's overdue + villakurt (smart-home). |

---

## How the briefing is organized

The prose briefing is **grouped by company**: a short cross-org cockpit, then one
self-contained block per company.

**Cockpit (cross-org):**
1. **🔁 Since Yesterday** — continuity (still-open / resolved / new)
2. **📌 Today's Schedule** — one timeline, each meeting tagged 🔴/🟡/⚪ and [FS]/[GOHM]/[DIEFI]
3. **🔥 Top Priorities** — ranked across all orgs, escalations pulled in
4. **🗣️ From Yesterday's Meetings** — decisions/actions from the Gemini notes

**Per-company blocks:**
- **🏭 FreshSens** — Development by team (ML/HW/FW/Backend/Software/PH) + new task comments +
  **board-hygiene** nudge; Management; FreshSens incidents; FreshSens inbox triage; (Fridays)
  **📊 Weekly Review** — completed issues + story points per person + Multica agent deliveries
- **🛰️ GOHM** — projects (Management hub · Robust6G · Q-TRUST6G); GOHM incidents; GOHM inbox
- **🔬 DIEFI** — progress, deliverable deadlines, Cem's actions
- **🏠 Personal / Smart Home** — villakurt (Loxone + house) items
- **✅ Quick Wins** + **🧹 Mail Cleaning** summary

### Registry-driven cadence & tiering
A **workspace registry** (`infra/workspaces.json` → Postgres `workspaces`) is the single source of
truth for how each ClickUp space, Slack channel, and Gmail rule is reported:
- **Cadence** — `daily` (Development, Management, GOHM, DIEFI), `weekly-fri` (Sales/Marketing/PH&Ops,
  Team Leads, Fundraising — folded into Friday), or `mute`. Items in weekly/muted spaces still
  escalate into the daily when critical (urgent/high · overdue · blocker · Cem-assigned).
- **Depth** — `deep` (full sprint board + comments + hygiene), `track`, or `summary`.
- **Routing** — keywords route Sentinel-created issues to the right space (default Management).

Edit the JSON, run `infra/sync-workspaces.py`, and the briefing, issue router, and chat all pick it up.

---

## Capabilities summary

| Capability | Status |
|---|---|
| Daily multi-source briefing (company-grouped) | ✅ live (07:00 Istanbul) |
| Day-over-day continuity | ✅ live |
| Issue correlation into incidents | ✅ live |
| Registry-driven cadence/tiering (daily/weekly/escalation) | ✅ live |
| ClickUp board hygiene flags (stale / missing points / no review) | ✅ live |
| Live task-comment capture + daily progress view | ✅ live |
| Weekly story points per person + agent deliveries (Fridays) | ✅ live |
| Inbox triage (reply/delegate/archive) + mail auto-archiving | ✅ live |
| Learning loop (decisions → profile → pre-classification) | ✅ live |
| Slack-approved issue creation, registry-routed | ✅ live |
| Chat assistant (ask Sentinel) | ✅ live |
| Draft replies | ⬜ planned |
| Auto-create tasks from meeting actions | ⬜ planned |

See [`todo.md`](todo.md) for the full roadmap.

---

## Security model

- **No secret is committed.** `credentials/`, `.mcp.json`, and local settings are gitignored. The workflow source in this repo has every secret redacted (`__GOOGLE_REFRESH_TOKEN__`, `__SLACK_BOT_TOKEN__`, etc.); real values live only in the n8n credential store and the local `credentials/` directory.
- **Archiving never deletes.** It removes the `INBOX` label and applies `Sentinel/FYI-Archived` — everything stays in All Mail and is one click from being restored.
- **Security guardrail.** Login / password / verification / payment-failure notices are never archived; they stay in the inbox.
- **Slack is read-only** in the channels — Sentinel only posts to Cem's DM.

---

## Repository layout

```
sentinel/
├── README.md                  ← this file (overview + architecture)
├── SENTINEL_DESIGN.md         ← architecture & rationale (diagrams)
├── SENTINEL_STATUS.md         ← live status, IDs, gotchas, handoff (§9 = registry/cadence)
├── todo.md                    ← roadmap & status
├── scripts/                   ← one-time OAuth setup helpers (gmail/calendar)
├── infra/
│   ├── schema.sql             ← Postgres schema
│   ├── workspaces.json        ← workspace registry (cadence/depth/routing — source of truth)
│   ├── sync-workspaces.py     ← sync the registry into the `workspaces` table
│   ├── refresh-roadmap.py     ← refresh the 2026 roadmap from Miro
│   └── SERVER_SETUP.md        ← server / Postgres / Slack-app setup
├── workflows/
│   ├── README.md              ← workflow catalog (all workflows, triggers, flows, IDs)
│   └── sentinel-*/            ← per-workflow secret-redacted source + deploy.py
└── credentials/               ← gitignored (OAuth tokens, keys)
```

Runs on n8n at `flow.gohm.tech`. Each workflow's `deploy.py`/`build.py` rebuilds/activates it via the
n8n public API (fill in the redacted secrets first). See [`workflows/README.md`](workflows/README.md).
