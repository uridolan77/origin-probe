import crypto from "node:crypto";
import { b64url, fromB64url } from "./config.js";

export function issueShareToken({
  slug,
  creatorHash,
  seed,
  hmacSecret,
  ttlSeconds,
  nowMs = Date.now(),
}) {
  const payload = {
    v: 1,
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
  return `${body}.${sig}`;
}

export function verifyShareToken(token, hmacSecret, nowMs = Date.now()) {
  if (!token || typeof token !== "string" || !token.includes(".")) {
    return { ok: false, reason: "malformed_token" };
  }
  const [body, sig] = token.split(".");
  if (!body || !sig) return { ok: false, reason: "malformed_token" };
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
  if (payload.v !== 1) return { ok: false, reason: "unsupported_version" };
  if (!payload.slug || !payload.creatorHash || !payload.nonce) {
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
