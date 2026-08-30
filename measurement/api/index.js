import { ALLOWED_SLUGS, getConfig, hashClientId, isCrawlerUserAgent } from "../lib/config.js";
import { issueShareToken, verifyShareToken } from "../lib/tokens.js";
import { getStore } from "../lib/store.js";
import {
  acceptResultView,
  acceptCreateShare,
  acceptShareArrival,
} from "../lib/qualify.js";
import { reduceEvents } from "../lib/reducer.js";

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, X-Origin-Client-Raw, X-Admin-Key",
  );
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

function readBody(req) {
  if (req.body && typeof req.body === "object") return Promise.resolve(req.body);
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
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

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  const cfg = getConfig();
  const store = getStore(cfg.storePath || undefined);
  const p = pathOf(req);

  try {
    if (req.method === "GET" && (p === "/" || p === "/v1/health")) {
      return json(res, 200, {
        ok: true,
        service: "origin-probe-measure",
        gate: "ORIGIN_G2R_MEASUREMENT_INTEGRITY_REPAIR",
      });
    }

    if (req.method === "GET" && p === "/v1/export") {
      if (req.headers["x-admin-key"] !== cfg.adminKey) {
        return json(res, 401, { ok: false, error: "unauthorized" });
      }
      return json(res, 200, { ok: true, events: store.list() });
    }

    if (req.method === "GET" && p === "/v1/reduce") {
      if (req.headers["x-admin-key"] !== cfg.adminKey) {
        return json(res, 401, { ok: false, error: "unauthorized" });
      }
      const url = new URL(req.url || "/", "http://local");
      const runId = url.searchParams.get("runId") || cfg.runId;
      return json(res, 200, {
        ok: true,
        reduction: reduceEvents(store.list(), runId),
      });
    }

    if (req.method !== "POST") {
      return json(res, 405, { ok: false, error: "method_not_allowed" });
    }

    // Reject browser submission of qualified_* as authoritative.
    const body = await readBody(req);
    if (
      body &&
      (body.type === "qualified_result_view" ||
        body.type === "qualified_propagation")
    ) {
      return json(res, 400, {
        ok: false,
        error: "qualified_events_are_server_derived_only",
      });
    }

    const rawClient = req.headers["x-origin-client-raw"];
    if (!rawClient || String(rawClient).length < 8) {
      return json(res, 400, { ok: false, error: "missing_client_id" });
    }
    const clientHash = hashClientId(String(rawClient), cfg.clientSalt);
    const ua = String(req.headers["user-agent"] || "");

    if (p === "/v1/result-view") {
      const slug = body.slug;
      if (!ALLOWED_SLUGS.has(slug)) {
        return json(res, 400, { ok: false, error: "invalid_slug" });
      }
      const result = acceptResultView({
        store,
        cfg,
        slug,
        clientHash,
        ua,
        runId: cfg.runId,
      });
      return json(res, 201, {
        ok: true,
        rawEventId: result.raw.id,
        qualifiedResultView: Boolean(result.qualified),
        exclusions: result.exclusions,
      });
    }

    if (p === "/v1/create-share") {
      const slug = body.slug;
      if (!ALLOWED_SLUGS.has(slug)) {
        return json(res, 400, { ok: false, error: "invalid_slug" });
      }
      const seed = Boolean(body.seed);
      const token = issueShareToken({
        slug,
        creatorHash: clientHash,
        seed,
        hmacSecret: cfg.hmacSecret,
        ttlSeconds: cfg.tokenTtlSeconds,
      });
      const result = acceptCreateShare({
        store,
        cfg,
        slug,
        clientHash,
        seed,
        token,
        runId: cfg.runId,
      });
      return json(res, 201, {
        ok: true,
        token,
        rawEventId: result.raw.id,
        seed,
      });
    }

    if (p === "/v1/share-arrival") {
      const slug = body.slug;
      const token = body.token;
      if (!ALLOWED_SLUGS.has(slug)) {
        return json(res, 400, { ok: false, error: "invalid_slug" });
      }
      const verified = verifyShareToken(token, cfg.hmacSecret);
      if (!verified.ok) {
        return json(res, 400, {
          ok: false,
          error: "token_verification_failed",
          reason: verified.reason,
        });
      }
      const result = acceptShareArrival({
        store,
        cfg,
        slug,
        clientHash,
        ua,
        token,
        payload: verified.payload,
        runId: cfg.runId,
      });
      return json(res, 201, {
        ok: true,
        rawEventId: result.raw.id,
        qualifiedPropagation: Boolean(result.qualified),
        exclusions: result.exclusions,
      });
    }

    return json(res, 404, { ok: false, error: "not_found" });
  } catch (err) {
    return json(res, 500, {
      ok: false,
      error: String(err && err.message ? err.message : err),
    });
  }
}

// Silence unused import in case tree-shakers complain
void isCrawlerUserAgent;
