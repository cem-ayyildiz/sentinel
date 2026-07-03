# Sentinel — Workflow Catalog

Every Sentinel capability is an **n8n workflow** on `https://flow.gohm.tech`, driven by Claude
(via the `claude-cli` node) with all integrations done through Code nodes + `this.helpers.httpRequest`
(native credential nodes proved unreliable). Source for each lives in its folder here, **secret-redacted**
(`__SLACK_BOT_TOKEN__`, `__GOOGLE_REFRESH_TOKEN__`, `__CLICKUP_API_KEY__`, `__N8N_API_KEY__`, …) — real
values live only in the n8n credential store / gitignored `credentials/`.

> Architecture rationale: [`../SENTINEL_DESIGN.md`](../SENTINEL_DESIGN.md) · live status, IDs & gotchas:
> [`../SENTINEL_STATUS.md`](../SENTINEL_STATUS.md) · schema: [`../infra/schema.sql`](../infra/schema.sql).

## Inventory

| Workflow | id | Trigger | Purpose |
|---|---|---|---|
| **Ingest** | `k3rAxpxlhVFrD8fp` | webhook `sentinel-ingest` | Front door: normalize + hash-dedup any Signal into Postgres `signals`. |
| **Daily Briefing** | `UR3IjaOiHX0guopW` | cron `30 2 * * *` (05:30 IST) + `sentinel-test-trigger-001` | Collect all sources → store signals → company-grouped briefing to Slack DM. |
| **Decision Queue** | `zV37n3aaFQxMD0sd` | webhook `sentinel-postqueue` | Learning-gated triage: pre-classify vs profile, auto-skip noise, surface ≤5. |
| **Decision Capture** | `tTq2dXFA8xc1C5uZ` | webhook `sentinel-slack-events` | Slack reactions/replies → decisions; handles issue approvals; routes chat. **Cem-only.** |
| **Profile** | `tvUyWOphKOHpR6Wi` | cron `0 17 * * 0` + `sentinel-profile-test` | Weekly: rewrite the learned "how Cem decides" profile. |
| **Mail Cleaner** | `scMAvwvO967CgDSh` | webhook `sentinel-clean-mail` | Archive `skip`-verdict emails (remove INBOX + add `Sentinel/FYI-Archived`). Never deletes. |
| **Roadmap Report** | `7IMt0zEgyJyp8It2` | cron `0 5 * * 1` (Mon 08:00 IST) + `sentinel-roadmap` | Correlate 2026 Miro goals vs ClickUp → goal-by-goal status. |
| **Issue Router** | `ICQRNBVKfn5kkMGO` | webhook `sentinel-issue-router` | delegate/do_later decisions → drafted, registry-routed ClickUp tasks → Slack approval. |
| **Chat** | `jiC77CfK4B8yDtFm` | webhook `sentinel-chat` | DM Q&A + commands ("who's doing what?", create task, comment). |
| **ClickUp Events (ledger)** | `4kQIG4Dhb7f5edWl` | webhook `sentinel-clickup-events` | Capture status/assignee/comment changes → `clickup_events` + `clickup_comments`. |
| **DB Test** | `wefU83D11JiQ44I6` | webhook `sentinel-db-test-001` | Throwaway SQL/DDL runner (set query → trigger → read execution). Not user-facing. |

`<workflow>/deploy.py` (or `build.py`) rebuilds/activates a workflow via the n8n public API. Fill the
redacted secrets first. The **workspace registry** ([`../infra/workspaces.json`](../infra/workspaces.json)
→ Postgres `workspaces`, synced by `../infra/sync-workspaces.py`) drives cadence/depth/routing for the
briefing, issue router, and chat — a `Load Registry` Postgres node feeds each.

---

## Ingest (`sentinel-ingest/`)
Shared entry point for the Signal store. Any adapter (built-in, MCP, Multica) POSTs a Signal (or an array
/ `{signals:[…]}`); `Normalize & Hash` → Postgres insert `ON CONFLICT (content_hash) DO NOTHING`.
`content_hash` = `source:source_ref` if a stable ref exists, else a djb2 hash of `title|body`.
Files: `normalize.js`.

## Daily Briefing (`sentinel-daily-briefing/`)
The chief-of-staff analyst. 05:30 Istanbul → prioritized briefing to the DM, with day-over-day continuity.

```
Schedule 07:00 ─┐
Webhook (test) ─┴► Set Date Range ► Load Registry ► Collect All Sources ─┬► Emit Signals ► Insert Signals
                                                                         └► Load Context (Postgres)
   ► Build Analyst Prompt ► Sentinel Analyst (Claude) ► Parse Analyst Output ► Execute Mail Cleaning ─┬► Send to Cem
                                                                                                      └► Store Briefing
```
- **Collect All Sources** — one Code node, per-source try/catch: Gmail (FS+GOHM), Calendar, Gemini meeting
  notes (Drive), all Slack channels (registry-tiered + org-tagged), **registry-tiered ClickUp** (Development
  = full sprint board with Review=done + SP rollup + board-hygiene flags; Management/GOHM/DIEFI daily;
  Sales/Team-Leads/Fundraising weekly on Friday + critical escalation any day).
- **Load Context** — `decision_profile` + recent `decisions` + last `briefings` row + last-24h
  `clickup_comments` + weekly per-person SP + agent deliveries.
- **Build Analyst Prompt** — company-grouped output (cockpit + FreshSens/GOHM/DIEFI/Personal); numbers
  inbox emails with stable tags (`FS3`/`GO5`) so the model references them for archiving without hallucinating IDs.
- **Execute Mail Cleaning** — archives flagged FYI emails (gated by `ARCHIVE_ENABLED`; never deletes).
- **Send to Cem** — chunks at ~3800 chars, overflow as threaded replies.

Files: `set-dates.js` · `collector.js` · `emit-signals.js` · `build-prompt.js` · `parse-output.js` ·
`execute-mail-cleaning.js` · `send-to-slack.js` · `deploy.py`.

## Decision Queue (`sentinel-decision-queue/`)
Posts the triage queue to the DM, but first runs Cem's **learned profile** as a gate so taught-skip noise
never reaches the board. `Load Profile → Load Candidates (undecided) → Pre-Classify (Claude vs profile)
→ split`: auto-skip clear matches (recorded `decided_via='auto_rule'`, surfaced as a "🔇 Auto-handled N"
note) vs surface top ≤5 (posted **top-level** so a reaction/reply maps to the item). Triggered by the
Daily Briefing and by Decision Capture's auto-refill.
Files: `pre-classify-prompt.js` · `parse-classification.js` · `filter-autoskip.js` · `filter-surface.js` ·
`post-surfaced.js` · `notify-autoskips.js` · `build.py`.

## Decision Capture (`sentinel-decision-capture/`)
Turns a Slack reaction/reply on a queue item into a `Decision` — the learning input. `Route Event`
(challenge/reaction/reply/ignore) → reaction → `Map Verdict`, or reply → Claude `Parse Reply`
(`{verdict, reason}`, the *why* is the strongest signal) → `Upsert Decision` (matches `signals.slack_ts`,
one decision per signal `ON CONFLICT`). Also executes **issue approvals** (✅ creates the ClickUp task,
❌ rejects) and routes top-level DMs to Chat.

Emoji → verdict: ✅/👍 `do_now` · 🕒/⏳ `do_later` · 👤 `delegate_person` · 🤖 `delegate_agent` ·
👀 `watch` · 🗑️/🚫/❌ `skip`.

**Slack app setup:** Event Subscriptions → Request URL = `…/webhook/sentinel-slack-events`; subscribe to
`reaction_added` + `message.im`; add scope `reactions:read`, reinstall.
Files include `route.js` · `verdict.js` · `reply-prompt.js` · `reply-parse.js` · `approval.js` ·
`execute-approval.js` · `cleanup.js` · `refill.js` · `ask-chat.js` · `route-message.js` · `build.py`.

## Profile (`sentinel-profile/`)
Weekly (Sun 20:00 IST) compaction of the `decisions` log into a compact `decision_profile`
(`{always_skip, always_do, delegate_map}`) so briefing context stays flat. `Load Decisions (last 500)
→ Build Profile Prompt → Claude → Parse → Store Profile`. With little data, returns small/empty lists.

## Mail Cleaner (`sentinel-mail-cleaner/`)
Archives `skip`-verdict emails (from Cem or the gate). **Never deletes** — removes `INBOX`, adds
`Sentinel/FYI-Archived` (recoverable). `Load To-Archive → Archive (per-account token; modify labels)
→ Mark Archived (`signals.archived_at`, idempotent)`. Triggered by every decision + every auto-skip.

## Roadmap Report (`sentinel-roadmap-report/`)
Weekly (Mon 08:00 IST). Correlates the FreshSens **2026 roadmap** (5 strategic goals read from Miro
"FS - Tech Roadmapping" `uXjVLxVQ_qI=`, stored in the `roadmap` table) against live ClickUp activity:
goal-by-goal status (🟢🟡🔴), by-team on/off-plan, gaps & drift. Refresh the stored roadmap when Miro
changes: `../infra/refresh-roadmap.py`.

## Issue Router (`sentinel-issue-router/`)
Finds `delegate_person`/`do_later` decisions with no action yet → Claude drafts a concrete task
(title/description/assignee/due) → resolves the **target space from the registry** (keywords; default
Management; flags ambiguous → asks Cem) → posts a proposal to the DM and records it in `actions`
(`pending`). Approval/creation happens in Decision Capture (✅ creates in the chosen space's active-sprint
or first list; falls back to the per-org Sentinel Inbox).
Files: `draft-prompt.js` · `post-proposals.js`.

## Chat (`sentinel-chat/`)
Ask Sentinel in the DM ("who's doing what?", "what's pending?"). A top-level DM (vs a threaded triage
reply) is routed here by Decision Capture. `Gather Conversation → Load Registry → Gather ClickUp (live
who's-doing-what across FS/GOHM/DIEFI; referenced boards resolved from the registry) → Load Context →
Build Prompt → Claude → Post Answer`.
Files: `gather-conversation.js` · `gather-clickup.js` · `gather-mail-calendar.js` · `build-prompt.js` ·
`execute-action.js` · `post-answer.js`.

## ClickUp Events — the ledger (`sentinel-clickup-events/`)
ClickUp team webhook (`taskStatusUpdated` + `taskAssigneeUpdated` + `taskCommentPosted`) → `Parse & Enrich`
(one row per history_item/comment, tagged `_table`) → routed by SQL guards into `clickup_events` (status/
assignee/agent transitions) and `clickup_comments` (every human comment → powers the daily "new comments"
view). `org` resolved from a space→org map mirroring the registry (fixed the GOHM/DIEFI mislabel).
Captures the live SP throughput that sprint bulk-closeout makes impossible to reconstruct after the fact;
agent is identified from **comment markers** (`MR opened for review` = delivered), not the assignee field.
Auto-estimates story points on agent delivery (Claude, Fibonacci) when a task has none.
Files: `parse-enrich.js` · `need-estimate.js` · `build-sp-prompt.js` · `set-points.js`.

## DB Test (`sentinel-db-test`, no folder)
Utility: set the PG node `query`, GET `…/webhook/sentinel-db-test-001`, read the execution output. Used
to run ad-hoc SQL/DDL and to apply registry syncs (`sync-workspaces.py --emit-sql`).
