/**
 * Hosted acceptance against durable dual-API compose stack.
 * Env:
 *   MEASUREMENT_API_URL_A (default http://127.0.0.1:8787)
 *   MEASUREMENT_API_URL_B (default http://127.0.0.1:8788)
 *   MEASUREMENT_ADMIN_KEY
 *   MEASUREMENT_HMAC_SECRET
 *   MEASUREMENT_RUN_ID
 *   MEASUREMENT_ALLOWED_ORIGIN
 *   MEASUREMENT_OPERATOR_RAW (raw client id for operator profile)
 *   MEASUREMENT_RESTART_CMD (optional shell command to bounce api-a)
 */
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { hashClientId } from "../lib/config.js";
import { reduceWindowEvents } from "../lib/reducer.js";
import { issueShareToken } from "../lib/tokens.js";

function block(reason) {
  console.error(`HOSTED_ACCEPTANCE_TRANSCRIPT=BLOCKED reason=${reason}`);
  process.exit(2);
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) block(`missing_env:${name}`);
  return value;
}

const API_A = requiredEnv("MEASUREMENT_API_URL_A").replace(/\/$/, "");
const API_B = requiredEnv("MEASUREMENT_API_URL_B").replace(/\/$/, "");
const ADMIN = requiredEnv("MEASUREMENT_ADMIN_KEY");
const HMAC = requiredEnv("MEASUREMENT_HMAC_SECRET");
const SALT = requiredEnv("MEASUREMENT_CLIENT_SALT");
const RUN = requiredEnv("MEASUREMENT_RUN_ID");
const ORIGIN = requiredEnv("MEASUREMENT_ALLOWED_ORIGIN");
const RESTART_SPEC_JSON = requiredEnv("MEASUREMENT_RESTART_SPEC_JSON");
const TOPOLOGY_JSON = requiredEnv("MEASUREMENT_TOPOLOGY_EVIDENCE_JSON");
const slug = "culture-eats-strategy-for-breakfast";

const O = requiredEnv("MEASUREMENT_OPERATOR_RAW");
const A = "browser-a-profile-" + crypto.randomBytes(4).toString("hex");
const B = "browser-b-profile-" + crypto.randomBytes(4).toString("hex");
const C = "browser-c-profile-" + crypto.randomBytes(4).toString("hex");

if (API_A === API_B) block("api_urls_must_be_distinct");

let topology;
try {
  topology = JSON.parse(TOPOLOGY_JSON);
} catch {
  block("invalid_topology_evidence_json");
}
if (
  typeof topology?.apiA?.containerId !== "string" ||
  topology.apiA.containerId.length === 0 ||
  typeof topology?.apiB?.containerId !== "string" ||
  topology.apiB.containerId.length === 0 ||
  topology.apiA.containerId === topology.apiB.containerId ||
  typeof topology?.apiA?.imageId !== "string" ||
  topology.apiA.imageId.length === 0 ||
  topology.apiA.imageId !== topology?.apiB?.imageId
) {
  block("topology_does_not_prove_distinct_containers_on_one_image");
}

function endpointPort(api) {
  const url = new URL(api);
  if (
    url.protocol !== "http:" ||
    (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") ||
    !url.port
  ) {
    block("compose_api_endpoint_must_be_loopback_with_explicit_port");
  }
  return url.port;
}

function inspectContainer(containerId) {
  const format = [
    "{{.Id}}",
    "{{.Image}}",
    '{{index .Config.Labels "com.docker.compose.project"}}',
    '{{index .Config.Labels "com.docker.compose.service"}}',
    '{{(index (index .NetworkSettings.Ports "8787/tcp") 0).HostPort}}',
  ].join("|");
  const inspection = spawnSync(
    "docker",
    ["inspect", `--format=${format}`, containerId],
    { encoding: "utf8", shell: false },
  );
  if (inspection.error || inspection.status !== 0) return null;
  const [id, imageId, project, service, hostPort] = (inspection.stdout || "")
    .trim()
    .split("|");
  return { id, imageId, project, service, hostPort };
}

const inspectedA = inspectContainer(topology.apiA.containerId);
const inspectedB = inspectContainer(topology.apiB.containerId);
if (
  !inspectedA ||
  !inspectedB ||
  inspectedA.id !== topology.apiA.containerId ||
  inspectedB.id !== topology.apiB.containerId ||
  inspectedA.id === inspectedB.id ||
  inspectedA.imageId !== topology.apiA.imageId ||
  inspectedB.imageId !== topology.apiB.imageId ||
  inspectedA.imageId !== inspectedB.imageId ||
  !inspectedA.project?.startsWith("origin-g2-accept-") ||
  inspectedA.project !== inspectedB.project ||
  inspectedA.service !== "api-a" ||
  inspectedB.service !== "api-b" ||
  inspectedA.hostPort !== endpointPort(API_A) ||
  inspectedB.hostPort !== endpointPort(API_B)
) {
  block("docker_topology_is_not_bound_to_api_endpoints");
}

let restartSpec;
try {
  restartSpec = JSON.parse(RESTART_SPEC_JSON);
} catch {
  block("invalid_restart_spec_json");
}
if (
  typeof restartSpec?.command !== "string" ||
  restartSpec.command.length === 0 ||
  !Array.isArray(restartSpec?.args) ||
  restartSpec.args.length === 0 ||
  restartSpec.args.some((value) => typeof value !== "string" || value.length === 0)
) {
  block("invalid_restart_spec");
}
const projectIndex = restartSpec.args.indexOf("--project-name");
if (
  restartSpec.command !== "docker" ||
  restartSpec.args[0] !== "compose" ||
  projectIndex < 0 ||
  restartSpec.args[projectIndex + 1] !== inspectedA.project ||
  restartSpec.args.at(-2) !== "restart" ||
  restartSpec.args.at(-1) !== "api-a"
) {
  block("restart_spec_is_not_bound_to_api_a_project");
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function eventDigest(events) {
  return sha256(canonicalJson(events));
}

function isCanonicalUtc(value) {
  if (typeof value !== "string") return false;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
}

function reducerEvent(event) {
  return {
    id: event.id,
    type: event.type,
    runId: event.runId,
    at: event.at,
    slug: event.slug,
    clientHash: event.clientHash,
    creatorHash: event.creatorHash,
    shareTokenFingerprint: event.shareTokenFingerprint,
    seed: event.seed,
    derivedFrom: event.derivedFrom,
    exclusions: event.exclusions,
  };
}

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

async function readHealth(api) {
  try {
    const response = await fetch(`${api}/v1/health`);
    return { status: response.status, json: await response.json() };
  } catch {
    return { status: 0, json: null };
  }
}

async function waitForBootChange(api, priorBootId, attempts = 60) {
  for (let i = 0; i < attempts; i++) {
    const health = await readHealth(api);
    if (
      health.status === 200 &&
      health.json?.instance?.bootId &&
      health.json.instance.bootId !== priorBootId
    ) {
      return health.json;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

function validHealth(health, expectedLabel) {
  const text = JSON.stringify(health);
  return (
    health?.ledgerSchemaVersion === "v1" &&
    health?.ledgerSchemaReady === true &&
    health?.runId === RUN &&
    health?.bindings?.runId === RUN &&
    health?.instance?.label === expectedLabel &&
    /^[0-9a-f-]{36}$/.test(health?.instance?.bootId || "") &&
    isCanonicalUtc(health?.instance?.bootedAt) &&
    [
      health?.bindings?.configFingerprint,
      health?.bindings?.databaseBindingFingerprint,
      health?.bindings?.buildFingerprint,
    ].every((value) => /^sha256:[0-9a-f]{64}$/.test(value || "")) &&
    !text.includes("origin_measure_dev") &&
    !text.includes("postgres://")
  );
}

function sameLogicalBinding(a, b) {
  return (
    a?.runId === b?.runId &&
    a?.bindings?.configFingerprint === b?.bindings?.configFingerprint &&
    a?.bindings?.databaseBindingFingerprint ===
      b?.bindings?.databaseBindingFingerprint &&
    a?.bindings?.buildFingerprint === b?.bindings?.buildFingerprint
  );
}

async function exportSnapshot(api, scope = "run") {
  const response = await fetch(`${api}/v1/export?scope=${scope}`, {
    headers: { "x-admin-key": ADMIN },
  });
  const json = await response.json();
  const events = Array.isArray(json?.events) ? json.events : [];
  return { status: response.status, json, events, digest: eventDigest(events) };
}

const healthResponseA = await readHealth(API_A);
const healthResponseB = await readHealth(API_B);
const healthA = healthResponseA.json;
const healthB = healthResponseB.json;
if (
  healthResponseA.status !== 200 ||
  healthResponseB.status !== 200 ||
  !validHealth(healthA, "api-a") ||
  !validHealth(healthB, "api-b") ||
  healthA.instance.bootId === healthB.instance.bootId ||
  !sameLogicalBinding(healthA, healthB)
) {
  block("health_does_not_prove_distinct_identically_bound_instances");
}

const baselineA = await exportSnapshot(API_A, "all");
const baselineB = await exportSnapshot(API_B, "all");
if (
  baselineA.status !== 200 ||
  baselineB.status !== 200 ||
  baselineA.json?.scope !== "all" ||
  baselineB.json?.scope !== "all" ||
  baselineA.json?.activeRunId !== RUN ||
  baselineB.json?.activeRunId !== RUN ||
  baselineA.events.length !== 0 ||
  baselineB.events.length !== 0 ||
  baselineA.digest !== baselineB.digest
) {
  block("hosted_acceptance_requires_identical_empty_baseline");
}

console.log(
  "COMPOSE_TOPOLOGY_VERIFIED",
  `project=${inspectedA.project}`,
  `image=${inspectedA.imageId}`,
  `evidenceSha256=${sha256(canonicalJson(topology))}`,
);
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

const seedBody = {
  slug,
  seedKind: "operator",
  idempotencyKey: "ORIGIN_G2R_UI_REACCEPTANCE_OPERATOR_SEED_001",
};
let seedFixture = null;

// 9 seed token issuance is idempotent and its arrival is excluded
{
  const seed = await call(API_A, "POST", "/v1/admin/create-seed", {
    client: O,
    admin: true,
    body: seedBody,
  });
  const replay = await call(API_B, "POST", "/v1/admin/create-seed", {
    client: O,
    admin: true,
    body: seedBody,
  });
  const conflict = await call(API_A, "POST", "/v1/admin/create-seed", {
    client: O,
    admin: true,
    body: { ...seedBody, idempotencyKey: seedBody.idempotencyKey + "-CONFLICT" },
  });
  const r = await call(API_A, "POST", "/v1/share-arrival", {
    client: B,
    body: { slug, token: seed.json?.token },
  });
  seedFixture = seed.json;
  record(
    "9_seed_idempotent_and_arrival_excluded",
      seed.status === 201 &&
      seed.json?.replayed === false &&
      seed.json?.eventId === seed.json?.rawEventId &&
      replay.status === 200 &&
      replay.json?.replayed === true &&
      replay.json?.token === seed.json?.token &&
      replay.json?.rawEventId === seed.json?.rawEventId &&
      replay.json?.eventId === seed.json?.eventId &&
      conflict.status === 409 &&
      r.status === 201 &&
      r.json?.exclusions?.includes("seed_token_excluded"),
    `first=${seed.status} replay=${replay.status} conflict=${conflict.status}`,
  );
}

// 10 a seed recipient can create a fresh ordinary share that qualifies later
{
  const share = await call(API_B, "POST", "/v1/create-share", {
    client: B,
    body: { slug },
  });
  const propagated = await call(API_A, "POST", "/v1/share-arrival", {
    client: C,
    body: { slug, token: share.json?.token },
  });
  const operator = await call(API_A, "POST", "/v1/share-arrival", {
    client: O,
    body: { slug, token: share.json?.token },
  });
  record(
    "10_seed_recipient_multihop_and_operator_exclusion",
    propagated.status === 201 &&
      propagated.json?.qualifiedPropagation === true &&
      operator.status === 201 &&
      operator.json?.exclusions?.includes("operator_excluded"),
  );
}

// 11 modified, wrong-run, and legacy tokens are rejected
{
  const [body, signature] = tokenA.split(".");
  const bad = `${body[0] === "A" ? "B" : "A"}${body.slice(1)}.${signature}`;
  const modified = await call(API_A, "POST", "/v1/share-arrival", {
    client: C,
    body: { slug, token: bad },
  });
  const wrongRunToken = issueShareToken({
    slug,
    creatorHash: hashClientId(A, SALT),
    seed: false,
    runId: `${RUN}-WRONG`,
    hmacSecret: HMAC,
    ttlSeconds: 3600,
  });
  const wrongRun = await call(API_A, "POST", "/v1/share-arrival", {
    client: C,
    body: { slug, token: wrongRunToken },
  });
  const legacyBody = Buffer.from(
    JSON.stringify({
      v: 1,
      slug,
      creatorHash: hashClientId(A, SALT),
      seed: false,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      nonce: "legacy-acceptance-token",
    }),
  ).toString("base64url");
  const legacySig = crypto
    .createHmac("sha256", HMAC)
    .update(legacyBody)
    .digest("base64url");
  const legacy = await call(API_A, "POST", "/v1/share-arrival", {
    client: C,
    body: { slug, token: `${legacyBody}.${legacySig}` },
  });
  record(
    "11_modified_wrong_run_and_legacy_tokens_rejected",
    modified.status === 400 &&
      modified.json?.reason === "bad_signature" &&
      wrongRun.status === 400 &&
      wrongRun.json?.reason === "run_mismatch" &&
      legacy.status === 400 &&
      legacy.json?.reason === "unsupported_version",
  );
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
    runId: RUN,
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
  const beforeHealthA = (await readHealth(API_A)).json;
  const beforeHealthB = (await readHealth(API_B)).json;
  const beforeA = await exportSnapshot(API_A);
  const beforeB = await exportSnapshot(API_B);
  const restart = spawnSync(restartSpec.command, restartSpec.args, {
    stdio: "inherit",
    shell: false,
  });
  if (restart.error || restart.status !== 0) {
    block("restart_command_failed");
  }
  const restartedA = await waitForBootChange(API_A, beforeHealthA?.instance?.bootId);
  if (!restartedA) block("restart_boot_change_not_observed");
  const afterHealthB = (await readHealth(API_B)).json;
  const afterA = await exportSnapshot(API_A);
  const afterB = await exportSnapshot(API_B);
  const replay = await call(API_B, "POST", "/v1/admin/create-seed", {
    client: O,
    admin: true,
    body: seedBody,
  });
  const afterReplayA = await exportSnapshot(API_A);
  const afterReplayB = await exportSnapshot(API_B);
  record(
    "15_restart_events_preserved",
    beforeA.status === 200 &&
      beforeB.status === 200 &&
      beforeA.events.length > 0 &&
      beforeA.digest === beforeB.digest &&
      validHealth(restartedA, "api-a") &&
      sameLogicalBinding(beforeHealthA, restartedA) &&
      afterHealthB?.instance?.bootId === beforeHealthB?.instance?.bootId &&
      sameLogicalBinding(beforeHealthB, afterHealthB) &&
      afterA.digest === beforeA.digest &&
      afterB.digest === beforeA.digest &&
      replay.status === 200 &&
      replay.json?.replayed === true &&
      replay.json?.token === seedFixture?.token &&
      replay.json?.eventId === seedFixture?.eventId &&
      afterReplayA.digest === beforeA.digest &&
      afterReplayB.digest === beforeA.digest,
    `events=${beforeA.events.length} digest=${beforeA.digest}`,
  );
}

// 16 concurrent duplicate arrivals → one qualification
let scenario16ShareRawId = null;
let scenario16ArrivalRawIds = [];
{
  const share = await call(API_A, "POST", "/v1/create-share", {
    client: A + "-conc",
    body: { slug },
  });
  scenario16ShareRawId = share.json?.rawEventId;
  const token = share.json?.token;
  const recipient = "concurrent-recipient-" + crypto.randomBytes(3).toString("hex");
  const [r1, r2] = await Promise.all([
    call(API_A, "POST", "/v1/share-arrival", { client: recipient, body: { slug, token } }),
    call(API_B, "POST", "/v1/share-arrival", { client: recipient, body: { slug, token } }),
  ]);
  scenario16ArrivalRawIds = [r1.json?.rawEventId, r2.json?.rawEventId];
  const quals = [r1, r2].filter((r) => r.json?.qualifiedPropagation === true).length;
  const loser = [r1, r2].find((r) => r.json?.qualifiedPropagation === false);
  const exportedA = await exportSnapshot(API_A);
  const exportedB = await exportSnapshot(API_B);
  const rawRows = exportedA.events.filter((event) =>
    scenario16ArrivalRawIds.includes(event.id),
  );
  const qualifiedRows = exportedA.events.filter(
    (event) =>
      event.type === "qualified_propagation" &&
      scenario16ArrivalRawIds.includes(event.derivedFrom),
  );
  const loserRow = exportedA.events.find((event) => event.id === loser?.json?.rawEventId);
  record(
    "16_concurrent_duplicate_one_qualification",
    share.status === 201 &&
      typeof scenario16ShareRawId === "string" &&
      r1.status === 201 &&
      r2.status === 201 &&
      new Set(scenario16ArrivalRawIds).size === 2 &&
      quals === 1 &&
      loser?.json?.exclusions?.includes("token_already_qualified") &&
      exportedA.digest === exportedB.digest &&
      rawRows.length === 2 &&
      qualifiedRows.length === 1 &&
      loserRow?.exclusions?.includes("token_already_qualified"),
    `quals=${quals} digest=${exportedA.digest}`,
  );
}

// 17 parallel instances share result-view dedupe state
let scenario17RawIds = [];
{
  await new Promise((resolve) => setTimeout(resolve, 25));
  const viewer = "concurrent-viewer-" + crypto.randomBytes(3).toString("hex");
  const [r1, r2] = await Promise.all([
    call(API_A, "POST", "/v1/result-view", { client: viewer, body: { slug } }),
    call(API_B, "POST", "/v1/result-view", { client: viewer, body: { slug } }),
  ]);
  scenario17RawIds = [r1.json?.rawEventId, r2.json?.rawEventId];
  const quals = [r1, r2].filter((r) => r.json?.qualifiedResultView === true).length;
  const loser = [r1, r2].find((r) => r.json?.qualifiedResultView === false);
  const exportedA = await exportSnapshot(API_A);
  const exportedB = await exportSnapshot(API_B);
  const rawRows = exportedA.events.filter((event) =>
    scenario17RawIds.includes(event.id),
  );
  const qualifiedRows = exportedA.events.filter(
    (event) =>
      event.type === "qualified_result_view" &&
      scenario17RawIds.includes(event.derivedFrom),
  );
  const loserRow = exportedA.events.find((event) => event.id === loser?.json?.rawEventId);
  const scenario16Rows = exportedA.events.filter((event) =>
    scenario16ArrivalRawIds.includes(event.id),
  );
  const strictlyAfterScenario16 =
    rawRows.length === 2 &&
    scenario16Rows.length === 2 &&
    Math.min(...rawRows.map((event) => Date.parse(event.at))) >
      Math.max(...scenario16Rows.map((event) => Date.parse(event.at)));
  record(
    "17_parallel_instances_shared_dedupe",
    r1.status === 201 &&
      r2.status === 201 &&
      new Set(scenario17RawIds).size === 2 &&
      quals === 1 &&
      loser?.json?.exclusions?.includes("repeat_view_deduped") &&
      exportedA.digest === exportedB.digest &&
      rawRows.length === 2 &&
      qualifiedRows.length === 1 &&
      loserRow?.exclusions?.includes("repeat_view_deduped") &&
      strictlyAfterScenario16,
    `quals=${quals} digest=${exportedA.digest}`,
  );
}

// 18 exact run/window reducer parity across local, reversed, API-A, and API-B
{
  const exportedA = await exportSnapshot(API_A, "all");
  const exportedB = await exportSnapshot(API_B, "all");
  const shareRow = exportedA.events.find((event) => event.id === scenario16ShareRawId);
  const endRows = exportedA.events.filter((event) => scenario17RawIds.includes(event.id));
  const startUtc = shareRow?.at;
  const endUtc = endRows.map((event) => event.at).sort()[0];
  const reducerEvents = exportedA.events.map(reducerEvent);
  let local = null;
  let reversed = null;
  try {
    local = reduceWindowEvents(reducerEvents, { runId: RUN, startUtc, endUtc });
    reversed = reduceWindowEvents([...reducerEvents].reverse(), {
      runId: RUN,
      startUtc,
      endUtc,
    });
  } catch {
    local = null;
    reversed = null;
  }
  const query = new URLSearchParams({ startUtc: startUtc || "", endUtc: endUtc || "" });
  const responseA = await fetch(`${API_A}/v1/reduce?${query}`, {
    headers: { "x-admin-key": ADMIN },
  });
  const responseB = await fetch(`${API_B}/v1/reduce?${query}`, {
    headers: { "x-admin-key": ADMIN },
  });
  const reductionA = await responseA.json();
  const reductionB = await responseB.json();
  const localJson = canonicalJson(local);
  const exactParity =
    local &&
    localJson === canonicalJson(reversed) &&
    localJson === canonicalJson(reductionA?.reduction) &&
    localJson === canonicalJson(reductionB?.reduction);
  record(
    "18_reducer_parity",
    exportedA.status === 200 &&
      exportedB.status === 200 &&
      exportedA.digest === exportedB.digest &&
      responseA.status === 200 &&
      responseB.status === 200 &&
      exactParity &&
      local?.runId === RUN &&
      local?.window?.semantics === "[startUtc,endUtc)" &&
      local?.rawCounts?.share_created === 1 &&
      local?.rawCounts?.propagated_visit === 2 &&
      local?.rawCounts?.qualified_propagation === 1 &&
      local?.rawCounts?.result_view === 0 &&
      local?.rawCounts?.qualified_result_view === 0 &&
      local?.distinctSharerSessions === 1 &&
      local?.windowExclusionCounts?.wrongRun === 0 &&
      local?.windowExclusionCounts?.beforeStart > 0 &&
      local?.windowExclusionCounts?.atOrAfterEnd >= 3 &&
      local?.exclusions?.some((item) => item.reason === "token_already_qualified") &&
      local?.disposition === "HOLD_ONCE",
    `export=${exportedA.digest} reduction=${sha256(localJson)}`,
  );
}

// 19 export admin-only
{
  const unauth = await fetch(`${API_A}/v1/export`);
  const unauthAll = await fetch(`${API_A}/v1/export?scope=all`);
  const invalidScope = await fetch(`${API_A}/v1/export?scope=invalid`, {
    headers: { "x-admin-key": ADMIN },
  });
  record(
    "19_export_admin_only",
    unauth.status === 401 && unauthAll.status === 401 && invalidScope.status === 400,
  );
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
  const operatorSeedImpostor = await call(
    API_A,
    "POST",
    "/v1/admin/create-seed",
    {
      client: A,
      admin: true,
      body: {
        slug,
        seedKind: "operator",
        idempotencyKey: "IMPOSTOR-OPERATOR-SEED",
      },
    },
  );
  record(
    "20_origin_public_seed_and_operator_impostor_rejected",
    badOrigin.status === 403 &&
      seedPublic.status === 403 &&
      operatorSeedImpostor.status === 403 &&
      operatorSeedImpostor.json?.error ===
        "operator_seed_requires_operator_client",
    `origin=${badOrigin.status} seed=${seedPublic.status} impostor=${operatorSeedImpostor.status}`,
  );
}

const expectedScenarioNames = [
  "1_operator_view_excluded",
  "2_crawler_view_excluded",
  "3_first_human_view_qualified",
  "4_repeat_view_deduped",
  "5_normal_share_issued",
  "6_creator_self_excluded",
  "7_distinct_recipient_qualified",
  "8_reload_not_requalified",
  "9_seed_idempotent_and_arrival_excluded",
  "10_seed_recipient_multihop_and_operator_exclusion",
  "11_modified_wrong_run_and_legacy_tokens_rejected",
  "12_slug_mismatch_excluded",
  "13_expired_token_rejected",
  "14_qualified_submission_rejected",
  "15_restart_events_preserved",
  "16_concurrent_duplicate_one_qualification",
  "17_parallel_instances_shared_dedupe",
  "18_reducer_parity",
  "19_export_admin_only",
  "20_origin_public_seed_and_operator_impostor_rejected",
];
const exactScenarioSet =
  results.length === expectedScenarioNames.length &&
  results.every((result, index) => result.name === expectedScenarioNames[index]);
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (!exactScenarioSet || failed.length) {
  if (!exactScenarioSet) console.error("FAILED scenario_set_mismatch");
  console.error("FAILED", failed.map((f) => f.name));
  process.exit(1);
}
console.log("HOSTED_ACCEPTANCE_TRANSCRIPT=PASS");
