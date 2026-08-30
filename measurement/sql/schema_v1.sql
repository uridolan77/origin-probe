-- Origin G2R measurement ledger schema v1
CREATE TABLE IF NOT EXISTS events (
  event_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  slug TEXT,
  client_hash TEXT,
  creator_hash text,
  share_token_fingerprint TEXT,
  seed BOOLEAN,
  derived_from TEXT REFERENCES events(event_id),
  exclusions JSONB NOT NULL DEFAULT '[]'::jsonb,
  ua_class TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS events_run_type_idx ON events (run_id, event_type);
CREATE INDEX IF NOT EXISTS events_run_slug_client_idx ON events (run_id, slug, client_hash, event_type, at_utc);

-- Exactly one qualified propagation per token within a run
CREATE UNIQUE INDEX IF NOT EXISTS events_qual_prop_uniq
  ON events (run_id, share_token_fingerprint)
  WHERE event_type = 'qualified_propagation';

-- Exactly one qualified view per client/slug/dedupe bucket within a run
CREATE UNIQUE INDEX IF NOT EXISTS events_qual_view_uniq
  ON events (run_id, slug, client_hash, (payload->>'dedupe_bucket'))
  WHERE event_type = 'qualified_result_view';

-- Exactly one durable seed issuance of each approved kind per run. The full
-- signed token is retained so a retry with the same idempotency key can replay
-- the original issuance without minting another token or event.
CREATE TABLE IF NOT EXISTS seed_issuances (
  run_id TEXT NOT NULL,
  seed_kind TEXT NOT NULL CHECK (seed_kind IN ('operator', 'community')),
  idempotency_key TEXT NOT NULL,
  slug TEXT NOT NULL,
  creator_hash TEXT NOT NULL,
  share_token TEXT NOT NULL,
  event_id TEXT NOT NULL UNIQUE REFERENCES events(event_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (run_id, seed_kind)
);

-- An idempotency key identifies one request payload within a run; it cannot be
-- reused to mint the other seed kind.
CREATE UNIQUE INDEX IF NOT EXISTS seed_issuances_run_idempotency_uniq
  ON seed_issuances (run_id, idempotency_key);

-- Rate-limit / rejection audit (no raw IP stored)
CREATE TABLE IF NOT EXISTS rejections (
  rejection_id TEXT PRIMARY KEY,
  at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  run_id TEXT,
  reason_code TEXT NOT NULL,
  route TEXT,
  client_hash TEXT
);

CREATE TABLE IF NOT EXISTS rate_buckets (
  bucket_key TEXT PRIMARY KEY,
  window_start TIMESTAMPTZ NOT NULL,
  count INTEGER NOT NULL DEFAULT 0
);
