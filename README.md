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

A 9-node pipeline (one n8n workflow, `Sentinel · Daily Briefing`):

```
Schedule 07:00 ─┐
Webhook (test) ─┴► Set Date Range ► Collect All Sources ► Recall Yesterday
   ► Build Analyst Prompt ► Sentinel Analyst (Claude) ► Parse Analyst Output
   ► Execute Mail Cleaning ► Send to Cem
```

| Stage | What it does |
|---|---|
| **Collect All Sources** | One node, per-source `try/catch`, pulls every data source below. |
| **Recall Yesterday** | Reads the previous briefing from the DM → continuity. |
| **Build Analyst Prompt** | Numbers inbox emails with stable tags (`FS3`, `GO5`) so the model references them safely; builds a deep analytical prompt with the org map. |
| **Sentinel Analyst** | Claude produces the briefing prose **plus** a machine-readable JSON actions block. |
| **Parse Analyst Output** | Splits prose from actions; maps archive tags → real Gmail message IDs (no hallucinated IDs). |
| **Execute Mail Cleaning** | Archives flagged FYI email (remove `INBOX` + add `Sentinel/FYI-Archived`). Reversible, never deletes. |
| **Send to Cem** | Posts to the Slack DM; chunks long briefings at paragraph boundaries with overflow as threaded replies. |

> **Design choice:** everything uses Code nodes + `this.helpers.httpRequest` with refresh tokens / API keys, because n8n's native credential nodes proved unreliable. Each source is isolated so one failure never kills the briefing.

Deep detail and the (secret-redacted) node source live in
[`workflows/sentinel-daily-briefing/`](workflows/sentinel-daily-briefing/).

---

## Data sources

| Source | Detail |
|---|---|
| **Gmail** | FreshSens (`ca@freshsens.ai`) + GOHM (`cem.ayyildiz@gohm.tech`) — ~25 inbox emails/account with triage signals (category, bulk, automated). |
| **Calendar** | Both accounts' primary calendars, yesterday → today. |
| **Meeting notes** | Gemini "Notes by Gemini" Google Docs in Drive (both accounts), since yesterday — summary extract for real meeting context. |
| **Slack** | Auto-discovers **every channel the bot belongs to** (currently 25: 6 public + 19 private). Invite `@sentinel` to a channel and it appears in the next briefing automatically. |
| **ClickUp** | FreshSens (`9009068877`), GOHM (`42085420`), DIEFI (`9014647941`) — team activity per project + Cem's personal overdue. Plus the GOHM **Home** space for personal/smart-home items. |

---

## How the briefing is organized

The prose briefing has these sections:

1. **🔁 Since Yesterday** — continuity (still-open / resolved / new)
2. **📌 Today's Schedule** — each meeting tagged 🔴 must-attend / 🟡 optional / ⚪ routine, conflicts resolved
3. **🔥 Top Priorities** — ranked, cross-referenced, tagged [FS]/[GOHM]/[DIEFI]
4. **🚨 Issues & Incidents** — Slack alarms/errors correlated into incidents (severity + root-cause hypothesis + owner)
5. **🗣️ From Yesterday's Meetings** — decisions/actions from the Gemini notes
6. **🏭 FreshSens — Team Progress** — Backend, Frontend, ML, Firmware, Hardware, Postharvest, Operations, Sales
7. **🛰️ GOHM — Projects** — Robust6G (incl. WP6), DIEFI, 6G-QTrust (incoming)
8. **🏠 Personal / Smart Home** — Loxone + house items
9. **📨 Inbox Triage** — reply / delegate / archive
10. **✅ Quick Wins** + **🧹 Mail Cleaning** summary

### Org structure it organizes around
- **FreshSens** (CTO) — no funded projects yet; *ZedCadit* incoming. Reported by 8 functional teams.
- **GOHM** (GM) — funded R&D projects: **Robust6G** (ClickUp ROBUST-6G + WP6 spaces), **DIEFI** (own ClickUp team), **6G-QTrust** (incoming).
- **Personal / Smart Home** — GOHM ClickUp "Home" space (Loxone Miniserver + house renovation).

---

## Capabilities summary

| Capability | Status |
|---|---|
| Daily multi-source briefing | ✅ live (07:00 Istanbul) |
| Day-over-day continuity | ✅ live |
| Issue correlation into incidents | ✅ live |
| Per-team / per-project progress | ✅ live |
| Inbox triage (reply/delegate/archive) | ✅ live |
| Mail auto-archiving (reversible, guarded) | ✅ live |
| Draft replies | ⬜ planned |
| Auto-create tasks from meeting actions | ⬜ planned |
| Two-way (ask Sentinel / delegate to it) | ⬜ planned |

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
├── README.md                         ← this file
├── todo.md                           ← roadmap & status
├── scripts/                          ← one-time OAuth setup helpers
│   ├── gmail-auth.sh
│   └── calendar-auth.sh
├── workflows/
│   └── sentinel-daily-briefing/      ← the workflow (secret-redacted source)
│       ├── README.md
│       ├── collector.js
│       ├── recall-yesterday.js
│       ├── build-prompt.js
│       ├── parse-output.js
│       ├── execute-mail-cleaning.js
│       ├── send-to-slack.js
│       └── deploy.py
└── credentials/                      ← gitignored (OAuth tokens, keys)
```

Runs on n8n at `flow.gohm.tech`. `deploy.py` rebuilds/activates the workflow via the n8n public API (fill in the redacted secrets first).
