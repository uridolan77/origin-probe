/**
 * CommonJS Vercel entry for Origin G2R measurement API.
 * Keep secrets in platform env (MEASUREMENT_*), never NEXT_PUBLIC_*.
 */
const crypto = require("crypto");

const ALLOWED_SLUGS = new Set([
  "culture-eats-strategy-for-breakfast",
  "move-fast-and-break-things",
  "information-wants-to-be-free",
  "be-the-change-you-wish-to-see",
  "the-medium-is-the-message",
  "insanity-doing-the-same-thing",
  "if-youre-not-paying-you-are-the-product",
]);

const CRAWLER_UA =
  /bot|crawl|spider|slurp|facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|TelegramBot|Applebot|Googlebot|Bingbot|preview|Embedly|outbrain|vkShare|W3C_Validator/i;

function cfg() {
  const hmacSecret = process.env.MEASUREMENT_HMAC_SECRET;
  const clientSalt = process.env.MEASUREMENT_CLIENT_SALT;
  const adminKey = process.env.MEASUREMENT_ADMIN_KEY;
  if (!hmacSecret || !clientSalt || !adminKey) {
    const err = new Error("missing_measurement_secrets");
    err.code = "MISCONFIGURED";
    throw err;
  }
  return {
    hmacSecret,
    clientSalt,
    adminKey,
    tokenTtlSeconds: Number(process.env.MEASUREMENT_TOKEN_TTL_SECONDS || 1209600),
    viewDedupeSeconds: Number(process.env.MEASUREMENT_VIEW_DEDUPE_SECONDS || 21600),
    operatorHashes: new Set(
      String(process.env.MEASUREMENT_OPERATOR_HASHES || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
    runId: process.env.MEASUREMENT_RUN_ID || "ORIGIN-G2R",
  };
}

function b64url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}
function fromB64url(s) {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}
function hashClientId(raw, salt) {
  return crypto.createHmac("sha256", salt).update(String(raw || "")).digest("hex");
}
function fingerprint(token) {
  return crypto.createHash("sha256").update(token).digest("hex").slice(0, 32);
}

globalThis.__originEvents = globalThis.__originEvents || [];

function append(event) {
  const stored = {
    id: crypto.randomBytes(12).toString("hex"),
    at: new Date().toISOString(),
    ...event,
  };
  globalThis.__originEvents.push(stored);
  return stored;
}

function issueToken(c, { slug, creatorHash, seed }) {
  const payload = {
    v: 1,
    slug,
    creatorHash,
    seed: Boolean(seed),
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + c.tokenTtlSeconds,
    nonce: crypto.randomBytes(16).toString("hex"),
  };
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(crypto.createHmac("sha256", c.hmacSecret).update(body).digest());
  return `${body}.${sig}`;
}

function verifyToken(c, token) {
  if (!token || !token.includes(".")) return { ok: false, reason: "malformed_token" };
  const [body, sig] = token.split(".");
  const expected = b64url(crypto.createHmac("sha256", c.hmacSecret).update(body).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: "bad_signature" };
  }
  let payload;
  try {
    payload = JSON.parse(fromB64url(body).toString("utf8"));
  } catch {
    return { ok: false, reason: "bad_payload" };
  }
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) return { ok: false, reason: "expired_token" };
  return { ok: true, payload };
}

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
function pathOf(req) {
  const url = new URL(req.url || "/", "http://local");
  return url.pathname.replace(/\/+$/, "") || "/";
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  let c;
  try {
    c = cfg();
  } catch {
    return json(res, 503, {
      ok: false,
      error: "measurement_secrets_not_configured",
      gate: "ORIGIN_G2R_MEASUREMENT_INTEGRITY_REPAIR",
    });
  }

  const p = pathOf(req);
  if (req.method === "GET" && (p === "/" || p === "/v1/health")) {
    return json(res, 200, {
      ok: true,
      service: "origin-probe-measure",
      gate: "ORIGIN_G2R_MEASUREMENT_INTEGRITY_REPAIR",
      configured: true,
    });
  }

  if (req.method === "GET" && p === "/v1/export") {
    if (req.headers["x-admin-key"] !== c.adminKey) {
      return json(res, 401, { ok: false, error: "unauthorized" });
    }
    return json(res, 200, { ok: true, events: globalThis.__originEvents });
  }

  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "method_not_allowed" });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return json(res, 400, { ok: false, error: "invalid_json" });
    }
  }
  body = body || {};
  if (
    body.type === "qualified_result_view" ||
    body.type === "qualified_propagation"
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
  const clientHash = hashClientId(rawClient, c.clientSalt);
  const ua = String(req.headers["user-agent"] || "");

  if (p === "/v1/result-view") {
    if (!ALLOWED_SLUGS.has(body.slug)) {
      return json(res, 400, { ok: false, error: "invalid_slug" });
    }
    const exclusions = [];
    if (c.operatorHashes.has(clientHash)) exclusions.push("operator_excluded");
    if (CRAWLER_UA.test(ua)) exclusions.push("crawler_excluded");
    const raw = append({
      type: "result_view",
      runId: c.runId,
      slug: body.slug,
      clientHash,
      ua,
      exclusions,
    });
    let qualified = null;
    if (!exclusions.length) {
      const windowMs = c.viewDedupeSeconds * 1000;
      const now = Date.parse(raw.at);
      const prior = globalThis.__originEvents.find(
        (e) =>
          e.type === "qualified_result_view" &&
          e.slug === body.slug &&
          e.clientHash === clientHash &&
          Math.abs(Date.parse(e.at) - now) < windowMs,
      );
      if (prior) exclusions.push("repeat_view_deduped");
      else {
        qualified = append({
          type: "qualified_result_view",
          runId: c.runId,
          slug: body.slug,
          clientHash,
          derivedFrom: raw.id,
        });
      }
    }
    return json(res, 201, {
      ok: true,
      rawEventId: raw.id,
      qualifiedResultView: Boolean(qualified),
      exclusions,
    });
  }

  if (p === "/v1/create-share") {
    if (!ALLOWED_SLUGS.has(body.slug)) {
      return json(res, 400, { ok: false, error: "invalid_slug" });
    }
    const seed = Boolean(body.seed);
    const token = issueToken(c, {
      slug: body.slug,
      creatorHash: clientHash,
      seed,
    });
    const raw = append({
      type: "share_created",
      runId: c.runId,
      slug: body.slug,
      clientHash,
      shareTokenFingerprint: fingerprint(token),
      seed,
      exclusions: c.operatorHashes.has(clientHash) ? ["operator_share_noted"] : [],
    });
    return json(res, 201, { ok: true, token, rawEventId: raw.id, seed });
  }

  if (p === "/v1/share-arrival") {
    if (!ALLOWED_SLUGS.has(body.slug)) {
      return json(res, 400, { ok: false, error: "invalid_slug" });
    }
    const verified = verifyToken(c, body.token);
    if (!verified.ok) {
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
    if (c.operatorHashes.has(clientHash)) exclusions.push("operator_excluded");
    if (payload.creatorHash === clientHash) exclusions.push("same_client_arrival");
    if (CRAWLER_UA.test(ua)) exclusions.push("crawler_excluded");
    const fp = fingerprint(body.token);
    const raw = append({
      type: "propagated_visit",
      runId: c.runId,
      slug: body.slug,
      clientHash,
      creatorHash: payload.creatorHash,
      shareTokenFingerprint: fp,
      seed: Boolean(payload.seed),
      ua,
      exclusions,
    });
    let qualified = null;
    if (!exclusions.length) {
      const prior = globalThis.__originEvents.find(
        (e) =>
          e.type === "qualified_propagation" && e.shareTokenFingerprint === fp,
      );
      if (prior) exclusions.push("token_already_qualified");
      else {
        qualified = append({
          type: "qualified_propagation",
          runId: c.runId,
          slug: body.slug,
          clientHash,
          creatorHash: payload.creatorHash,
          shareTokenFingerprint: fp,
          derivedFrom: raw.id,
        });
      }
    }
    return json(res, 201, {
      ok: true,
      rawEventId: raw.id,
      qualifiedPropagation: Boolean(qualified),
      exclusions,
    });
  }

  return json(res, 404, { ok: false, error: "not_found" });
};
