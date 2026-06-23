# Sentinel · Profile

Weekly job (cron `0 17 * * 0` = Sun 20:00 Istanbul) that compresses the `decisions`
log into a compact `decision_profile` so the briefing's learning context stays flat as
history grows.

**Flow:** `Load Decisions` (last 500, joined to signals) → `Build Profile Prompt` →
`Profile LLM` (Claude) → `Parse Profile` (extract JSON) → `Store Profile`
(insert a new `decision_profile` row; the briefing's Load Context reads the latest).

Profile shape: `{ always_skip:[…], always_do:[…], delegate_map:{…} }`. With too little
data it returns small/empty lists rather than guessing. Has a `sentinel-profile-test`
webhook to run on demand.
