-- Sentinel · Postgres schema (Phase 1 foundation)
-- Run once against the `sentinel` database. Faithful to SENTINEL_DESIGN.md §Data model.
--   psql "postgresql://sentinel:***@<host>:5432/sentinel" -f schema.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- for gen_random_uuid()

-- Every input normalizes into this. Source-agnostic.
CREATE TABLE IF NOT EXISTS signals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source        TEXT NOT NULL,            -- 'gmail' | 'slack' | 'clickup' | 'mcp:<name>'
  source_ref    TEXT,
  org           TEXT,                     -- 'freshsens' | 'gohm' | 'diefi' | ...
  type          TEXT NOT NULL,            -- 'email' | 'message' | 'task' | 'event' | 'alert'
  title         TEXT,
  body          TEXT,
  actor         TEXT,
  url           TEXT,
  metadata      JSONB DEFAULT '{}',
  content_hash  TEXT UNIQUE,              -- dedup: skip if already seen
  slack_ts      TEXT,
  archived_at   TIMESTAMPTZ,             -- set when a skipped email was archived out of the inbox                     -- Slack message ts of this item's Decision Queue post
  ingested_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS signals_org_type_time ON signals (org, type, ingested_at);
CREATE INDEX IF NOT EXISTS signals_slack_ts ON signals (slack_ts);

-- One CURRENT decision per surfaced item (upserted). The learning source.
CREATE TABLE IF NOT EXISTS decisions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id     UUID REFERENCES signals(id) UNIQUE,   -- one decision per signal; upsert on conflict
  verdict       TEXT,                     -- do_now|do_later|delegate_person|delegate_agent|watch|skip|done (nullable: a reason can land before a verdict)
  delegate_to   TEXT,
  reason        TEXT,                     -- the WHY — paraphrased from Cem's reply; strongest learning signal
  raw_input     TEXT,                     -- Cem's exact reply text
  decided_via   TEXT,                     -- slack_reaction|slack_reply|multica_voice|dashboard
  decided_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS decisions_time ON decisions (decided_at DESC);

-- Did the priority call / action turn out right? Closes the loop.
CREATE TABLE IF NOT EXISTS outcomes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id   UUID REFERENCES decisions(id),
  result        TEXT,                     -- completed|cancelled|reclassified|ignored_3d
  agent         TEXT,
  detail        TEXT,
  url           TEXT,
  recorded_at   TIMESTAMPTZ DEFAULT now()
);

-- Continuity (replaces parsing yesterday's Slack DM).
CREATE TABLE IF NOT EXISTS briefings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  briefing_date DATE,
  prose         TEXT,
  open_issues   JSONB,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- The compact learned summary, rewritten periodically by Claude.
CREATE TABLE IF NOT EXISTS decision_profile (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile       JSONB,                    -- { always_skip:[...], always_do:[...], delegate_map:{...} }
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Seed an empty profile so the briefing always has one row to read.
INSERT INTO decision_profile (profile)
SELECT '{"always_skip":[],"always_do":[],"delegate_map":{}}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM decision_profile);

-- Proposed/executed actions (e.g. ClickUp tasks) awaiting or past Cem's Slack approval.
CREATE TABLE IF NOT EXISTS actions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id   UUID REFERENCES signals(id),
  kind        TEXT,                     -- 'clickup_task'
  org         TEXT,
  payload     JSONB,                    -- { title, description, assignee_hint, due }
  status      TEXT DEFAULT 'pending',   -- pending|done|rejected|failed
  slack_ts    TEXT,                     -- proposal message ts (approval reaction maps here)
  result_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS actions_signal_kind ON actions(signal_id, kind);
CREATE INDEX IF NOT EXISTS actions_slack_ts ON actions(slack_ts);

-- The 2026 roadmap doc (read from Miro 'FS - Tech Roadmapping'), correlated weekly vs ClickUp.
CREATE TABLE IF NOT EXISTS roadmap (id INT PRIMARY KEY, doc TEXT, source TEXT, updated_at TIMESTAMPTZ DEFAULT now());

-- Live ledger of ClickUp status/assignee transitions (Sentinel · ClickUp Events).
-- Exact weekly throughput + agent attribution; immune to sprint bulk-closeout.
CREATE TABLE IF NOT EXISTS clickup_events (
  id            BIGSERIAL PRIMARY KEY,
  task_id       TEXT NOT NULL,
  task_name     TEXT,
  org           TEXT,
  list_id       TEXT,
  list_name     TEXT,
  event         TEXT,                    -- taskStatusUpdated | taskAssigneeUpdated
  field         TEXT,                    -- status | assignee_add | assignee_rem
  before_val    TEXT,
  after_val     TEXT,
  assignee_user TEXT,
  points        NUMERIC,
  actor         TEXT,
  event_time    TIMESTAMPTZ,
  raw           JSONB,
  ingested_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS clickup_events_task ON clickup_events(task_id);
CREATE INDEX IF NOT EXISTS clickup_events_time ON clickup_events(event_time DESC);
CREATE UNIQUE INDEX IF NOT EXISTS clickup_events_dedup ON clickup_events(task_id, field, COALESCE(after_val,''), event_time);
