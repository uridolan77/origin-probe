import crypto from "node:crypto";
import http from "node:http";
import {
  ALLOWED_SLUGS,
  getBindingEvidence,
  getConfig,
  hashClientId,
} from "../lib/config.js";
import { issueShareToken, verifyShareToken } from "../lib/tokens.js";
import { PostgresLedger, LEDGER_SCHEMA_VERSION } from "../lib/ledger.js";
import { reduceEvents, reduceWindowEvents } from "../lib/reducer.js";

const CRAWLER_UA =
  /bot|crawl|spider|slurp|facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|TelegramBot|Applebot|Googlebot|Bingbot|preview|Embedly|outbrain|vkShare|W3C_Validator/i;
const RUNTIME_BOOT_ID = crypto.randomUUID();
const RUNTIME_BOOTED_AT = new Date().toISOString();

function fingerprint(token) {
  return crypto.createHash("sha256").update(token).digest("hex").slice(0, 32);
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

function readBody(req, maxBytes) {
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
  return { path: url.pathname.replace(/\/+$/, "") || "/", url };
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

export async function createServer() {
  const databaseUrl =
    process.env.MEASUREMENT_DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("MEASUREMENT_DATABASE_URL required");

  // Every runnable HTTP surface fails closed; there is no opt-in switch that
  // permits development credentials or an unbound run.
  for (const k of [
    "MEASUREMENT_HMAC_SECRET",
    "MEASUREMENT_CLIENT_SALT",
    "MEASUREMENT_ADMIN_KEY",
    "MEASUREMENT_ALLOWED_ORIGIN",
    "MEASUREMENT_RUN_ID",
  ]) {
    if (!process.env[k]) throw new Error(`missing_env:${k}`);
  }

  const cfg = getConfig();
  const allowedOrigin = process.env.MEASUREMENT_ALLOWED_ORIGIN || "";
  const ledger = new PostgresLedger(databaseUrl);

  const server = http.createServer(async (req, res) => {
    const origin = String(req.headers.origin || "");
    setCors(res, allowedOrigin, origin);

    if (req.method === "OPTIONS") {
      if (allowedOrigin && origin && origin !== allowedOrigin) {
        return json(res, 403, { ok: false, error: "origin_not_allowed" });
      }
      res.statusCode = 204;
      return res.end();
    }

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

      const { path } = pathOf(req);

      if (req.method === "GET" && (path === "/" || path === "/v1/health")) {
        const schema = await ledger.probeSchema();
        return json(res, 200, {
          ok: true,
          service: "origin-probe-measure",
          gate: "ORIGIN_G2R_MEASUREMENT_INTEGRITY_REPAIR",
          ledgerSchemaVersion: schema.version,
          ledgerSchemaReady: schema.ready,
          runId: cfg.runId,
          bindings: getBindingEvidence({ cfg, databaseUrl }),
          durable: true,
          runtime: "node",
          instance: {
            label: process.env.MEASUREMENT_INSTANCE_LABEL || null,
            bootId: RUNTIME_BOOT_ID,
            bootedAt: RUNTIME_BOOTED_AT,
          },
        });
      }

      if (req.method === "GET" && path === "/v1/export") {
        if (!requireAdmin(req, cfg)) {
          return json(res, 401, { ok: false, error: "unauthorized" });
        }
        const { url } = pathOf(req);
        const scope = url.searchParams.get("scope") || "run";
        if (scope !== "run" && scope !== "all") {
          return json(res, 400, { ok: false, error: "invalid_export_scope" });
        }
        const events = await ledger.listEvents(scope === "all" ? null : cfg.runId);
        return json(res, 200, {
          ok: true,
          scope,
          activeRunId: cfg.runId,
          events,
          ledgerSchemaVersion: LEDGER_SCHEMA_VERSION,
        });
      }

      if (req.method === "GET" && path === "/v1/reduce") {
        if (!requireAdmin(req, cfg)) {
          return json(res, 401, { ok: false, error: "unauthorized" });
        }
        const { url } = pathOf(req);
        const startUtc = url.searchParams.get("startUtc");
        const endUtc = url.searchParams.get("endUtc");
        if (Boolean(startUtc) !== Boolean(endUtc)) {
          return json(res, 400, {
            ok: false,
            error: "window_boundaries_must_be_paired",
          });
        }
        const events = await ledger.listEvents(startUtc ? null : cfg.runId);
        const reducerEvents = events.map((e) => ({
          id: e.id,
          type: e.type,
          runId: e.runId,
          at: e.at instanceof Date ? e.at.toISOString() : e.at,
          slug: e.slug,
          clientHash: e.clientHash,
          creatorHash: e.creatorHash,
          shareTokenFingerprint: e.shareTokenFingerprint,
          seed: e.seed,
          derivedFrom: e.derivedFrom,
          exclusions: e.exclusions,
        }));
        return json(res, 200, {
          ok: true,
          reduction: startUtc
            ? reduceWindowEvents(reducerEvents, {
                runId: cfg.runId,
                startUtc,
                endUtc,
              })
            : reduceEvents(reducerEvents, cfg.runId),
        });
      }

      if (req.method !== "POST") {
        return json(res, 405, { ok: false, error: "method_not_allowed" });
      }

      const body = await readBody(req, 8_192);
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

      // Rate limits
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
        // Public path: seed always false
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
          runId: cfg.runId,
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
        if (
          (body.seedKind !== "operator" && body.seedKind !== "community") ||
          !fieldLenOk(body.idempotencyKey, 200)
        ) {
          return json(res, 400, {
            ok: false,
            error: "invalid_seed_request",
          });
        }
        if (body.seedKind === "operator" && !cfg.operatorHashes.has(clientHash)) {
          await ledger.recordRejection({
            runId: cfg.runId,
            reasonCode: "operator_seed_requires_operator_client",
            route: path,
            clientHash,
          });
          return json(res, 403, {
            ok: false,
            error: "operator_seed_requires_operator_client",
          });
        }
        const token = issueShareToken({
          slug: body.slug,
          creatorHash: clientHash,
          seed: true,
          runId: cfg.runId,
          hmacSecret: cfg.hmacSecret,
          ttlSeconds: cfg.tokenTtlSeconds,
        });
        const result = await ledger.createOrReplaySeedIssuance({
          runId: cfg.runId,
          seedKind: body.seedKind,
          idempotencyKey: body.idempotencyKey,
          slug: body.slug,
          creatorHash: clientHash,
          token,
          tokenFingerprint: fingerprint(token),
          uaClass,
        });
        if (result.conflict) {
          return json(res, 409, {
            ok: false,
            error: result.reason,
            seedKind: result.seedKind,
          });
        }
        return json(res, result.replayed ? 200 : 201, {
          ok: true,
          token: result.token,
          rawEventId: result.rawId,
          eventId: result.rawId,
          seed: true,
          seedKind: result.seedKind,
          replayed: result.replayed,
        });
      }

      if (path === "/v1/share-arrival") {
        if (!ALLOWED_SLUGS.has(body.slug)) {
          return json(res, 400, { ok: false, error: "invalid_request" });
        }
        const verified = verifyShareToken(
          body.token,
          cfg.hmacSecret,
          cfg.runId,
        );
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
  });

  server.ledger = ledger;
  return server;
}

const port = Number(process.env.PORT || 8787);
if (process.argv[1] && process.argv[1].endsWith("server.mjs")) {
  createServer()
    .then((server) => {
      server.listen(port, "0.0.0.0", () => {
        console.log(`origin-probe-measure listening on :${port}`);
      });
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
