# Sentinel · Decision Capture

Turns a Slack reaction on a Decision-Queue message into a `Decision` row — the input
to the learning loop.

**Webhook (Slack Events):** `https://flow.gohm.tech/webhook/sentinel-slack-events`

**Flow:** Webhook → `Route Event` (challenge vs reaction vs ignore) → `Respond`
(echoes Slack's url_verification challenge, else 200) → `Map Verdict`
(emoji → verdict) → `Insert Decision` (matches the reacted message `ts` to a signal
via `signals.slack_ts`, inserts only if a signal matches).

**Emoji → verdict**

| Reaction | Verdict |
|---|---|
| ✅ `white_check_mark` / `+1` | `do_now` |
| 🕒 `clock3` / ⏳ `hourglass` | `do_later` |
| 👤 `bust_in_silhouette` | `delegate_person` |
| 🤖 `robot_face` | `delegate_agent` |
| 👀 `eyes` | `watch` |
| 🗑️ `wastebasket` / 🚫 `no_entry_sign` / ❌ `x` | `skip` |

## Server step required (Slack app)
On api.slack.com → the **sentinel** app:
1. **Event Subscriptions** → enable → Request URL = the webhook above (it answers the
   challenge automatically).
2. Subscribe to bot event **`reaction_added`** (and optionally `reaction_removed`).
3. Add scope **`reactions:read`** → reinstall the app.

The Decision Queue (posted by the Daily Briefing) is what makes messages reactable —
each queued item's `ts` is saved to `signals.slack_ts`.
