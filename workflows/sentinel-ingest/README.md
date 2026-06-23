# Sentinel · Ingest

The shared entry point for the Signal store. Any adapter (built-in, MCP, or Multica)
POSTs a Signal here; it's normalized, hashed, and deduped into Postgres.

```
POST https://flow.gohm.tech/webhook/sentinel-ingest
Content-Type: application/json

{ "source":"gmail", "source_ref":"<stable id>", "org":"freshsens",
  "type":"email", "title":"…", "body":"…", "actor":"…", "url":"…", "metadata":{} }
```
Also accepts an array of Signals or `{ "signals":[ … ] }`.

**Flow:** Webhook → `Normalize & Hash` (normalize.js) → Postgres insert
(`ON CONFLICT (content_hash) DO NOTHING`).

`content_hash` = `source:source_ref` when a stable ref exists, else a djb2 hash of
`title|body`. Re-posting the same item is a no-op (verified).

n8n workflow id: `k3rAxpxlhVFrD8fp`. Uses the `Sentinel Postgres` credential.
Schema: [../../infra/schema.sql](../../infra/schema.sql).
