# Sentinel · Daily Briefing

n8n workflow that assembles a single, prioritized morning briefing for Cem Ayyildiz
(CTO of FreshSens, GM of GOHM, lead on the DIEFI EU project) and delivers it to his
Slack DM at 07:00 Istanbul.

> **Secrets are redacted** in this repo (`__N8N_API_KEY__`, `__SLACK_BOT_TOKEN__`,
> `__GOOGLE_REFRESH_TOKEN__`, etc.). Real values live in the n8n credential store and
> in the gitignored `credentials/` directory. Fill them in before running `deploy.py`.

## Pipeline

```
Schedule (07:00 Istanbul) ─┐
Webhook (on-demand test)  ─┴─► Set Date Range ─► Collect All Sources ─► Build AI Prompt
   ─► Claude: Synthesize (LangChain chain + Claude CLI model) ─► Format Message ─► Send to Cem
```

One **Collect All Sources** Code node gathers everything, each source wrapped in its own
`try/catch` so a single failure never kills the briefing. All I/O uses
`this.helpers.httpRequest` with refresh tokens / API keys — native n8n credential nodes
proved unreliable (calendar param errors, Slack `restricted_action_read_only_channel`).

## Data sources

| Source | What it pulls |
|---|---|
| Gmail (FS + GOHM) | Last 24h inbox, both accounts; ids/labels captured |
| Calendar (FS + GOHM) | Yesterday → today events from primary calendars |
| Meeting notes | Gemini "Notes by Gemini" Google Docs in Drive, since yesterday (summary extract) |
| Slack | Auto-discovers **every** channel the bot is a member of (public + private) |
| ClickUp (FS, GOHM, DIEFI) | Team activity per project/space (✓shipped / •in-flight + who) **and** Cem's overdue |

## Briefing sections

Today's Schedule (each meeting tagged 🔴 must-attend / 🟡 optional / ⚪ routine) ·
Top Priorities · From Yesterday's Meetings · Team Pulse by project ·
Emails Needing a Reply · Risks & Signals · Quick Wins · Archive Suggestions.

## Email archive — list-only (for now)

"Archive Suggestions" currently only **lists** FYI/automated emails that are safe to
archive (DMARC reports, receipts, no-reply notifications — never starred / important /
needs-reply). Nothing is modified yet. Phase 2 (once trusted): archive =
`messages.modify` removing the `INBOX` label + adding a `Sentinel/FYI-Archived` label.
**Never deletes** — archive is reversible.

## Slack delivery

Posts to Cem's DM. Slack caps messages ~4000 chars, so the briefing is chunked at
paragraph boundaries and any overflow is posted as threaded replies.

## Files

- `collector.js` — Collect All Sources node
- `build-prompt.js` — Build AI Prompt node
- `format-message.js` — Format Message node
- `send-to-slack.js` — Send to Cem node (chunk + thread)
- `deploy.py` — rebuilds/activates the workflow via the n8n public API and fires a test run
