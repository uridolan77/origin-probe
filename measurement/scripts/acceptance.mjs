/**
 * Cross-client acceptance transcript for G2R.
 * Exits 0 only if all required scenarios pass.
 */
import assert from "node:assert/strict";
import { getConfig, hashClientId } from "../lib/config.js";
import { issueShareToken, verifyShareToken } from "../lib/tokens.js";
import { resetStoreForTests } from "../lib/store.js";
import {
  acceptResultView,
  acceptCreateShare,
  acceptShareArrival,
} from "../lib/qualify.js";
import { reduceEvents } from "../lib/reducer.js";

process.env.MEASUREMENT_HMAC_SECRET = "acceptance-hmac-secret";
process.env.MEASUREMENT_CLIENT_SALT = "acceptance-client-salt";
process.env.MEASUREMENT_ADMIN_KEY = "acceptance-admin";
process.env.MEASUREMENT_RUN_ID = "ORIGIN-G2R-ACCEPTANCE";
process.env.MEASUREMENT_VIEW_DEDUPE_SECONDS = "21600";

const slug = "culture-eats-strategy-for-breakfast";
const cfg = getConfig();
const operatorRaw = "operator-client-aaaaaaaa";
const operatorHash = hashClientId(operatorRaw, cfg.clientSalt);
cfg.operatorHashes.add(operatorHash);

const store = resetStoreForTests();
const runId = cfg.runId;
const results = [];

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
}

// 1. Operator view excluded
{
  const r = acceptResultView({
    store,
    cfg,
    slug,
    clientHash: operatorHash,
    ua: "Mozilla/5.0",
    runId,
  });
  const ok =
    r.exclusions.includes("operator_excluded") && r.qualified === null;
  record("1_operator_view_excluded", ok, r.exclusions.join(","));
}

// 2. Seed-token arrival excluded
{
  const token = issueShareToken({
    slug,
    creatorHash: hashClientId("seed-creator", cfg.clientSalt),
    seed: true,
    runId,
    hmacSecret: cfg.hmacSecret,
    ttlSeconds: cfg.tokenTtlSeconds,
  });
  acceptCreateShare({
    store,
    cfg,
    slug,
    clientHash: hashClientId("seed-creator", cfg.clientSalt),
    seed: true,
    token,
    runId,
  });
  const verified = verifyShareToken(token, cfg.hmacSecret, runId);
  const r = acceptShareArrival({
    store,
    cfg,
    slug,
    clientHash: hashClientId("browser-b", cfg.clientSalt),
    ua: "Mozilla/5.0",
    token,
    payload: verified.payload,
    runId,
  });
  record(
    "2_seed_token_arrival_excluded",
    r.exclusions.includes("seed_token_excluded") && !r.qualified,
    r.exclusions.join(","),
  );
}

// 3–5. Browser A creates share; A opens own link excluded; B qualifies once
const browserA = hashClientId("browser-a-client", cfg.clientSalt);
const browserB = hashClientId("browser-b-client", cfg.clientSalt);
let tokenA;
{
  tokenA = issueShareToken({
    slug,
    creatorHash: browserA,
    seed: false,
    runId,
    hmacSecret: cfg.hmacSecret,
    ttlSeconds: cfg.tokenTtlSeconds,
  });
  acceptCreateShare({
    store,
    cfg,
    slug,
    clientHash: browserA,
    seed: false,
    token: tokenA,
    runId,
  });
  record("3_browser_a_creates_share", Boolean(tokenA.includes(".")), "token issued");

  const verified = verifyShareToken(tokenA, cfg.hmacSecret, runId);
  const self = acceptShareArrival({
    store,
    cfg,
    slug,
    clientHash: browserA,
    ua: "Mozilla/5.0",
    token: tokenA,
    payload: verified.payload,
    runId,
  });
  record(
    "4_browser_a_self_arrival_excluded",
    self.exclusions.includes("same_client_arrival") && !self.qualified,
    self.exclusions.join(","),
  );

  const other = acceptShareArrival({
    store,
    cfg,
    slug,
    clientHash: browserB,
    ua: "Mozilla/5.0",
    token: tokenA,
    payload: verified.payload,
    runId,
  });
  record(
    "5_browser_b_qualified_propagation",
    Boolean(other.qualified) && other.exclusions.length === 0,
    other.qualified ? other.qualified.id : other.exclusions.join(","),
  );
}

// 6. Browser B reload does not create another qualified propagation
{
  const verified = verifyShareToken(tokenA, cfg.hmacSecret, runId);
  const reload = acceptShareArrival({
    store,
    cfg,
    slug,
    clientHash: browserB,
    ua: "Mozilla/5.0",
    token: tokenA,
    payload: verified.payload,
    runId,
  });
  record(
    "6_browser_b_reload_not_requalified",
    reload.exclusions.includes("token_already_qualified") && !reload.qualified,
    reload.exclusions.join(","),
  );
}

// 7. Second distinct share token can qualify independently
{
  const browserC = hashClientId("browser-c-client", cfg.clientSalt);
  const browserD = hashClientId("browser-d-client", cfg.clientSalt);
  const token2 = issueShareToken({
    slug,
    creatorHash: browserC,
    seed: false,
    runId,
    hmacSecret: cfg.hmacSecret,
    ttlSeconds: cfg.tokenTtlSeconds,
  });
  acceptCreateShare({
    store,
    cfg,
    slug,
    clientHash: browserC,
    seed: false,
    token: token2,
    runId,
  });
  const verified = verifyShareToken(token2, cfg.hmacSecret, runId);
  const r = acceptShareArrival({
    store,
    cfg,
    slug,
    clientHash: browserD,
    ua: "Mozilla/5.0",
    token: token2,
    payload: verified.payload,
    runId,
  });
  record(
    "7_second_token_qualifies",
    Boolean(r.qualified),
    r.qualified ? r.qualified.id : r.exclusions.join(","),
  );
}

// 8. Modified token fails verification
{
  const [body, signature] = tokenA.split(".");
  const bad = `${body[0] === "A" ? "B" : "A"}${body.slice(1)}.${signature}`;
  const verified = verifyShareToken(bad, cfg.hmacSecret, runId);
  record(
    "8_modified_token_fails",
    verified.ok === false && verified.reason === "bad_signature",
    verified.reason,
  );
}

// 9. Token used with different slug fails at arrival exclusion
{
  const otherSlug = "move-fast-and-break-things";
  const verified = verifyShareToken(tokenA, cfg.hmacSecret, runId);
  assert.equal(verified.ok, true);
  const r = acceptShareArrival({
    store,
    cfg,
    slug: otherSlug,
    clientHash: hashClientId("browser-e", cfg.clientSalt),
    ua: "Mozilla/5.0",
    token: tokenA,
    payload: verified.payload,
    runId,
  });
  record(
    "9_slug_mismatch_excluded",
    r.exclusions.includes("slug_mismatch") && !r.qualified,
    r.exclusions.join(","),
  );
}

// 10. Expired token fails
{
  const expired = issueShareToken({
    slug,
    creatorHash: browserA,
    seed: false,
    runId,
    hmacSecret: cfg.hmacSecret,
    ttlSeconds: 1,
    nowMs: Date.now() - 60_000,
  });
  const verified = verifyShareToken(expired, cfg.hmacSecret, runId);
  record(
    "10_expired_token_fails",
    verified.ok === false && verified.reason === "expired_token",
    verified.reason,
  );
}

// 11. Crawler UA excluded
{
  const r = acceptResultView({
    store,
    cfg,
    slug,
    clientHash: hashClientId("crawler-client", cfg.clientSalt),
    ua: "Mozilla/5.0 (compatible; Googlebot/2.1)",
    runId,
  });
  record(
    "11_crawler_excluded",
    r.exclusions.includes("crawler_excluded") && !r.qualified,
    r.exclusions.join(","),
  );
}

// 12. A forged qualified row cannot be reduced without server-derived lineage.
// The hosted transcript separately exercises the API-level 400 rejection.
{
  let rejection = "";
  try {
    reduceEvents(
      [
        {
          id: "forged-qualified-propagation",
          type: "qualified_propagation",
          runId,
          at: new Date().toISOString(),
          slug,
          clientHash: "forged-recipient",
          creatorHash: "forged-creator",
          shareTokenFingerprint: "forged-token",
          derivedFrom: "missing-server-raw-event",
        },
      ],
      runId,
    );
  } catch (error) {
    rejection = String(error?.message || error);
  }
  record(
    "12_forged_qualified_row_rejected_by_reducer",
    rejection === "qualified_lineage_missing:forged-qualified-propagation",
    rejection,
  );
}

// 13. Result views recorded and deduped
{
  const viewer = hashClientId("viewer-1", cfg.clientSalt);
  const first = acceptResultView({
    store,
    cfg,
    slug,
    clientHash: viewer,
    ua: "Mozilla/5.0",
    runId,
  });
  const second = acceptResultView({
    store,
    cfg,
    slug,
    clientHash: viewer,
    ua: "Mozilla/5.0",
    runId,
  });
  record(
    "13_result_views_deduped",
    Boolean(first.qualified) &&
      second.exclusions.includes("repeat_view_deduped") &&
      !second.qualified,
    `first=${Boolean(first.qualified)} second=${second.exclusions.join(",")}`,
  );
}

// 14. Reducer emits raw counts + exclusion reasons
{
  const reduction = reduceEvents(store.list(), runId);
  record(
    "14_reducer_counts_and_exclusions",
    reduction.rawCounts.result_view >= 1 &&
      reduction.rawCounts.qualified_propagation >= 2 &&
      reduction.exclusions.length >= 1 &&
      typeof reduction.disposition === "string",
    JSON.stringify(reduction.rawCounts),
  );
  console.log("REDUCTION", JSON.stringify(reduction, null, 2));
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.error("FAILED", failed.map((f) => f.name));
  process.exit(1);
}
console.log("ACCEPTANCE_TRANSCRIPT=PASS");
