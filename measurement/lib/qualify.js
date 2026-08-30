import crypto from "node:crypto";

/**
 * Measurement decision logic.
 * Browser may only induce raw events: result_view, share_created, propagated_visit.
 * qualified_* are derived server-side only.
 */

function fingerprint(token) {
  return crypto.createHash("sha256").update(token).digest("hex").slice(0, 32);
}

function isCrawler(ua) {
  return /bot|crawl|spider|slurp|facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|TelegramBot|Applebot|Googlebot|Bingbot|preview|Embedly|outbrain|vkShare|W3C_Validator/i.test(
    String(ua || ""),
  );
}

export function acceptResultView({ store, cfg, slug, clientHash, ua, runId }) {
  const exclusions = [];
  if (cfg.operatorHashes.has(clientHash)) exclusions.push("operator_excluded");
  if (isCrawler(ua)) exclusions.push("crawler_excluded");

  const raw = store.append({
    type: "result_view",
    runId,
    slug,
    clientHash,
    ua: ua || "",
    exclusions,
  });

  if (exclusions.length) {
    return { raw, qualified: null, exclusions };
  }

  const windowMs = cfg.viewDedupeSeconds * 1000;
  const now = Date.parse(raw.at);
  const prior = store
    .list()
    .filter(
      (e) =>
        e.type === "qualified_result_view" &&
        e.slug === slug &&
        e.clientHash === clientHash &&
        Math.abs(Date.parse(e.at) - now) < windowMs,
    );
  if (prior.length) {
    return {
      raw,
      qualified: null,
      exclusions: ["repeat_view_deduped"],
    };
  }

  const qualified = store.append({
    type: "qualified_result_view",
    runId,
    slug,
    clientHash,
    derivedFrom: raw.id,
  });
  return { raw, qualified, exclusions: [] };
}

export function acceptCreateShare({
  store,
  cfg,
  slug,
  clientHash,
  seed,
  token,
  runId,
}) {
  const exclusions = [];
  if (cfg.operatorHashes.has(clientHash)) exclusions.push("operator_share_noted");

  const raw = store.append({
    type: "share_created",
    runId,
    slug,
    clientHash,
    shareTokenFingerprint: fingerprint(token),
    seed: Boolean(seed),
    exclusions,
  });
  return { raw, token };
}

export function acceptShareArrival({
  store,
  cfg,
  slug,
  clientHash,
  ua,
  token,
  payload,
  runId,
}) {
  const exclusions = [];
  if (payload.slug !== slug) exclusions.push("slug_mismatch");
  if (payload.seed) exclusions.push("seed_token_excluded");
  if (cfg.operatorHashes.has(clientHash)) exclusions.push("operator_excluded");
  if (payload.creatorHash === clientHash) exclusions.push("same_client_arrival");
  if (isCrawler(ua)) exclusions.push("crawler_excluded");

  const fp = fingerprint(token);
  const raw = store.append({
    type: "propagated_visit",
    runId,
    slug,
    clientHash,
    creatorHash: payload.creatorHash,
    shareTokenFingerprint: fp,
    seed: Boolean(payload.seed),
    ua: ua || "",
    exclusions,
  });

  if (exclusions.length) {
    return { raw, qualified: null, exclusions };
  }

  const priorQual = store
    .list()
    .find(
      (e) =>
        e.type === "qualified_propagation" && e.shareTokenFingerprint === fp,
    );
  if (priorQual) {
    return {
      raw,
      qualified: null,
      exclusions: ["token_already_qualified"],
    };
  }

  const qualified = store.append({
    type: "qualified_propagation",
    runId,
    slug,
    clientHash,
    creatorHash: payload.creatorHash,
    shareTokenFingerprint: fp,
    derivedFrom: raw.id,
  });
  return { raw, qualified, exclusions: [] };
}
