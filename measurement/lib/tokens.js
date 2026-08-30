import crypto from "node:crypto";
import { b64url, fromB64url } from "./config.js";

export const MAX_SHARE_TOKEN_LENGTH = 4096;

const BASE64URL_SEGMENT = /^[A-Za-z0-9_-]+$/;

function isCanonicalBase64url(segment) {
  if (
    typeof segment !== "string" ||
    !BASE64URL_SEGMENT.test(segment) ||
    segment.length % 4 === 1
  ) {
    return false;
  }
  try {
    return b64url(fromB64url(segment)) === segment;
  } catch {
    return false;
  }
}

export function issueShareToken({
  slug,
  creatorHash,
  seed,
  runId,
  hmacSecret,
  ttlSeconds,
  nowMs = Date.now(),
}) {
  if (typeof runId !== "string" || runId.length === 0) {
    throw new Error("missing_run_id");
  }
  const payload = {
    v: 2,
    runId,
    slug,
    creatorHash,
    seed: Boolean(seed),
    iat: Math.floor(nowMs / 1000),
    exp: Math.floor(nowMs / 1000) + ttlSeconds,
    nonce: crypto.randomBytes(16).toString("hex"),
  };
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(
    crypto.createHmac("sha256", hmacSecret).update(body).digest(),
  );
  const token = `${body}.${sig}`;
  if (token.length > MAX_SHARE_TOKEN_LENGTH) {
    throw new Error("token_too_large");
  }
  return token;
}

export function verifyShareToken(
  token,
  hmacSecret,
  runId,
  nowMs = Date.now(),
) {
  if (
    typeof token !== "string" ||
    token.length === 0 ||
    token.length > MAX_SHARE_TOKEN_LENGTH
  ) {
    return { ok: false, reason: "malformed_token" };
  }
  const segments = token.split(".");
  if (
    segments.length !== 2 ||
    !isCanonicalBase64url(segments[0]) ||
    !isCanonicalBase64url(segments[1])
  ) {
    return { ok: false, reason: "malformed_token" };
  }
  const [body, sig] = segments;
  const expected = b64url(
    crypto.createHmac("sha256", hmacSecret).update(body).digest(),
  );
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
  if (payload.v !== 2) return { ok: false, reason: "unsupported_version" };
  if (typeof runId !== "string" || runId.length === 0) {
    return { ok: false, reason: "missing_run_id" };
  }
  if (payload.runId !== runId) {
    return { ok: false, reason: "run_mismatch" };
  }
  if (
    !payload.slug ||
    !payload.creatorHash ||
    !payload.nonce ||
    typeof payload.seed !== "boolean"
  ) {
    return { ok: false, reason: "incomplete_payload" };
  }
  const now = Math.floor(nowMs / 1000);
  if (typeof payload.exp !== "number" || now > payload.exp) {
    return { ok: false, reason: "expired_token" };
  }
  if (typeof payload.iat !== "number" || payload.iat > now + 60) {
    return { ok: false, reason: "invalid_iat" };
  }
  return { ok: true, payload };
}
