import crypto from "node:crypto";
import pg from "pg";

export const LEDGER_SCHEMA_VERSION = "v1";

export class PostgresLedger {
  /** @param {string} databaseUrl */
  constructor(databaseUrl) {
    this.pool = new pg.Pool({
      connectionString: databaseUrl,
      max: 10,
    });
  }

  async close() {
    await this.pool.end();
  }

  async probeSchema() {
    await this.pool.query(
      `SELECT event_id, run_id, event_type, at_utc, creator_hash,
              share_token_fingerprint, derived_from, exclusions, payload
       FROM events LIMIT 0`,
    );
    await this.pool.query(
      `SELECT run_id, seed_kind, idempotency_key, slug, creator_hash,
              share_token, event_id
       FROM seed_issuances LIMIT 0`,
    );
    await this.pool.query(
      `SELECT bucket_key, window_start, count FROM rate_buckets LIMIT 0`,
    );
    const { rows } = await this.pool.query(
      `SELECT
         to_regclass('events_qual_prop_uniq') IS NOT NULL AS propagation_unique,
         to_regclass('events_qual_view_uniq') IS NOT NULL AS view_unique,
         to_regclass('seed_issuances_pkey') IS NOT NULL AS seed_kind_unique,
         to_regclass('seed_issuances_run_idempotency_uniq') IS NOT NULL
           AS seed_idempotency_unique`,
    );
    if (
      !rows[0].propagation_unique ||
      !rows[0].view_unique ||
      !rows[0].seed_kind_unique ||
      !rows[0].seed_idempotency_unique
    ) {
      throw new Error("ledger_schema_incomplete");
    }
    return { ready: true, version: LEDGER_SCHEMA_VERSION };
  }

  async withTransaction(fn) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // ignore
      }
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Insert raw event and optional derived qualified event atomically.
   * @param {object} args
   */
  async appendRawAndMaybeQualified({
    runId,
    raw,
    qualified,
    viewDedupeSeconds,
  }) {
    return this.withTransaction(async (client) => {
      const rawId = raw.event_id || crypto.randomBytes(12).toString("hex");
      await client.query(
        `INSERT INTO events (
          event_id, run_id, event_type, at_utc, slug, client_hash, creator_hash,
          share_token_fingerprint, seed, derived_from, exclusions, ua_class, payload
        ) VALUES ($1,$2,$3,NOW(),$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12::jsonb)`,
        [
          rawId,
          runId,
          raw.event_type,
          raw.slug || null,
          raw.client_hash || null,
          raw.creator_hash || null,
          raw.share_token_fingerprint || null,
          raw.seed ?? null,
          raw.derived_from || null,
          JSON.stringify(raw.exclusions || []),
          raw.ua_class || null,
          JSON.stringify(raw.payload || {}),
        ],
      );

      if (!qualified) {
        return { rawId, qualifiedId: null, exclusions: raw.exclusions || [] };
      }

      if (qualified.event_type === "qualified_result_view") {
        const qid = crypto.randomBytes(12).toString("hex");
        const { rows } = await client.query(
          `INSERT INTO events (
            event_id, run_id, event_type, at_utc, slug, client_hash,
            derived_from, exclusions, payload
          ) VALUES (
            $1,$2,'qualified_result_view',NOW(),$3,$4,$5,'[]'::jsonb,
            jsonb_build_object(
              'dedupe_bucket',
              (FLOOR(EXTRACT(EPOCH FROM NOW()) / $6::double precision)::bigint)::text
            )
          )
          ON CONFLICT (
            run_id, slug, client_hash, (payload->>'dedupe_bucket')
          ) WHERE event_type = 'qualified_result_view' DO NOTHING
          RETURNING event_id`,
          [
            qid,
            runId,
            qualified.slug,
            qualified.client_hash,
            rawId,
            viewDedupeSeconds,
          ],
        );
        if (rows.length) {
          return { rawId, qualifiedId: qid, exclusions: [] };
        }
        await client.query(
          `UPDATE events
           SET exclusions = exclusions || $2::jsonb
           WHERE event_id = $1`,
          [rawId, JSON.stringify(["repeat_view_deduped"])],
        );
        return {
          rawId,
          qualifiedId: null,
          exclusions: ["repeat_view_deduped"],
        };
      }

      if (qualified.event_type === "qualified_propagation") {
        const qid = crypto.randomBytes(12).toString("hex");
        const { rows } = await client.query(
          `INSERT INTO events (
            event_id, run_id, event_type, at_utc, slug, client_hash, creator_hash,
            share_token_fingerprint, derived_from, exclusions, payload
          ) VALUES ($1,$2,'qualified_propagation',NOW(),$3,$4,$5,$6,$7,'[]'::jsonb,'{}'::jsonb)
          ON CONFLICT (run_id, share_token_fingerprint)
          WHERE event_type = 'qualified_propagation' DO NOTHING
          RETURNING event_id`,
          [
            qid,
            runId,
            qualified.slug,
            qualified.client_hash,
            qualified.creator_hash,
            qualified.share_token_fingerprint,
            rawId,
          ],
        );
        if (rows.length) {
          return { rawId, qualifiedId: qid, exclusions: [] };
        }
        await client.query(
          `UPDATE events
           SET exclusions = exclusions || $2::jsonb
           WHERE event_id = $1`,
          [rawId, JSON.stringify(["token_already_qualified"])],
        );
        return {
          rawId,
          qualifiedId: null,
          exclusions: ["token_already_qualified"],
        };
      }

      throw new Error(`unsupported_qualified_type:${qualified.event_type}`);
    });
  }

  /**
   * Atomically create or replay the sole seed issuance for a run and seed kind.
   * The transaction-scoped advisory lock makes concurrent requests deterministic
   * across serverless instances sharing this ledger.
   */
  async createOrReplaySeedIssuance({
    runId,
    seedKind,
    idempotencyKey,
    slug,
    creatorHash,
    token,
    tokenFingerprint,
    uaClass,
  }) {
    if (seedKind !== "operator" && seedKind !== "community") {
      throw new Error("invalid_seed_kind");
    }
    return this.withTransaction(async (client) => {
      await client.query(
        `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
        [`${runId.length}:${runId}:seed-issuance`],
      );

      const existing = await client.query(
        `SELECT run_id AS "runId", seed_kind AS "seedKind",
                idempotency_key AS "idempotencyKey", slug,
                creator_hash AS "creatorHash", share_token AS token,
                event_id AS "rawId"
         FROM seed_issuances
         WHERE run_id = $1 AND seed_kind = $2`,
        [runId, seedKind],
      );
      if (existing.rows.length) {
        const issuance = existing.rows[0];
        if (issuance.idempotencyKey !== idempotencyKey) {
          return {
            conflict: true,
            reason: "seed_kind_already_issued",
            seedKind,
          };
        }
        if (issuance.slug !== slug || issuance.creatorHash !== creatorHash) {
          return {
            conflict: true,
            reason: "idempotency_key_reused",
            seedKind,
          };
        }
        return { ...issuance, conflict: false, replayed: true };
      }

      const idempotencyOwner = await client.query(
        `SELECT seed_kind AS "seedKind"
         FROM seed_issuances
         WHERE run_id = $1 AND idempotency_key = $2`,
        [runId, idempotencyKey],
      );
      if (idempotencyOwner.rows.length) {
        return {
          conflict: true,
          reason: "idempotency_key_reused",
          seedKind,
        };
      }

      const rawId = crypto.randomBytes(12).toString("hex");
      await client.query(
        `INSERT INTO events (
          event_id, run_id, event_type, at_utc, slug, client_hash,
          share_token_fingerprint, seed, exclusions, ua_class, payload
        ) VALUES (
          $1,$2,'share_created',NOW(),$3,$4,$5,TRUE,$6::jsonb,$7,$8::jsonb
        )`,
        [
          rawId,
          runId,
          slug,
          creatorHash,
          tokenFingerprint,
          JSON.stringify(["admin_seed_issuance"]),
          uaClass || null,
          JSON.stringify({ operatorAction: "create_seed", seedKind }),
        ],
      );
      await client.query(
        `INSERT INTO seed_issuances (
          run_id, seed_kind, idempotency_key, slug, creator_hash,
          share_token, event_id
        ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [runId, seedKind, idempotencyKey, slug, creatorHash, token, rawId],
      );
      return {
        runId,
        seedKind,
        idempotencyKey,
        slug,
        creatorHash,
        token,
        rawId,
        conflict: false,
        replayed: false,
      };
    });
  }

  async listEvents(runId) {
    const { rows } = await this.pool.query(
      `SELECT event_id AS id, run_id AS "runId", event_type AS type, at_utc AS at,
              slug, client_hash AS "clientHash", creator_hash AS "creatorHash",
              share_token_fingerprint AS "shareTokenFingerprint", seed,
              derived_from AS "derivedFrom", exclusions, ua_class AS "uaClass", payload
       FROM events
       WHERE ($1::text IS NULL OR run_id = $1)
       ORDER BY at_utc ASC, event_id ASC`,
      [runId || null],
    );
    return rows.map((r) => ({
      ...r,
      exclusions: Array.isArray(r.exclusions) ? r.exclusions : [],
    }));
  }

  async recordRejection({ runId, reasonCode, route, clientHash }) {
    await this.pool.query(
      `INSERT INTO rejections (rejection_id, run_id, reason_code, route, client_hash)
       VALUES ($1,$2,$3,$4,$5)`,
      [
        crypto.randomBytes(12).toString("hex"),
        runId || null,
        reasonCode,
        route || null,
        clientHash || null,
      ],
    );
  }

  /**
   * Simple fixed-window rate limit. Returns true if allowed.
   */
  async checkRateLimit(bucketKey, limit, windowSeconds) {
    const { rows } = await this.pool.query(
      `INSERT INTO rate_buckets (bucket_key, window_start, count)
       VALUES ($1, NOW(), 1)
       ON CONFLICT (bucket_key) DO UPDATE
       SET window_start = CASE
             WHEN rate_buckets.window_start <=
                  NOW() - ($3::double precision * INTERVAL '1 second')
               THEN NOW()
             ELSE rate_buckets.window_start
           END,
           count = CASE
             WHEN rate_buckets.window_start <=
                  NOW() - ($3::double precision * INTERVAL '1 second')
               THEN 1
             ELSE LEAST(rate_buckets.count + 1, $2::integer + 1)
           END
       RETURNING count <= $2::integer AS allowed`,
      [bucketKey, limit, windowSeconds],
    );
    return rows[0].allowed;
  }
}
