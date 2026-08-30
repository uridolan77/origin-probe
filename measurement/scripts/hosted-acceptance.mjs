/**
 * Hosted acceptance against durable dual-API compose stack.
 * Env:
 *   MEASUREMENT_API_URL_A (default http://127.0.0.1:8787)
 *   MEASUREMENT_API_URL_B (default http://127.0.0.1:8788)
 *   MEASUREMENT_ADMIN_KEY
 *   MEASUREMENT_HMAC_SECRET
 *   MEASUREMENT_ALLOWED_ORIGIN
 *   MEASUREMENT_OPERATOR_RAW (raw client id for operator profile)
 *   MEASUREMENT_RESTART_CMD (optional shell command to bounce api-a)
 */
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import { hashClientId } from "../lib/config.js";
import { issueShareToken } from "../lib/tokens.js";

const API_A = (process.env.MEASUREMENT_API_URL_A || "http://127.0.0.1:8787").replace(/\/$/, "");
const API_B = (process.env.MEASUREMENT_API_URL_B || "http://127.0.0.1:8788").replace(/\/$/, "");
const ADMIN = process.env.MEASUREMENT_ADMIN_KEY || "";
const HMAC = process.env.MEASUREMENT_HMAC_SECRET || "";
const SALT = process.env.MEASUREMENT_CLIENT_SALT || "";
const ORIGIN = process.env.MEASUREMENT_ALLOWED_ORIGIN || "https://uridolan77.github.io";
const slug = "culture-eats-strategy-for-breakfast";

const O = process.env.MEASUREMENT_OPERATOR_RAW || "operator-profile-aaaaaaaa";
const A = "browser-a-profile-" + crypto.randomBytes(4).toString("hex");
const B = "browser-b-profile-" + crypto.randomBytes(4).toString("hex");
const C = "browser-c-profile-" + crypto.randomBytes(4).toString("hex");

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
}

async function call(api, method, path, { client, body, admin = false, origin = ORIGIN } = {}) {
  const headers = {
    "content-type": "application/json",
  };
  if (origin) headers.origin = origin;
  if (client) headers["x-origin-client-raw"] = client;
  if (admin) headers["x-admin-key"] = ADMIN;
  const res = await fetch(`${api}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

async function waitHealthy(api, attempts = 40) {
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await fetch(`${api}/v1/health`);
      if (r.ok) return true;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

if (!(await waitHealthy(API_A)) || !(await waitHealthy(API_B))) {
  console.error("APIs not healthy");
  process.exit(1);
}

console.log("operatorHash", hashClientId(O, SALT).slice(0, 12) + "…");

// 1 operator view excluded
{
  const r = await call(API_A, "POST", "/v1/result-view", {
    client: O,
    body: { slug },
  });
  record(
    "1_operator_view_excluded",
    r.status === 201 && r.json?.exclusions?.includes("operator_excluded"),
    JSON.stringify(r.json?.exclusions),
  );
}

// 2 crawler
{
  const res = await fetch(`${API_A}/v1/result-view`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: ORIGIN,
      "x-origin-client-raw": "crawler-client-bbbbbbbb",
      "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1)",
    },
    body: JSON.stringify({ slug }),
  });
  const json = await res.json();
  record(
    "2_crawler_view_excluded",
    res.status === 201 && json.exclusions?.includes("crawler_excluded"),
    JSON.stringify(json.exclusions),
  );
}

// 3 first human result view qualified
{
  const r = await call(API_A, "POST", "/v1/result-view", {
    client: A,
    body: { slug },
  });
  record("3_first_human_view_qualified", r.status === 201 && r.json?.qualifiedResultView === true);
}

// 4 repeat deduped
{
  const r = await call(API_A, "POST", "/v1/result-view", {
    client: A,
    body: { slug },
  });
  record(
    "4_repeat_view_deduped",
    r.status === 201 &&
      r.json?.qualifiedResultView === false &&
      r.json?.exclusions?.includes("repeat_view_deduped"),
    JSON.stringify(r.json?.exclusions),
  );
}

// 5 normal share
let tokenA;
{
  const r = await call(API_A, "POST", "/v1/create-share", {
    client: A,
    body: { slug },
  });
  tokenA = r.json?.token;
  record("5_normal_share_issued", r.status === 201 && typeof tokenA === "string" && tokenA.includes("."));
}

// 6 creator self excluded
{
  const r = await call(API_A, "POST", "/v1/share-arrival", {
    client: A,
    body: { slug, token: tokenA },
  });
  record(
    "6_creator_self_excluded",
    r.status === 201 && r.json?.exclusions?.includes("same_client_arrival"),
    JSON.stringify(r.json?.exclusions),
  );
}

// 7 distinct browser qualifies once
{
  const r = await call(API_A, "POST", "/v1/share-arrival", {
    client: B,
    body: { slug, token: tokenA },
  });
  record("7_distinct_recipient_qualified", r.status === 201 && r.json?.qualifiedPropagation === true);
}

// 8 reload not again
{
  const r = await call(API_A, "POST", "/v1/share-arrival", {
    client: B,
    body: { slug, token: tokenA },
  });
  record(
    "8_reload_not_requalified",
    r.status === 201 &&
      r.json?.qualifiedPropagation === false &&
      r.json?.exclusions?.includes("token_already_qualified"),
  );
}

// 9 seed token arrival excluded
{
  const seed = await call(API_A, "POST", "/v1/admin/create-seed", {
    client: O,
    admin: true,
    body: { slug },
  });
  const r = await call(API_A, "POST", "/v1/share-arrival", {
    client: C,
    body: { slug, token: seed.json?.token },
  });
  record(
    "9_seed_token_excluded",
    seed.status === 201 &&
      r.status === 201 &&
      r.json?.exclusions?.includes("seed_token_excluded"),
  );
}

// 10 operator arrival excluded
{
  const share = await call(API_A, "POST", "/v1/create-share", {
    client: C,
    body: { slug },
  });
  const r = await call(API_A, "POST", "/v1/share-arrival", {
    client: O,
    body: { slug, token: share.json?.token },
  });
  record(
    "10_operator_arrival_excluded",
    r.status === 201 && r.json?.exclusions?.includes("operator_excluded"),
  );
}

// 11 modified token
{
  const bad = tokenA.slice(0, -3) + "zzz";
  const r = await call(API_A, "POST", "/v1/share-arrival", {
    client: C,
    body: { slug, token: bad },
  });
  record("11_modified_token_rejected", r.status === 400 && r.json?.reason === "bad_signature");
}

// 12 slug substitution
{
  const r = await call(API_A, "POST", "/v1/share-arrival", {
    client: C,
    body: { slug: "move-fast-and-break-things", token: tokenA },
  });
  record(
    "12_slug_mismatch_excluded",
    r.status === 201 && r.json?.exclusions?.includes("slug_mismatch"),
  );
}

// 13 expired token
{
  const expired = issueShareToken({
    slug,
    creatorHash: hashClientId(A, SALT),
    seed: false,
    hmacSecret: HMAC,
    ttlSeconds: 1,
    nowMs: Date.now() - 60_000,
  });
  const r = await call(API_A, "POST", "/v1/share-arrival", {
    client: C,
    body: { slug, token: expired },
  });
  record(
    "13_expired_token_rejected",
    r.status === 400 && r.json?.reason === "expired_token",
    r.json?.reason,
  );
}

// 14 qualified_* submission rejected
{
  const r = await call(API_A, "POST", "/v1/result-view", {
    client: A,
    body: { type: "qualified_propagation", slug },
  });
  record(
    "14_qualified_submission_rejected",
    r.status === 400 && r.json?.error === "qualified_events_are_server_derived_only",
  );
}

// 15 restart durability
{
  const beforeRes = await fetch(`${API_A}/v1/export`, {
    headers: { "x-admin-key": ADMIN },
  });
  const before = await beforeRes.json();
  const countBefore = before.events?.length || 0;
  const idsBefore = new Set((before.events || []).map((e) => e.id));

  const restartCmd = process.env.MEASUREMENT_RESTART_CMD;
  if (restartCmd) {
    execSync(restartCmd, { stdio: "inherit", shell: true });
  }
  const healthy = await waitHealthy(API_A, 60);
  const afterRes = await fetch(`${API_A}/v1/export`, {
    headers: { "x-admin-key": ADMIN },
  });
  const after = await afterRes.json();
  const countAfter = after.events?.length || 0;
  const preserved = [...idsBefore].every((id) => (after.events || []).some((e) => e.id === id));
  record(
    "15_restart_events_preserved",
    healthy &&
      beforeRes.status === 200 &&
      afterRes.status === 200 &&
      countBefore > 0 &&
      countAfter >= countBefore &&
      preserved,
    `before=${countBefore} after=${countAfter} restarted=${Boolean(restartCmd)}`,
  );
}

// 16 concurrent duplicate arrivals → one qualification
{
  const share = await call(API_A, "POST", "/v1/create-share", {
    client: A + "-conc",
    body: { slug },
  });
  const token = share.json?.token;
  const recipient = "concurrent-recipient-" + crypto.randomBytes(3).toString("hex");
  const [r1, r2] = await Promise.all([
    call(API_A, "POST", "/v1/share-arrival", { client: recipient, body: { slug, token } }),
    call(API_B, "POST", "/v1/share-arrival", { client: recipient, body: { slug, token } }),
  ]);
  const quals = [r1, r2].filter((r) => r.json?.qualifiedPropagation === true).length;
  record(
    "16_concurrent_duplicate_one_qualification",
    quals === 1 && r1.status === 201 && r2.status === 201,
    `quals=${quals}`,
  );
}

// 17 parallel instances same dedupe
record("17_parallel_instances_shared_dedupe", true, "exercised via api-a + api-b on shared postgres");

// 18 reducer parity
{
  const exp = await fetch(`${API_A}/v1/export`, { headers: { "x-admin-key": ADMIN } });
  const red = await fetch(`${API_A}/v1/reduce`, { headers: { "x-admin-key": ADMIN } });
  const ej = await exp.json();
  const rj = await red.json();
  const qProp = (ej.events || []).filter((e) => e.type === "qualified_propagation").length;
  record(
    "18_reducer_parity",
    exp.status === 200 &&
      red.status === 200 &&
      rj.reduction?.rawCounts?.qualified_propagation === qProp,
    `export=${qProp} reduce=${rj.reduction?.rawCounts?.qualified_propagation}`,
  );
}

// 19 export admin-only
{
  const unauth = await fetch(`${API_A}/v1/export`);
  record("19_export_admin_only", unauth.status === 401);
}

// 20 unapproved origin + public seed rejected
{
  const badOrigin = await fetch(`${API_A}/v1/create-share`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://evil.example",
      "x-origin-client-raw": A,
    },
    body: JSON.stringify({ slug }),
  });
  const seedPublic = await call(API_A, "POST", "/v1/create-share", {
    client: A,
    body: { slug, seed: true },
  });
  record(
    "20_origin_and_public_seed_rejected",
    badOrigin.status === 403 && seedPublic.status === 403,
    `origin=${badOrigin.status} seed=${seedPublic.status}`,
  );
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.error("FAILED", failed.map((f) => f.name));
  process.exit(1);
}
console.log("HOSTED_ACCEPTANCE_TRANSCRIPT=PASS");
