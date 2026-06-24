# Sentinel · Mail Cleaner

Archives emails that got a `skip` verdict — from Cem *or* the AI gate — so the inbox
actually clears. **Never deletes:** removes the `INBOX` label and adds
`Sentinel/FYI-Archived` (still in All Mail, fully recoverable).

**Flow:** Webhook → `Load To-Archive` (gmail email signals with a `skip` decision and
`archived_at IS NULL`) → `Archive` (refresh the right account's token — FS or GOHM by
`org` — ensure the label, `messages.modify` remove INBOX + add label) → `Mark Archived`
(`signals.archived_at = now()`, idempotent; failures retry next sweep).

**Triggered by:** every decision (Decision Capture → Trigger Mail Clean) and every
auto-skip (the gate → Trigger Mail Clean). Webhook: `/webhook/sentinel-clean-mail`.

Verified: 25 skipped emails archived in one sweep; confirmed out of the Gmail inbox.
