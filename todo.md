# Sentinel — Roadmap & Status

_Last updated: 2026-06-27_

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

---

## 🔧 Production hygiene (small, do soon)
- [ ] **Remove the test webhook** (`sentinel-test-trigger-001`) once happy — open URL triggers a real run
- [ ] **Token resilience** — graceful-degrade is in place; plan for refresh-token revocation re-auth
- [ ] **n8n key note** — valid key is in `~/.claude/settings.json` (mcpServers.n8n-hr); `.claude.json` is stale

---

## 🚀 Next capabilities (in value order)
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
