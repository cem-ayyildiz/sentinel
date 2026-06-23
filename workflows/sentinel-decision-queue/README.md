# Sentinel · Decision Queue (gated)

Posts the triage queue to Cem's DM — but first runs his **learned profile** as a gate, so
noise he's already taught it to skip never reaches the board. This is pillar 3 of
SENTINEL_DESIGN.md (the system pre-classifies new signals by how he's decided before).

## Flow
```
Load Profile → Load Candidates (undecided, queue-eligible)
  → Pre-Classify (Claude, against the profile) → Parse → split:
       ├─ auto_skip matches → Notify Auto-Skips (transparency) → Auto-Record Skips (decided_via='auto_rule')
       └─ surface (top ≤5)  → Post Surfaced (top-level, with hints) → Update Slack TS
```

- **Adaptive mode:** auto-skips clear rule matches *and* sensible generalizations; Cem
  corrects misses via the 🔇 "Auto-handled N items" note that lists what was hidden.
- Items post **top-level** so a reaction or a reply maps to the specific item.
- Candidates exclude anything already decided (`id NOT IN decisions`), so nothing repeats.

## Triggered by
- The **Daily Briefing** (after it stores the day's signals) → `Trigger Queue`.
- **Decision Capture** auto-refill: when the board clears, it calls this to post the next ≤5.

Webhook: `https://flow.gohm.tech/webhook/sentinel-postqueue`. Uses the `Sentinel Postgres`
credential + the Claude CLI model.

## Files
`pre-classify-prompt.js` · `parse-classification.js` · `filter-autoskip.js` ·
`filter-surface.js` · `post-surfaced.js` · `notify-autoskips.js` · `build.py`
