# Sentinel · Daily Briefing

n8n workflow that acts as a chief-of-staff analyst for Cem Ayyildiz (CTO of FreshSens,
GM of GOHM, lead on the DIEFI EU project): every morning at 07:00 Istanbul it gathers
his world, reasons over it, triages his inbox, checks for incidents, and DMs him a
prioritized briefing — with day-over-day continuity.

> **Secrets are redacted** in this repo (`__N8N_API_KEY__`, `__SLACK_BOT_TOKEN__`,
> `__GOOGLE_REFRESH_TOKEN__`, etc.). Real values live in the n8n credential store and the
> gitignored `credentials/` directory. Fill them in before running `deploy.py`.

## Pipeline (multi-stage analyst)

```
Schedule 07:00 ─┐
Webhook (test) ─┴► Set Date Range ► Collect All Sources ► Recall Yesterday
   ► Build Analyst Prompt ► Sentinel Analyst (Claude) ► Parse Analyst Output
   ► Execute Mail Cleaning ► Send to Cem
```

| Node | Job |
|---|---|
| **Collect All Sources** | One Code node, per-source `try/catch`. Gmail (FS+GOHM, ~25 inbox each with triage signals), Calendar, Gemini meeting notes from Drive, all Slack channels the bot is in (public+private), ClickUp activity + Cem's overdue across FS/GOHM/DIEFI. |
| **Recall Yesterday** | Reads the last briefing from Cem's Slack DM → continuity (what's still open / resolved / new). |
| **Build Analyst Prompt** | Numbers every inbox email with a stable tag (`FS3`, `GO5`) so the model can reference them for archiving without hallucinating IDs. Builds a deep analytical prompt. |
| **Sentinel Analyst** | LangChain `chainLlm` + Claude CLI model. Produces the briefing prose **and** a fenced `json` ACTIONS block (`archive_tags`, `open_issues`). |
| **Parse Analyst Output** | Splits prose from the JSON block; maps `archive_tags` → real `{account, id}` via the email index. |
| **Execute Mail Cleaning** | Archives the flagged FYI emails (remove `INBOX` + add `Sentinel/FYI-Archived`). **Gated by `ARCHIVE_ENABLED` (default false = propose-only).** Never deletes. |
| **Send to Cem** | Posts to the DM; chunks at ~3800 chars with overflow as threaded replies. |

## Briefing sections

🔁 Since Yesterday (continuity) · 📌 Today's Schedule (each meeting tagged
🔴 must-attend / 🟡 optional / ⚪ routine, conflicts resolved) · 🔥 Top Priorities ·
🚨 Issues & Incidents (Slack alarms/errors correlated into incidents with severity +
root-cause hypothesis + owner) · 🗣️ From Yesterday's Meetings · 👥 Team Pulse by project
(bottleneck/stall detection) · 📨 Inbox Triage (reply / delegate / archive) ·
✅ Quick Wins · 🧹 Mail Cleaning.

## Design notes

- **Code nodes + `this.helpers.httpRequest` everywhere** — native n8n credential nodes
  proved unreliable (calendar param errors, Slack `restricted_action_read_only_channel`).
- **Continuity has no separate datastore** — yesterday's state is just the previous DM
  briefing, re-read each morning. Open issues are embedded so they carry forward.
- **Safe-by-design archiving** — the model proposes by email *tag*; code maps tags to
  real message IDs (no hallucinated IDs), and archiving is reversible + gated off by default.

## Files

`collector.js` · `recall-yesterday.js` · `build-prompt.js` · `parse-output.js` ·
`execute-mail-cleaning.js` · `send-to-slack.js` · `deploy.py` (rebuilds/activates via the
n8n public API and fires a test run).
