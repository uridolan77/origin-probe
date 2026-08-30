import crypto from "node:crypto";

export const ALLOWED_SLUGS = new Set([
  "culture-eats-strategy-for-breakfast",
  "move-fast-and-break-things",
  "information-wants-to-be-free",
  "be-the-change-you-wish-to-see",
  "the-medium-is-the-message",
  "insanity-doing-the-same-thing",
  "if-youre-not-paying-you-are-the-product",
]);

export function requireEnv(name, fallback) {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === "") {
    throw new Error(`missing_env:${name}`);
  }
  return v;
}

export function getConfig() {
  return {
    hmacSecret: requireEnv(
      "MEASUREMENT_HMAC_SECRET",
      "dev-only-hmac-secret-change-me",
    ),
    clientSalt: requireEnv(
      "MEASUREMENT_CLIENT_SALT",
      "dev-only-client-salt-change-me",
    ),
    adminKey: requireEnv("MEASUREMENT_ADMIN_KEY", "dev-only-admin-key"),
    tokenTtlSeconds: Number(process.env.MEASUREMENT_TOKEN_TTL_SECONDS || 1209600),
    viewDedupeSeconds: Number(process.env.MEASUREMENT_VIEW_DEDUPE_SECONDS || 21600),
    operatorHashes: new Set(
      String(process.env.MEASUREMENT_OPERATOR_HASHES || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
    runId: process.env.MEASUREMENT_RUN_ID || "ORIGIN-G2R-LOCAL",
    storePath: process.env.MEASUREMENT_STORE_PATH || "",
  };
}

export function hashClientId(rawClientId, salt) {
  return crypto
    .createHmac("sha256", salt)
    .update(String(rawClientId || ""))
    .digest("hex");
}

export function b64url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function fromB64url(s) {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(b64, "base64");
}

const CRAWLER_UA =
  /bot|crawl|spider|slurp|facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|TelegramBot|Applebot|Googlebot|Bingbot|preview|Embedly|outbrain|vkShare|W3C_Validator/i;

export function isCrawlerUserAgent(ua) {
  return Boolean(ua && CRAWLER_UA.test(String(ua)));
}
