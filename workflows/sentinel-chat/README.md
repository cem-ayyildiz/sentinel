# Sentinel · Chat

Ask Sentinel questions in the DM — "who's doing what?", "what's pending?", etc. A
**top-level** message in the DM (vs. a threaded reply, which is a triage decision) is
routed here by Decision Capture.

**Flow:** Chat In → `Gather ClickUp` (live "who's doing what" across FS/GOHM/DIEFI,
last 7 days, grouped by person) → `Load Context` (recent decisions + Sentinel-created
actions) → `Build Prompt` → Claude → `Post Answer` to the DM.

Webhook: `/webhook/sentinel-chat`. Verified: "who is doing what in freshsens?" → live
per-person breakdown of all 11 team members.
