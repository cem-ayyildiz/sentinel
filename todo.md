# Sentinel — Roadmap & Status

_Last updated: 2026-07-02_

Sentinel runs Cem's 3-part vision end-to-end: cut noise (daily briefing + learning-gated
triage + mail cleaning), team roadmap/SP reports, and Slack-approved issue creation — plus a
Chat assistant. Architecture detail lives in `SENTINEL_DESIGN.md`; the running build log and all
IDs/gotchas in `SENTINEL_STATUS.md` (registry/cadence work is §9).

---

## ✅ Done (live in production)

### Morning briefing
- [x] **Daily briefing** — 07:00 Istanbul → Cem's Slack DM; day-over-day continuity
- [x] **Data sources**: FS+GOHM Gmail, FS+GOHM Calendar, Gemini meeting notes, all Slack
      channels (auto-discovered), ClickUp FS/GOHM/DIEFI
- [x] **Incident correlation** (Slack alarms → incidents), **meeting context**, **inbox triage**
- [x] **Mail auto-archiving** (reversible, security-guarded), long-message chunking

### Phase 1 — sense / decide / learn (Postgres)
- [x] **Postgres store** (`sentinel-pg`) + schema: signals, decisions, outcomes, briefings,
      decision_profile, actions, roadmap, clickup_events, **clickup_comments**, **workspaces**
- [x] **Ingest** (normalize+dedup), **Post Queue** (learning-gated triage), **Decision Capture**
      (Slack reactions/replies → verdicts), **Profile** (weekly learned "how Cem decides")
- [x] **Roadmap Report** (Mon) — 2026 Miro goals vs ClickUp
- [x] **Chat assistant** — DM Q&A + commands (board counts, create task, comment)

### Phase 2 — act (issue creation)
- [x] **Issue Router** — delegate/do_later decisions → drafted ClickUp tasks → Slack approval → create

### ClickUp / cadence optimization (2026-06-27) — see SENTINEL_STATUS §9
- [x] **Workspace registry** `infra/workspaces.json` → Postgres `workspaces` (single source of
      truth for cadence/depth/routing per ClickUp space + Slack channel + Gmail rule);
      `infra/sync-workspaces.py`
- [x] **Registry-tiered ClickUp** in the daily collector — Development daily/deep (sprint board,
      Review=done, SP rollup, **board-hygiene** flags), Management daily, GOHM/DIEFI daily,
      Sales/Team-Leads/Fundraising weekly (Fri) + critical escalation any day
- [x] **Live comment capture** — every ClickUp comment → `clickup_comments`; GOHM/DIEFI org bug fixed
- [x] **Weekly story points** — per-person (actor-credited) + Multica agent deliveries, folded into
      Friday's briefing
- [x] **Report reorganized by company** — cockpit (Since Yesterday · Schedule · Top Priorities ·
      Meetings) + FreshSens / GOHM / DIEFI / Personal blocks; incidents + inbox split per company
- [x] **Slack tiering** — channels tiered daily/weekly + org-tagged (weekly hidden off-Friday unless critical)
- [x] **Registry-driven routing** — Issue Router + Chat resolve target boards from the registry
      (default Management, ask when ambiguous)

### Briefing v3 — prioritization overhaul (2026-07-02) — see SENTINEL_STATUS §10
- [x] **🎯 YOUR DAY** — cockpit leads with Cem's personal top 3–5 actions, rubric-ranked
      (production impact → external deadline → unblocks person → 2026 goal), linked, ⏱-estimated
- [x] **Stateful open-issue ledger** — structured `open_issues` (org/severity/owner/next_action/
      first_seen) stored per briefing and fed back; day-counts computed in code, not by the LLM
- [x] **Overdue-debt triage** — top 3 of Cem's overdue tasks daily with do/reschedule/delegate
      verdicts + Friday sweep over the rest (49 overdue were previously invisible)
- [x] **2026-goal alignment** — Miro roadmap added to daily Load Context; Top Priorities carry
      [G: …] / [off-roadmap] tags
- [x] **Cem's focus actually captured** — DM *thread replies* now read (conversations.replies);
      was 0 messages in every prior run because history API skips threads
- [x] **Clickable links everywhere** — ClickUp task URLs + Gmail deep links (authuser) on every
      actionable line; LLM instructed to copy, never invent
- [x] **Cockpit = main message, company detail = thread** — send-to-slack splits at the first
      divider; cockpit hard-capped at 400 words
- [x] **Meeting-notes gap alarm** — flags "N meetings yesterday, 0 Gemini notes" instead of
      failing silently (notes were missing on most days)
- [x] **Collector fixes** — Personal/Home shows ALL open tasks (was: only touched <7d);
      sprint fallback prefers the most recently started sprint (was: farthest future)
- [x] **v3.1 (Cem's feedback, same day)** — email safety net REMOVED (archived = handled, never
      resurfaces anywhere incl. triage queue); strict no-duplication rule across cockpit sections;
      cockpit ≤300 words so it fits one Slack message (detail continues in the thread by design)
- [x] **v3.2 (second feedback round)** — cockpit partitioned by ACTOR: 🎯 YOUR DAY = Cem-actions
      only (absorbs Quick Wins as ⚡ items) · 📡 RADAR = others' actions with owner + intervene-if
      (replaces Top Priorities — same-rubric twin sections were the structural cause of duplicates);
      Schedule skips routine dailies/standups (dailies appear only as "raise X" venues)
- [x] **v3.3 (provenance round)** — ledger `source` field + "(src: …)" on RADAR lines (every item
      traceable to its origin); `focus:` command (14-day standing focus); 📌 Schedule now rendered
      deterministically in code from the calendars; Friday ledger-health (aging >7d computed in
      code); account-aware Gmail links in signals
- [x] **v3.4 (auto-verification)** — ledger items resolve THEMSELVES: collector re-checks each
      item's source every morning (clickup:<id> → task review/done/closed; email:<acct>:<id> →
      left the inbox) → "✅ auto-resolved at source". The "done: X" reply channel was Cem-rejected
      (double work) and removed. Sources are canonicalized to machine-checkable form on store.

---

## 🔧 Production hygiene (small, do soon)
- [ ] **Remove the test webhook** (`sentinel-test-trigger-001`) once happy — open URL triggers a real run
- [ ] **Token resilience** — graceful-degrade is in place; plan for refresh-token revocation re-auth
- [ ] **n8n key note** — valid key is in `~/.claude/settings.json` (mcpServers.n8n-hr); `.claude.json` is stale

---

## 🚀 Next capabilities (in value order)
- [ ] **⚠️ ON CEM: enable "Take notes with Gemini" on the ENGLISH recurring meeting series**
      (DIEFI, Robust6G, board, Team Leads) — investigation (STATUS §10.3) proved the pipeline
      works; notes simply don't exist for most recurring meetings. NOTE (§10.4): Gemini notes do
      NOT support Turkish (EN/FR/DE/IT/JA/KO/PT/ES only) — Turkish meetings can't produce notes
      regardless of settings; consider a third-party recorder for those or accept the gap.
- [ ] **Decision log from transcripts** (design principle #4) — extract technical decisions +
      rationale from meeting notes into a durable, queryable log (the `decisions` table currently
      holds triage verdicts, which is a different thing). Unblocked once Gemini notes flow.
- [ ] **Split the analyst** — per-company extraction (structured JSON) + small synthesis call for
      cockpit/YOUR DAY; the single ~65k-char mega-prompt dilutes attention (word-cap overshoot is
      the visible symptom). Workflow-graph change — do as its own tested refactor.
- [ ] **Fallback LLM credential** — everything rides on one Claude CLI credential today (it ran
      dry mid-day 2026-07-02 and delayed the briefing by hours)
- [ ] **Register ClickUp webhooks for GOHM + DIEFI teams** — the events ledger only covers the
      FreshSens team webhook, so GOHM/DIEFI status transitions (and their weekly SP) are invisible
- [ ] **Extend SP auto-estimate to all dev tasks entering Review** (now agent-MR-only) — ~80% of
      active tasks have no points, silently undercounting weekly SP
- [ ] **Roadmap Report upgrades** — task links; week-over-week continuity (store + diff reports);
      fold ledger SP/velocity in; export the live-only "Gather ClickUp" node source to the repo
- [ ] **Map remaining Slack channels** in the registry (~12 unmapped default to daily) — mark weekly/muted
- [ ] **Explicit Gmail weekly-sender folding** (optional; daily bulk/newsletter triage already covers most)
- [ ] **Draft replies** — save ready Gmail drafts for reply-needed mail (nothing auto-sends)
- [ ] **Auto-create ClickUp tasks** from meeting action items
- [ ] **Two-way Sentinel** — richer Slack/Multica command surface ("draft a reply to Stefano")
- [ ] **Outcome feedback loop** (Phase 2 close) — feed `outcomes` back into briefing context
- [ ] **Alarm auto-triage** — ack/snooze resolved ThingsBoard alarms
- [ ] **SP attribution by assignee** (currently actor-credited) — join to last assignee in the ledger

---

## ❓ Open questions / waiting on Cem
- [ ] **Daily/weekly report format** — review the SAMPLE briefings posted to the DM; tell me edits
- [ ] **6G-QTrust & ZedCadit** — no ClickUp spaces yet; create + add to the registry when they exist
- [ ] **Robust6G/WP6** — dropped from the registry (closing soon); re-add if they stay
- [ ] **Slack coverage** — invite `@sentinel` to any other channels to include

---

## 💡 Backlog / ideas
- [ ] Evening wrap / standalone weekly report variant (weekly currently folded into Friday)
- [ ] Deeper email body reading for top-priority items before deciding
- [ ] Per-source health check / "Sentinel status" command
- [ ] Escalation beyond the DM if a 🔴 incident persists N days
- [ ] Wiki.js knowledge-base integration
