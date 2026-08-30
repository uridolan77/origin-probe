/**
 * Vercel serverless entry — durable Postgres ledger (not process-local memory).
 * Requires MEASUREMENT_DATABASE_URL + server-only secrets (never NEXT_PUBLIC_*).
 */
import crypto from "node:crypto";
import { ALLOWED_SLUGS, getConfig, hashClientId } from "../lib/config.js";
import { issueShareToken, verifyShareToken } from "../lib/tokens.js";
import { PostgresLedger, LEDGER_SCHEMA_VERSION } from "../lib/ledger.js";
import { reduceEvents } from "../lib/reducer.js";

const CRAWLER_UA =
  /bot|crawl|spider|slurp|facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|TelegramBot|Applebot|Googlebot|Bingbot|preview|Embedly|outbrain|vkShare|W3C_Validator/i;

/** @type {PostgresLedger | null} */
let ledgerSingleton = null;

function databaseUrl() {
  return (
    process.env.MEASUREMENT_DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    ""
  );
}

function getLedger() {
  const url = databaseUrl();
  if (!url) throw new Error("MEASUREMENT_DATABASE_URL required");
  if (!ledgerSingleton) ledgerSingleton = new PostgresLedger(url);
  return ledgerSingleton;
}

function fingerprint(token) {
  return crypto.createHash("sha256").update(token).digest("hex").slice(0, 32);
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

function readBody(req, maxBytes = 8192) {
  if (req.body && typeof req.body === "object") return Promise.resolve(req.body);
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > maxBytes) {
        reject(Object.assign(new Error("body_too_large"), { code: "BODY_TOO_LARGE" }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function pathOf(req) {
  const url = new URL(req.url || "/", "http://local");
  return url.pathname.replace(/\/+$/, "") || "/";
}

function setCors(res, allowedOrigin, requestOrigin) {
  if (allowedOrigin && requestOrigin === allowedOrigin) {
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, X-Origin-Client-Raw, X-Admin-Key",
  );
}

function requireAdmin(req, cfg) {
  return req.headers["x-admin-key"] === cfg.adminKey;
}

function fieldLenOk(value, max) {
  return typeof value === "string" && value.length > 0 && value.length <= max;
}

function requireSecrets() {
  for (const k of [
    "MEASUREMENT_HMAC_SECRET",
    "MEASUREMENT_CLIENT_SALT",
    "MEASUREMENT_ADMIN_KEY",
    "MEASUREMENT_ALLOWED_ORIGIN",
  ]) {
    if (!process.env[k]) throw new Error(`missing_env:${k}`);
  }
  if (!databaseUrl()) throw new Error("missing_env:MEASUREMENT_DATABASE_URL");
}

export default async function handler(req, res) {
  try {
    requireSecrets();
  } catch (err) {
    return json(res, 500, { ok: false, error: String(err.message || err) });
  }

  const cfg = getConfig();
  const allowedOrigin = process.env.MEASUREMENT_ALLOWED_ORIGIN || "";
  const origin = String(req.headers.origin || "");
  setCors(res, allowedOrigin, origin);

  if (req.method === "OPTIONS") {
    if (allowedOrigin && origin && origin !== allowedOrigin) {
      return json(res, 403, { ok: false, error: "origin_not_allowed" });
    }
    res.statusCode = 204;
    return res.end();
  }

  const ledger = getLedger();

  try {
    if (allowedOrigin && req.method === "POST") {
      if (!origin || origin !== allowedOrigin) {
        await ledger.recordRejection({
          runId: cfg.runId,
          reasonCode: "origin_not_allowed",
          route: req.url,
          clientHash: null,
        });
        return json(res, 403, { ok: false, error: "origin_not_allowed" });
      }
    }

    const path = pathOf(req);

    if (req.method === "GET" && (path === "/" || path === "/v1/health")) {
      return json(res, 200, {
        ok: true,
        service: "origin-probe-measure",
        gate: "ORIGIN_G2R_MEASUREMENT_INTEGRITY_REPAIR",
        ledgerSchemaVersion: LEDGER_SCHEMA_VERSION,
        durable: true,
        runtime: "vercel",
      });
    }

    if (req.method === "GET" && path === "/v1/export") {
      if (!requireAdmin(req, cfg)) {
        return json(res, 401, { ok: false, error: "unauthorized" });
      }
      const events = await ledger.listEvents(cfg.runId);
      return json(res, 200, { ok: true, events, ledgerSchemaVersion: LEDGER_SCHEMA_VERSION });
    }

    if (req.method === "GET" && path === "/v1/reduce") {
      if (!requireAdmin(req, cfg)) {
        return json(res, 401, { ok: false, error: "unauthorized" });
      }
      const events = await ledger.listEvents(cfg.runId);
      return json(res, 200, {
        ok: true,
        reduction: reduceEvents(
          events.map((e) => ({
            id: e.id,
            type: e.type,
            runId: e.runId,
            at: e.at,
            clientHash: e.clientHash,
            creatorHash: e.creatorHash,
            exclusions: e.exclusions,
          })),
          cfg.runId,
        ),
      });
    }

    if (req.method !== "POST") {
      return json(res, 405, { ok: false, error: "method_not_allowed" });
    }

    const body = await readBody(req);
    if (
      body?.type === "qualified_result_view" ||
      body?.type === "qualified_propagation"
    ) {
      await ledger.recordRejection({
        runId: cfg.runId,
        reasonCode: "qualified_events_are_server_derived_only",
        route: path,
        clientHash: null,
      });
      return json(res, 400, {
        ok: false,
        error: "qualified_events_are_server_derived_only",
      });
    }

    const rawClient = String(req.headers["x-origin-client-raw"] || "");
    if (!fieldLenOk(rawClient, 128) || rawClient.length < 8) {
      return json(res, 400, { ok: false, error: "missing_client_id" });
    }
    const clientHash = hashClientId(rawClient, cfg.clientSalt);
    const ua = String(req.headers["user-agent"] || "").slice(0, 256);
    const uaClass = CRAWLER_UA.test(ua) ? "crawler" : "browser";

    const routeKey = `${path}:${clientHash}`;
    const allowed = await ledger.checkRateLimit(routeKey, 60, 60);
    if (!allowed) {
      await ledger.recordRejection({
        runId: cfg.runId,
        reasonCode: "rate_limited",
        route: path,
        clientHash,
      });
      return json(res, 429, { ok: false, error: "rate_limited" });
    }

    if (path === "/v1/result-view") {
      if (!ALLOWED_SLUGS.has(body.slug) || !fieldLenOk(body.slug, 80)) {
        return json(res, 400, { ok: false, error: "invalid_slug" });
      }
      const exclusions = [];
      if (cfg.operatorHashes.has(clientHash)) exclusions.push("operator_excluded");
      if (uaClass === "crawler") exclusions.push("crawler_excluded");

      const result = await ledger.appendRawAndMaybeQualified({
        runId: cfg.runId,
        viewDedupeSeconds: cfg.viewDedupeSeconds,
        raw: {
          event_type: "result_view",
          slug: body.slug,
          client_hash: clientHash,
          exclusions,
          ua_class: uaClass,
        },
        qualified:
          exclusions.length === 0
            ? {
                event_type: "qualified_result_view",
                slug: body.slug,
                client_hash: clientHash,
              }
            : null,
      });
      return json(res, 201, {
        ok: true,
        rawEventId: result.rawId,
        qualifiedResultView: Boolean(result.qualifiedId),
        exclusions: result.exclusions.length ? result.exclusions : exclusions,
      });
    }

    if (path === "/v1/create-share") {
      if (body.seed === true) {
        await ledger.recordRejection({
          runId: cfg.runId,
          reasonCode: "public_seed_forbidden",
          route: path,
          clientHash,
        });
        return json(res, 403, { ok: false, error: "public_seed_forbidden" });
      }
      if (!ALLOWED_SLUGS.has(body.slug)) {
        return json(res, 400, { ok: false, error: "invalid_slug" });
      }
      const token = issueShareToken({
        slug: body.slug,
        creatorHash: clientHash,
        seed: false,
        hmacSecret: cfg.hmacSecret,
        ttlSeconds: cfg.tokenTtlSeconds,
      });
      const result = await ledger.appendRawAndMaybeQualified({
        runId: cfg.runId,
        viewDedupeSeconds: cfg.viewDedupeSeconds,
        raw: {
          event_type: "share_created",
          slug: body.slug,
          client_hash: clientHash,
          share_token_fingerprint: fingerprint(token),
          seed: false,
          exclusions: cfg.operatorHashes.has(clientHash)
            ? ["operator_share_noted"]
            : [],
          ua_class: uaClass,
        },
        qualified: null,
      });
      return json(res, 201, {
        ok: true,
        token,
        rawEventId: result.rawId,
        seed: false,
      });
    }

    if (path === "/v1/admin/create-seed") {
      if (!requireAdmin(req, cfg)) {
        return json(res, 401, { ok: false, error: "unauthorized" });
      }
      if (!ALLOWED_SLUGS.has(body.slug)) {
        return json(res, 400, { ok: false, error: "invalid_slug" });
      }
      const token = issueShareToken({
        slug: body.slug,
        creatorHash: clientHash,
        seed: true,
        hmacSecret: cfg.hmacSecret,
        ttlSeconds: cfg.tokenTtlSeconds,
      });
      const result = await ledger.appendRawAndMaybeQualified({
        runId: cfg.runId,
        viewDedupeSeconds: cfg.viewDedupeSeconds,
        raw: {
          event_type: "share_created",
          slug: body.slug,
          client_hash: clientHash,
          share_token_fingerprint: fingerprint(token),
          seed: true,
          exclusions: ["admin_seed_issuance"],
          ua_class: uaClass,
          payload: { operatorAction: "create_seed" },
        },
        qualified: null,
      });
      return json(res, 201, {
        ok: true,
        token,
        rawEventId: result.rawId,
        seed: true,
      });
    }

    if (path === "/v1/share-arrival") {
      if (!ALLOWED_SLUGS.has(body.slug) || !fieldLenOk(String(body.token || ""), 4096)) {
        return json(res, 400, { ok: false, error: "invalid_request" });
      }
      const verified = verifyShareToken(body.token, cfg.hmacSecret);
      if (!verified.ok) {
        await ledger.recordRejection({
          runId: cfg.runId,
          reasonCode: verified.reason || "token_verification_failed",
          route: path,
          clientHash,
        });
        return json(res, 400, {
          ok: false,
          error: "token_verification_failed",
          reason: verified.reason,
        });
      }
      const payload = verified.payload;
      const exclusions = [];
      if (payload.slug !== body.slug) exclusions.push("slug_mismatch");
      if (payload.seed) exclusions.push("seed_token_excluded");
      if (cfg.operatorHashes.has(clientHash)) exclusions.push("operator_excluded");
      if (payload.creatorHash === clientHash) exclusions.push("same_client_arrival");
      if (uaClass === "crawler") exclusions.push("crawler_excluded");

      const fp = fingerprint(body.token);
      const result = await ledger.appendRawAndMaybeQualified({
        runId: cfg.runId,
        viewDedupeSeconds: cfg.viewDedupeSeconds,
        raw: {
          event_type: "propagated_visit",
          slug: body.slug,
          client_hash: clientHash,
          creator_hash: payload.creatorHash,
          share_token_fingerprint: fp,
          seed: Boolean(payload.seed),
          exclusions,
          ua_class: uaClass,
        },
        qualified:
          exclusions.length === 0
            ? {
                event_type: "qualified_propagation",
                slug: body.slug,
                client_hash: clientHash,
                creator_hash: payload.creatorHash,
                share_token_fingerprint: fp,
              }
            : null,
      });
      return json(res, 201, {
        ok: true,
        rawEventId: result.rawId,
        qualifiedPropagation: Boolean(result.qualifiedId),
        exclusions: result.exclusions.length ? result.exclusions : exclusions,
      });
    }

    return json(res, 404, { ok: false, error: "not_found" });
  } catch (err) {
    if (err && err.code === "BODY_TOO_LARGE") {
      return json(res, 413, { ok: false, error: "body_too_large" });
    }
    console.error(err);
    return json(res, 500, {
      ok: false,
      error: String(err && err.message ? err.message : err),
    });
  }
}
