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
        const bucket = Math.floor(Date.now() / 1000 / viewDedupeSeconds);
        try {
          const qid = crypto.randomBytes(12).toString("hex");
          await client.query(
            `INSERT INTO events (
              event_id, run_id, event_type, at_utc, slug, client_hash,
              derived_from, exclusions, payload
            ) VALUES ($1,$2,'qualified_result_view',NOW(),$3,$4,$5,'[]'::jsonb,$6::jsonb)`,
            [
              qid,
              runId,
              qualified.slug,
              qualified.client_hash,
              rawId,
              JSON.stringify({ dedupe_bucket: String(bucket) }),
            ],
          );
          return { rawId, qualifiedId: qid, exclusions: [] };
        } catch (err) {
          if (err && err.code === "23505") {
            return {
              rawId,
              qualifiedId: null,
              exclusions: ["repeat_view_deduped"],
            };
          }
          throw err;
        }
      }

      if (qualified.event_type === "qualified_propagation") {
        try {
          const qid = crypto.randomBytes(12).toString("hex");
          await client.query(
            `INSERT INTO events (
              event_id, run_id, event_type, at_utc, slug, client_hash, creator_hash,
              share_token_fingerprint, derived_from, exclusions, payload
            ) VALUES ($1,$2,'qualified_propagation',NOW(),$3,$4,$5,$6,$7,'[]'::jsonb,'{}'::jsonb)`,
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
          return { rawId, qualifiedId: qid, exclusions: [] };
        } catch (err) {
          if (err && err.code === "23505") {
            return {
              rawId,
              qualifiedId: null,
              exclusions: ["token_already_qualified"],
            };
          }
          throw err;
        }
      }

      throw new Error(`unsupported_qualified_type:${qualified.event_type}`);
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
    return this.withTransaction(async (client) => {
      const { rows } = await client.query(
        `SELECT window_start, count FROM rate_buckets WHERE bucket_key = $1 FOR UPDATE`,
        [bucketKey],
      );
      const now = new Date();
      if (!rows.length) {
        await client.query(
          `INSERT INTO rate_buckets (bucket_key, window_start, count) VALUES ($1, NOW(), 1)`,
          [bucketKey],
        );
        return true;
      }
      const start = new Date(rows[0].window_start);
      const ageSec = (now.getTime() - start.getTime()) / 1000;
      if (ageSec > windowSeconds) {
        await client.query(
          `UPDATE rate_buckets SET window_start = NOW(), count = 1 WHERE bucket_key = $1`,
          [bucketKey],
        );
        return true;
      }
      if (rows[0].count >= limit) return false;
      await client.query(
        `UPDATE rate_buckets SET count = count + 1 WHERE bucket_key = $1`,
        [bucketKey],
      );
      return true;
    });
  }
}
