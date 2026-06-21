# Sentinel — Roadmap & Status

_Last updated: 2026-06-21_

The morning briefing is feature-complete and running daily. What remains is production
hardening, optional action-taking capabilities, and a few decisions waiting on Cem.

---

## ✅ Done (live in production)

- [x] **Daily briefing** — runs 07:00 Istanbul, delivered to Cem's Slack DM
- [x] **9-stage analyst pipeline** (collect → recall → prompt → analyst → parse → clean → send)
- [x] **Data sources wired**: FS+GOHM Gmail, FS+GOHM Calendar, Gemini meeting notes (Drive),
      all 25 Slack channels (public+private, auto-discovered), ClickUp FS/GOHM/DIEFI + Home
- [x] **Day-over-day continuity** — reads yesterday's briefing, tracks still-open/resolved/new
- [x] **Issue correlation** — Slack alarms/errors grouped into incidents (severity + root cause + owner)
- [x] **Meeting context** — pulls Gemini meeting summaries, surfaces decisions/actions
- [x] **Org-accurate structure** — FreshSens by 8 teams, GOHM by funded project, Personal/Smart-Home
- [x] **Meeting attendance triage** — each meeting tagged must-attend / optional / routine
- [x] **Inbox triage** — every email dispositioned reply / delegate / archive
- [x] **Mail auto-archiving ENABLED** — reversible (`Sentinel/FYI-Archived`), never deletes
- [x] **Security guardrail** — login/password/verification/payment notices never archived
- [x] **Long-message handling** — chunked at paragraph boundaries, overflow threaded
- [x] **Source version-controlled** (secret-redacted) + project memory saved

---

## 🔧 Production hygiene (small, do soon)

- [ ] **Remove the test webhook** (`sentinel-test-trigger-001`) — leave only the 07:00 schedule.
      It's an open URL that triggers a real briefing + archiving.
- [ ] **Reload the n8n browser tab** so the editor shows the current 9-node pipeline.
- [ ] **Token resilience** — note/plan for refresh-token revocation (briefing degrades gracefully
      and logs the error, but the source goes quiet until re-auth).

---

## 🚀 Next capabilities (in value order)

- [ ] **1. Draft replies** — for "reply-needed" emails, save ready Gmail *drafts*
      (Cem reviews & sends; nothing auto-sends). _Highest daily leverage — recommended next._
- [ ] **2. Auto-create ClickUp tasks** from meeting action items (e.g. Team Leads decisions),
      so nothing falls through.
- [ ] **3. Two-way Sentinel** — reply in Slack ("draft a response to Stefano", "what's blocking
      Okka?") and it answers/acts. The jump from briefing → assistant.
- [ ] **4. Alarm auto-triage** — acknowledge/snooze resolved ThingsBoard alarms so alert
      channels stay signal.
- [ ] **5. Smart filing** — file emails into existing labels (FS-Invoices, DIEFI…) not just archive.

---

## ❓ Open questions / waiting on Cem

- [ ] **6G-QTrust & ZedCadit** have no ClickUp spaces yet — create them and point Sentinel at
      them; they'll auto-join the project view.
- [ ] **Personal source** — confirm the GOHM "Home" ClickUp space is the right one, and whether
      to include all household items or only smart-home.
- [ ] **Calendar invites** — decide whether they should ever be archived (currently past invites can be).
- [ ] **Slack coverage** — invite `@sentinel` to any other channels you want included
      (it can't self-join private channels).

---

## 💡 Backlog / ideas (not scheduled)

- [ ] Evening / end-of-day wrap or weekly review variant
- [ ] Deeper email reading (full body) for top-priority items before deciding
- [ ] Pull Miro roadmap boards for strategic context (FS - Tech Roadmapping)
- [ ] Wiki.js / knowledge-base integration (deferred earlier)
- [ ] Escalation: if a 🔴 incident persists N days, ping beyond the DM
- [ ] Per-source health check / "Sentinel status" command
