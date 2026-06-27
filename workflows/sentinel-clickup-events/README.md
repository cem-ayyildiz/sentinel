# Sentinel · ClickUp Events (the ledger)

Captures every ClickUp **status** and **assignee** change live, so weekly story-point
throughput and agent-vs-human attribution are exact — immune to sprint bulk-closeout
(which overwrites `date_closed` and makes after-the-fact weekly extraction impossible).

**Webhook:** `https://flow.gohm.tech/webhook/sentinel-clickup-events`
Registered as a ClickUp team webhook (FreshSens team `9009068877`) for events
`taskStatusUpdated` + `taskAssigneeUpdated` + `taskCommentPosted`.

**Flow:** `CU In` (webhook) → `Parse & Enrich` (one row per history_item / comment, enriched
with task name/list/points/org via a task GET; each row tagged with `_table`) →
`Route by Table` (Switch on `_table`) →
  • `_table = clickup_events`   → `Insert Events`   (Postgres `clickup_events`,   `ON CONFLICT DO NOTHING`)
  • `_table = clickup_comments` → `Insert Comments` (Postgres `clickup_comments`, `ON CONFLICT (comment_id) DO NOTHING`)

**Comments:** every `taskCommentPosted` now writes the full comment to `clickup_comments`
(commenter, text, `is_agent`, timestamps) — this powers the DAILY "new comments + progress"
view for the Development space. If the comment also carries a Multica agent marker
(`MR opened for review`, `synced to Multica`, …) it ALSO emits the agent-lifecycle row into
`clickup_events`. `org` is resolved from a space→org map (FreshSens / GOHM / DIEFI) mirroring
`infra/workspaces.json`; before this, GOHM/DIEFI events were mislabeled `freshsens`.

ClickUp assignee history uses `field` = **`assignee_add`** / **`assignee_rem`** (NOT
`assignee`). Status uses `field` = `status` with `before/after.status`.

This encodes Cem's agent lifecycle: created→assigned (person) → `assignee_add` Agent
Multica → agent works → `assignee_rem` Agent / `assignee_add` person (hand-back) →
`status` Review/Closed (merged). Agent-completed SP = points of tasks that passed
through Agent Multica as assignee and reached Review/Closed.

## Next (planned)
- Points auto-estimate on hand-back (Agent→person & no points → Claude → set `points`).
- Weekly "Story Points" snapshot: per-person SP that entered Review/Closed each ISO week.

Table DDL lives in `infra/schema.sql` (`clickup_events`).
