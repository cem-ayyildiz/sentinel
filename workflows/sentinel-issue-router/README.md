# Sentinel · Issue Router

Turns triage decisions into **approved ClickUp tasks**. Finds `delegate_person` /
`do_later` decisions with no action yet, has Claude draft a concrete task each
(title, description, assignee hint, due), posts each to Cem's DM as a proposal, and
records it in `actions` (status `pending`).

**Approval** happens in Decision Capture: react **✅** on a proposal → the ClickUp task
is created in that org's *Sentinel Inbox* list (FS `901524068347`, GOHM `901524068348`,
DIEFI `1000360000000408`) and the action is marked `done` with the task URL; **❌** →
`rejected`. Nothing is created without Cem's ✅.

Webhook: `/webhook/sentinel-issue-router`. Verified: 5 tasks drafted, 1 approved →
real ClickUp task created.
