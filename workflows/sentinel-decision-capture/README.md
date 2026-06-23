# Sentinel · Decision Capture

Turns a Slack reaction on a Decision-Queue message into a `Decision` row — the input
to the learning loop.

**Webhook (Slack Events):** `https://flow.gohm.tech/webhook/sentinel-slack-events`

Two ways to respond to a Decision Queue item (which are posted top-level, so both map
to the specific item):
- **React** with an emoji → quick verdict.
- **Reply** with text → Claude parses it into `{verdict, reason}`; a reply alone sets the
  verdict, and captures the *why* (the strongest learning signal). Can override a prior
  reaction's verdict.

**Flow:** Webhook → `Route Event` (challenge / reaction / reply / ignore) → `Respond`
(echoes Slack's url_verification challenge, else 200) → two branches that converge on
`Upsert Decision`:
- reaction → `Map Verdict` (emoji → verdict)
- reply → `Build Reply Prompt` → `Reply LLM` (Claude) → `Parse Reply` (verdict + reason)

`Upsert Decision` matches the message/thread `ts` to a signal via `signals.slack_ts` and
**upserts one decision per signal** (`ON CONFLICT (signal_id)`, COALESCE-merging verdict
and reason so they can arrive separately).

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
2. Subscribe to bot events **`reaction_added`** and **`message.im`** (the latter enables
   text-reply reasons; the bot already has `im:history`).
3. Add scope **`reactions:read`** → reinstall the app.

The Decision Queue (posted by the Daily Briefing) is what makes messages reactable —
each queued item's `ts` is saved to `signals.slack_ts`.
