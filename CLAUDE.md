# CLAUDE.md — how to work on Sentinel

Sentinel is Cem Ayyildiz's personal AI chief-of-staff: n8n workflows on `https://flow.gohm.tech`
backed by Postgres (`sentinel-pg`) and a Claude CLI LLM node. Cem = CTO of FreshSens, GM of GOHM,
lead on DIEFI. **Read `SENTINEL_STATUS.md` first** — it is the single source of truth (workflow
IDs, external IDs, gotchas, deploy pattern). `SENTINEL_DESIGN.md` = architecture rationale;
`todo.md` = roadmap; `workflows/README.md` = per-workflow catalog.

## Design principles (non-negotiable)
1. **Exception-based, not comprehensive** — surface anomalies, never status dumps.
2. **Close the loop** — track action items from meetings through ClickUp to completion.
3. **Two altitudes** — technical depth for the FreshSens CTO hat, business altitude for GOHM GM.
4. **Decision log** — technical decisions from meetings captured with rationale (still unbuilt).
5. **Trust-safe** — never delete or auto-archive anything; Cem curates his own inbox. Label/propose only.

## The one rule that bites: repo is sanitized, live carries secrets
Workflow source in `workflows/sentinel-*/` has every secret replaced by placeholders
(`__SLACK_BOT_TOKEN__`, `__GOOGLE_REFRESH_TOKEN__`, `__CLICKUP_API_KEY__`, …). The LIVE n8n Code
nodes contain the real values. Therefore:
- **Never full-overwrite a live node whose repo file contains a placeholder** (collector.js,
  send-to-slack.js, …). Deploy by **surgical string-replace of the changed, secret-free block**
  inside the live `jsCode`, verifying the old block occurs exactly once first.
- Secret-free files (build-prompt.js, parse-output.js, set-dates.js) may be fully overwritten.
- Before every commit: `grep -rE 'pk_54229113_|xoxb-|GOCSPX-' --exclude-dir=.git .` must be clean.

## n8n API access
- Base `https://flow.gohm.tech/api/v1`; the **valid** `N8N_API_KEY` is in
  `~/.claude/settings.json → mcpServers.n8n-hr.env` (the copy in `~/.claude.json` is stale → 401).
- Always send a browser `User-Agent` (Cloudflare blocks urllib's default with error 1010).
- PUT bodies: only `name, nodes, connections, settings`, and settings filtered to the schema
  allowlist (see SENTINEL_STATUS §2). Executions API doesn't sort reliably — sort by `int(id)` desc.
- A reusable deploy script pattern lives in past sessions' scratchpads; rebuild from
  SENTINEL_STATUS §9/§10 notes if needed.

## Testing the Daily Briefing without spamming Cem
1. PUT the workflow with `disabled: true` on: Insert Signals, Execute Mail Cleaning, Send to Cem,
   Store Briefing, Trigger Queue (disabled nodes pass data through, downstream still runs).
2. `GET https://flow.gohm.tech/webhook/sentinel-test-trigger-001` (fires a full run).
3. Poll `/executions?workflowId=UR3IjaOiHX0guopW`, fetch with `includeData=true`, inspect node
   outputs (Collect All Sources → Build Analyst Prompt → Sentinel Analyst → Parse Analyst Output).
4. Re-enable the five nodes (PUT again). The analyst LLM step takes 1–3 min.

## Ad-hoc SQL
Repurpose the **`Sentinel · DB Test`** workflow (`wefU83D11JiQ44I6`): set its PG node query via the
API, `GET webhook/sentinel-db-test-001`, read the execution output. Postgres credential id
`1TBwe9uebXBQKUhV`; admin port is host-only on the server (`127.0.0.1:5433`).

## LLM
Use the Claude CLI LangChain node (credential `xEpaYqT9ncGcZwHj`, "Tunahan Chatbot · Claude CLI").
**The direct Anthropic API key is out of credits — do not use it.** Single point of failure; a
fallback credential is on the todo list.

## Key IDs (full list in SENTINEL_STATUS §3–4)
- Daily Briefing workflow `UR3IjaOiHX0guopW` (cron 02:30 UTC = 05:30 Istanbul).
- Cem: Slack `UEL80DGQ5`, DM channel `D0BBRKKPGUE`, ClickUp `54229113`.
- ClickUp teams: FreshSens `9009068877`, GOHM `42085420`, DIEFI `9014647941`.
- Registry: `infra/workspaces.json` → `workspaces` table (`infra/sync-workspaces.py --emit-sql`).

## Briefing v3 contract (2026-07-02)
The analyst outputs prose + a fenced JSON **open-issue ledger**:
`{"open_issues":[{title, org: fs|gohm|diefi|personal, severity, owner, next_action, first_seen}]}`.
`first_seen` must be carried unchanged day-to-day — ages ("day N") are computed in
build-prompt.js from stored state, never re-derived by the LLM. The cockpit (YOUR DAY · Since
Yesterday · Schedule · Top Priorities · Overdue · Meetings) is the main Slack message; company
blocks go to the thread (split at the first `───────────` divider in send-to-slack.js).

## Memory
Session memory index: `~/.claude/projects/-home-cem-temp-sentinel/memory/MEMORY.md`. Update the
`sentinel-briefing-workflow` memory when the briefing architecture changes.

## Habits
- Always update `todo.md` + `SENTINEL_STATUS.md` when shipping; commit and push after each work unit.
- **After each completed change round to the briefing: fire a real run**
  (`GET …/webhook/sentinel-test-trigger-001`) so Cem sees the fresh report in his DM and can give
  feedback. Use the safe-test pattern (nodes disabled) only for intermediate verification.
- Never let Sentinel act destructively: propose, label, ask — Cem approves via Slack.
- Mail contract: inbox = needs something; archived = read AND handled — never resurface archived
  mail anywhere (briefing, signals, queue).
