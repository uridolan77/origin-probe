import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { PostgresLedger } from "../lib/ledger.js";

const databaseUrl = process.env.MEASUREMENT_TEST_DATABASE_URL || "";
const testDir = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(testDir, "..", "sql", "schema_v1.sql");

const LEGACY_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS events (
  event_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  slug TEXT,
  client_hash TEXT,
  creator_hash TEXT,
  share_token_fingerprint TEXT,
  seed BOOLEAN,
  derived_from TEXT REFERENCES events(event_id),
  exclusions JSONB NOT NULL DEFAULT '[]'::jsonb,
  ua_class TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS events_run_type_idx ON events (run_id, event_type);
CREATE INDEX IF NOT EXISTS events_run_slug_client_idx
  ON events (run_id, slug, client_hash, event_type, at_utc);
CREATE UNIQUE INDEX IF NOT EXISTS events_qual_prop_uniq
  ON events (run_id, share_token_fingerprint)
  WHERE event_type = 'qualified_propagation';
CREATE UNIQUE INDEX IF NOT EXISTS events_qual_view_uniq
  ON events (run_id, slug, client_hash, (payload->>'dedupe_bucket'))
  WHERE event_type = 'qualified_result_view';
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
);`;

test(
  "Postgres concurrency preserves raw audits, seed idempotency, and rate limits",
  { skip: databaseUrl ? false : "MEASUREMENT_TEST_DATABASE_URL not configured" },
  async (t) => {
    const setup = new pg.Client({ connectionString: databaseUrl });
    await setup.connect();
    await setup.query(await fs.readFile(schemaPath, "utf8"));

    const suffix = crypto.randomBytes(8).toString("hex");
    const runId = `ORIGIN-G2R-DB-TEST-${suffix}`;
    const rateKeys = [
      `rate-new-${suffix}`,
      `rate-second-${suffix}`,
    ];
    const ledgers = new Set();
    const openLedger = () => {
      const ledger = new PostgresLedger(databaseUrl);
      ledgers.add(ledger);
      return ledger;
    };
    const closeLedger = async (ledger) => {
      if (!ledgers.delete(ledger)) return;
      await ledger.close();
    };

    t.after(async () => {
      await Promise.all([...ledgers].map((ledger) => ledger.close()));
      await setup.query(
        `DELETE FROM seed_issuances WHERE run_id = $1`,
        [runId],
      );
      await setup.query(
        `DELETE FROM events
         WHERE run_id = $1
           AND event_type IN ('qualified_result_view', 'qualified_propagation')`,
        [runId],
      );
      await setup.query(`DELETE FROM events WHERE run_id = $1`, [runId]);
      await setup.query(`DELETE FROM rate_buckets WHERE bucket_key = ANY($1)`, [
        rateKeys,
      ]);
      await setup.end();
    });

    let ledgerA = openLedger();
    let ledgerB = openLedger();
    assert.deepEqual(await ledgerA.probeSchema(), {
      ready: true,
      version: "v1",
    });

    const seedAttempts = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        (index % 2 ? ledgerA : ledgerB).createOrReplaySeedIssuance({
          runId,
          seedKind: "operator",
          idempotencyKey: "OPERATOR-SEED-001",
          slug: "culture-eats-strategy-for-breakfast",
          creatorHash: "operator-hash",
          token: `candidate-token-${index}`,
          tokenFingerprint: `candidate-fingerprint-${index}`,
          uaClass: "browser",
        }),
      ),
    );
    assert.equal(seedAttempts.filter((result) => !result.replayed).length, 1);
    assert.equal(new Set(seedAttempts.map((result) => result.token)).size, 1);
    assert.equal(new Set(seedAttempts.map((result) => result.rawId)).size, 1);
    assert.equal(
      seedAttempts.filter((result) => result.replayed === true).length,
      19,
    );

    const seedConflict = await ledgerA.createOrReplaySeedIssuance({
      runId,
      seedKind: "operator",
      idempotencyKey: "OPERATOR-SEED-002",
      slug: "culture-eats-strategy-for-breakfast",
      creatorHash: "operator-hash",
      token: "must-not-persist",
      tokenFingerprint: "must-not-persist",
      uaClass: "browser",
    });
    assert.deepEqual(seedConflict, {
      conflict: true,
      reason: "seed_kind_already_issued",
      seedKind: "operator",
    });
    const changedSlug = await ledgerA.createOrReplaySeedIssuance({
      runId,
      seedKind: "operator",
      idempotencyKey: "OPERATOR-SEED-001",
      slug: "move-fast-and-break-things",
      creatorHash: "operator-hash",
      token: "must-not-persist",
      tokenFingerprint: "must-not-persist",
      uaClass: "browser",
    });
    assert.deepEqual(changedSlug, {
      conflict: true,
      reason: "idempotency_key_reused",
      seedKind: "operator",
    });
    const changedCreator = await ledgerA.createOrReplaySeedIssuance({
      runId,
      seedKind: "operator",
      idempotencyKey: "OPERATOR-SEED-001",
      slug: "culture-eats-strategy-for-breakfast",
      creatorHash: "different-operator-hash",
      token: "must-not-persist",
      tokenFingerprint: "must-not-persist",
      uaClass: "browser",
    });
    assert.deepEqual(changedCreator, {
      conflict: true,
      reason: "idempotency_key_reused",
      seedKind: "operator",
    });
    const changedKind = await ledgerA.createOrReplaySeedIssuance({
      runId,
      seedKind: "community",
      idempotencyKey: "OPERATOR-SEED-001",
      slug: "culture-eats-strategy-for-breakfast",
      creatorHash: "community-hash",
      token: "must-not-persist",
      tokenFingerprint: "must-not-persist",
      uaClass: "browser",
    });
    assert.deepEqual(changedKind, {
      conflict: true,
      reason: "idempotency_key_reused",
      seedKind: "community",
    });
    const community = await ledgerA.createOrReplaySeedIssuance({
      runId,
      seedKind: "community",
      idempotencyKey: "COMMUNITY-SEED-001",
      slug: "culture-eats-strategy-for-breakfast",
      creatorHash: "community-hash",
      token: "community-token",
      tokenFingerprint: "community-fingerprint",
      uaClass: "browser",
    });
    assert.equal(community.replayed, false);

    async function exerciseQualifiedRace(label, activeA, activeB) {
      const viewClient = `viewer-${label}`;
      const viewAttempts = await Promise.all(
        Array.from({ length: 20 }, (_, index) =>
          (index % 2 ? activeA : activeB).appendRawAndMaybeQualified({
            runId,
            viewDedupeSeconds: 21600,
            raw: {
              event_type: "result_view",
              slug: "culture-eats-strategy-for-breakfast",
              client_hash: viewClient,
              exclusions: [],
              ua_class: "browser",
            },
            qualified: {
              event_type: "qualified_result_view",
              slug: "culture-eats-strategy-for-breakfast",
              client_hash: viewClient,
            },
          }),
        ),
      );
      assert.equal(viewAttempts.filter((result) => result.qualifiedId).length, 1);
      assert.equal(
        viewAttempts.filter((result) =>
          result.exclusions.includes("repeat_view_deduped"),
        ).length,
        19,
      );

      const fingerprint = `propagation-${label}`;
      const propagationAttempts = await Promise.all(
        Array.from({ length: 20 }, (_, index) =>
          (index % 2 ? activeA : activeB).appendRawAndMaybeQualified({
            runId,
            viewDedupeSeconds: 21600,
            raw: {
              event_type: "propagated_visit",
              slug: "culture-eats-strategy-for-breakfast",
              client_hash: `recipient-${label}`,
              creator_hash: `creator-${label}`,
              share_token_fingerprint: fingerprint,
              seed: false,
              exclusions: [],
              ua_class: "browser",
            },
            qualified: {
              event_type: "qualified_propagation",
              slug: "culture-eats-strategy-for-breakfast",
              client_hash: `recipient-${label}`,
              creator_hash: `creator-${label}`,
              share_token_fingerprint: fingerprint,
            },
          }),
        ),
      );
      assert.equal(
        propagationAttempts.filter((result) => result.qualifiedId).length,
        1,
      );
      assert.equal(
        propagationAttempts.filter((result) =>
          result.exclusions.includes("token_already_qualified"),
        ).length,
        19,
      );
    }

    await exerciseQualifiedRace("first", ledgerA, ledgerB);
    await closeLedger(ledgerA);
    await closeLedger(ledgerB);

    ledgerA = openLedger();
    ledgerB = openLedger();
    const afterRestart = await ledgerA.listEvents(runId);
    assert.equal(
      afterRestart.filter((event) => event.type === "result_view").length,
      20,
    );
    assert.equal(
      afterRestart.filter(
        (event) =>
          event.type === "result_view" &&
          event.exclusions.includes("repeat_view_deduped"),
      ).length,
      19,
    );
    assert.equal(
      afterRestart.filter((event) => event.type === "propagated_visit").length,
      20,
    );
    assert.equal(
      afterRestart.filter(
        (event) =>
          event.type === "propagated_visit" &&
          event.exclusions.includes("token_already_qualified"),
      ).length,
      19,
    );
    await exerciseQualifiedRace("second", ledgerA, ledgerB);

    const firstRateBurst = await Promise.all(
      Array.from({ length: 30 }, (_, index) =>
        (index % 2 ? ledgerA : ledgerB).checkRateLimit(rateKeys[0], 7, 3600),
      ),
    );
    assert.equal(firstRateBurst.filter(Boolean).length, 7);
    await closeLedger(ledgerA);
    await closeLedger(ledgerB);

    ledgerA = openLedger();
    ledgerB = openLedger();
    assert.equal(await ledgerA.checkRateLimit(rateKeys[0], 7, 3600), false);
    const secondRateBurst = await Promise.all(
      Array.from({ length: 30 }, (_, index) =>
        (index % 2 ? ledgerA : ledgerB).checkRateLimit(rateKeys[1], 7, 3600),
      ),
    );
    assert.equal(secondRateBurst.filter(Boolean).length, 7);
  },
);

test(
  "schema migration is repeatable over the legacy ledger without rewriting history",
  { skip: databaseUrl ? false : "MEASUREMENT_TEST_DATABASE_URL not configured" },
  async (t) => {
    const client = new pg.Client({ connectionString: databaseUrl });
    await client.connect();
    const schemaName = `window002_migration_${crypto.randomBytes(6).toString("hex")}`;
    const quotedSchema = `"${schemaName}"`;
    let schemaCreated = false;
    t.after(async () => {
      if (schemaCreated) {
        await client.query(`DROP SCHEMA ${quotedSchema} CASCADE`);
      }
      await client.end();
    });

    await client.query(`CREATE SCHEMA ${quotedSchema}`);
    schemaCreated = true;
    await client.query(`SET search_path TO ${quotedSchema}`);
    await client.query(LEGACY_SCHEMA_SQL);
    await client.query(
      `INSERT INTO events (
        event_id, run_id, event_type, at_utc, slug, client_hash,
        exclusions, ua_class, payload
      ) VALUES (
        'historical-001', 'ORIGIN-G2R-HISTORICAL', 'result_view',
        '2026-08-29T10:00:00.000Z', 'culture-eats-strategy-for-breakfast',
        'historical-client', '["operator_excluded"]'::jsonb, 'browser',
        '{"historical":true}'::jsonb
      )`,
    );

    async function historicalSnapshot() {
      const { rows } = await client.query(
        `SELECT event_id, run_id, event_type, at_utc, slug, client_hash,
                exclusions, ua_class, payload
         FROM events
         WHERE event_id = 'historical-001'
         ORDER BY event_id`,
      );
      const canonical = rows.map((row) => ({
        ...row,
        at_utc: row.at_utc.toISOString(),
      }));
      return {
        count: canonical.length,
        digest: crypto
          .createHash("sha256")
          .update(JSON.stringify(canonical))
          .digest("hex"),
      };
    }

    const before = await historicalSnapshot();
    const currentSchema = await fs.readFile(schemaPath, "utf8");
    await client.query(currentSchema);
    await client.query(currentSchema);
    const after = await historicalSnapshot();
    assert.deepEqual(after, before);
    assert.equal(after.count, 1);

    const catalog = await client.query(
      `SELECT
         to_regclass('seed_issuances') IS NOT NULL AS seed_table,
         to_regclass('seed_issuances_pkey') IS NOT NULL AS seed_kind_unique,
         to_regclass('seed_issuances_run_idempotency_uniq') IS NOT NULL
           AS seed_idempotency_unique`,
    );
    assert.deepEqual(catalog.rows[0], {
      seed_table: true,
      seed_kind_unique: true,
      seed_idempotency_unique: true,
    });

    await client.query(
      `INSERT INTO events (event_id, run_id, event_type)
       VALUES ('seed-event-operator', 'migration-run', 'share_created'),
              ('seed-event-community', 'migration-run', 'share_created')`,
    );
    await client.query(
      `INSERT INTO seed_issuances (
         run_id, seed_kind, idempotency_key, slug, creator_hash,
         share_token, event_id
       ) VALUES (
         'migration-run', 'operator', 'SAME-KEY',
         'culture-eats-strategy-for-breakfast', 'operator',
         'operator-token', 'seed-event-operator'
       )`,
    );
    await assert.rejects(
      client.query(
        `INSERT INTO seed_issuances (
           run_id, seed_kind, idempotency_key, slug, creator_hash,
           share_token, event_id
         ) VALUES (
           'migration-run', 'community', 'SAME-KEY',
           'culture-eats-strategy-for-breakfast', 'community',
           'community-token', 'seed-event-community'
         )`,
      ),
      (error) => error?.code === "23505",
    );
  },
);
