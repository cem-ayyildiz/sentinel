# Sentinel · ClickUp Events (the ledger)

Captures every ClickUp **status** and **assignee** change live, so weekly story-point
throughput and agent-vs-human attribution are exact — immune to sprint bulk-closeout
(which overwrites `date_closed` and makes after-the-fact weekly extraction impossible).

**Webhook:** `https://flow.gohm.tech/webhook/sentinel-clickup-events`
Registered as a ClickUp team webhook (FreshSens team `9009068877`) for events
`taskStatusUpdated` + `taskAssigneeUpdated`.

**Flow:** `CU In` (webhook) → `Parse & Enrich` (one row per history_item, enriched with
task name/list/points/org via a task GET) → `Insert Events` (Postgres `clickup_events`,
`ON CONFLICT DO NOTHING`).

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
