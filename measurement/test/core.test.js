import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  issueShareToken,
  MAX_SHARE_TOKEN_LENGTH,
  verifyShareToken,
} from "../lib/tokens.js";
import {
  b64url,
  getBindingEvidence,
  getConfig,
  hashClientId,
} from "../lib/config.js";
import { reduceEvents, reduceWindowEvents } from "../lib/reducer.js";

const RUN = "ORIGIN-G2R-UI-REACCEPTANCE-001";
const SLUG = "culture-eats-strategy-for-breakfast";

function issue(overrides = {}) {
  return issueShareToken({
    slug: SLUG,
    creatorHash: hashClientId("abc", "salt"),
    seed: false,
    runId: RUN,
    hmacSecret: "test-secret",
    ttlSeconds: 3600,
    ...overrides,
  });
}

test("v2 HMAC token round-trips with an exact run binding", () => {
  const token = issue();
  const v = verifyShareToken(token, "test-secret", RUN);
  assert.equal(v.ok, true);
  assert.equal(v.payload.v, 2);
  assert.equal(v.payload.runId, RUN);
  assert.equal(v.payload.slug, SLUG);
  assert.equal(v.payload.seed, false);
});

test("tampered token fails", () => {
  const token = issue();
  const v = verifyShareToken(token + "x", "test-secret", RUN);
  assert.equal(v.ok, false);
  assert.equal(v.reason, "bad_signature");
});

test("wrong-run and legacy tokens fail closed", () => {
  const wrongRun = verifyShareToken(issue(), "test-secret", `${RUN}-OTHER`);
  assert.deepEqual(wrongRun, { ok: false, reason: "run_mismatch" });

  const legacyBody = b64url(
    JSON.stringify({
      v: 1,
      slug: SLUG,
      creatorHash: "legacy",
      seed: false,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      nonce: "legacy",
    }),
  );
  const legacySig = b64url(
    crypto.createHmac("sha256", "test-secret").update(legacyBody).digest(),
  );
  assert.deepEqual(
    verifyShareToken(`${legacyBody}.${legacySig}`, "test-secret", RUN),
    { ok: false, reason: "unsupported_version" },
  );
});

test("token parser requires exactly two canonical base64url segments", () => {
  const token = issue();
  for (const malformed of [
    `${token}.ignored`,
    `.${token.split(".")[1]}`,
    `${token.split(".")[0]}.bad+segment`,
    "a.b",
    "x".repeat(MAX_SHARE_TOKEN_LENGTH + 1),
  ]) {
    assert.equal(
      verifyShareToken(malformed, "test-secret", RUN).reason,
      "malformed_token",
    );
  }
});

test("complete signed tokens are preserved through the 4096-byte limit", () => {
  const token = issue({ creatorHash: "c".repeat(2700) });
  assert.ok(token.length < MAX_SHARE_TOKEN_LENGTH);
  const verified = verifyShareToken(token, "test-secret", RUN);
  assert.equal(verified.ok, true);
  assert.equal(verified.payload.creatorHash.length, 2700);
});

test("configuration has no implicit measurement run", () => {
  const prior = process.env.MEASUREMENT_RUN_ID;
  delete process.env.MEASUREMENT_RUN_ID;
  try {
    assert.throws(() => getConfig(), /missing_env:MEASUREMENT_RUN_ID/);
  } finally {
    if (prior === undefined) delete process.env.MEASUREMENT_RUN_ID;
    else process.env.MEASUREMENT_RUN_ID = prior;
  }
});

test("health binding evidence binds build/config/database without raw secrets", () => {
  const cfg = {
    runId: RUN,
    tokenTtlSeconds: 1209600,
    viewDedupeSeconds: 21600,
    operatorHashes: new Set(["operator-hash"]),
  };
  const databaseUrl = "postgres://ledger:super-secret@db.example/private";
  const env = {
    MEASUREMENT_ALLOWED_ORIGIN: "https://uridolan77.github.io",
    VERCEL_DEPLOYMENT_ID: "dpl_example",
    VERCEL_GIT_COMMIT_SHA: "abc123",
    VERCEL_URL: "unique-deployment.vercel.app",
    VERCEL_PROJECT_PRODUCTION_URL: "origin-probe-measure.vercel.app",
    VERCEL_ENV: "production",
  };
  const evidence = getBindingEvidence({ cfg, databaseUrl, env });
  assert.equal(evidence.runId, RUN);
  assert.deepEqual(evidence.build, {
    deploymentId: "dpl_example",
    commitSha: "abc123",
    url: "unique-deployment.vercel.app",
    productionUrl: "origin-probe-measure.vercel.app",
    environment: "production",
  });
  assert.match(evidence.configFingerprint, /^sha256:[0-9a-f]{64}$/);
  assert.match(evidence.databaseBindingFingerprint, /^sha256:[0-9a-f]{64}$/);
  assert.match(evidence.buildFingerprint, /^sha256:[0-9a-f]{64}$/);
  assert.equal(JSON.stringify(evidence).includes("super-secret"), false);
  assert.equal(JSON.stringify(evidence).includes(databaseUrl), false);
  assert.notEqual(
    evidence.databaseBindingFingerprint,
    getBindingEvidence({
      cfg,
      databaseUrl: `${databaseUrl}-other`,
      env,
    }).databaseBindingFingerprint,
  );
});

test("reducer hold when below thresholds", () => {
  const r = reduceEvents(
    [
      {
        id: "raw-1",
        type: "result_view",
        runId: "r",
        at: "2026-08-30T12:00:00.000Z",
        slug: SLUG,
        clientHash: "viewer",
      },
      {
        id: "1",
        type: "qualified_result_view",
        runId: "r",
        at: "2026-08-30T12:00:00.001Z",
        slug: SLUG,
        clientHash: "viewer",
        derivedFrom: "raw-1",
      },
    ],
    "r",
  );
  assert.equal(r.disposition, "HOLD_ONCE");
});

test("window reducer applies [start,end) and reports boundary/run exclusions", () => {
  const events = [
    {
      id: "wrong",
      type: "result_view",
      runId: "other",
      at: "2026-08-30T12:30:00.000Z",
    },
    {
      id: "before",
      type: "result_view",
      runId: "r",
      at: "2026-08-30T11:59:59.999Z",
    },
    {
      id: "raw-view",
      type: "result_view",
      runId: "r",
      at: "2026-08-30T12:00:00.000Z",
      slug: SLUG,
      clientHash: "viewer",
    },
    {
      id: "start",
      type: "qualified_result_view",
      runId: "r",
      at: "2026-08-30T12:00:00.000Z",
      slug: SLUG,
      clientHash: "viewer",
      derivedFrom: "raw-view",
    },
    {
      id: "raw-arrival",
      type: "propagated_visit",
      runId: "r",
      at: "2026-08-30T12:59:59.999Z",
      slug: SLUG,
      clientHash: "recipient",
      creatorHash: "creator",
      shareTokenFingerprint: "fingerprint",
      seed: false,
    },
    {
      id: "inside",
      type: "qualified_propagation",
      runId: "r",
      at: "2026-08-30T12:59:59.999Z",
      slug: SLUG,
      clientHash: "recipient",
      creatorHash: "creator",
      shareTokenFingerprint: "fingerprint",
      derivedFrom: "raw-arrival",
    },
    {
      id: "end",
      type: "result_view",
      runId: "r",
      at: "2026-08-30T13:00:00.000Z",
    },
    {
      id: "after",
      type: "result_view",
      runId: "r",
      at: "2026-08-30T13:00:00.001Z",
    },
  ];
  const options = {
    runId: "r",
    startUtc: "2026-08-30T12:00:00Z",
    endUtc: "2026-08-30T13:00:00Z",
  };
  const reduction = reduceWindowEvents(events, options);
  assert.equal(reduction.qualifiedResultViews, 1);
  assert.equal(reduction.qualifiedPropagations, 1);
  assert.equal(reduction.distinctSharerSessions, 1);
  assert.deepEqual(reduction.windowExclusionCounts, {
    wrongRun: 1,
    beforeStart: 1,
    atOrAfterEnd: 2,
  });
  assert.deepEqual(
    reduction,
    reduceWindowEvents([...events].reverse(), options),
  );
});

test("window reducer hard-fails corrupt evidence without a disposition", () => {
  const options = {
    runId: "r",
    startUtc: "2026-08-30T12:00:00Z",
    endUtc: "2026-08-30T13:00:00Z",
  };
  const base = {
    id: "event",
    type: "result_view",
    runId: "r",
    at: "2026-08-30T12:30:00.000Z",
  };
  assert.throws(
    () => reduceWindowEvents([{ ...base, at: "2026-08-30 12:30:00Z" }], options),
    /invalid_event_timestamp/,
  );
  assert.throws(
    () => reduceWindowEvents([base, { ...base }], options),
    /duplicate_event_id/,
  );
  assert.throws(
    () =>
      reduceWindowEvents(
        [{ ...base, type: "qualified_propagation", clientHash: "recipient" }],
        options,
      ),
    /malformed_qualified_propagation/,
  );
  assert.throws(
    () =>
      reduceWindowEvents(
        [
          {
            ...base,
            type: "qualified_result_view",
            slug: SLUG,
            derivedFrom: "raw-view",
          },
        ],
        options,
      ),
    /malformed_qualified_result_view/,
  );
  assert.throws(
    () =>
      reduceWindowEvents([], {
        ...options,
        startUtc: "2026-08-30T15:00:00+03:00",
      }),
    /invalid_start_utc/,
  );
});

test("window reducer validates complete server-derived lineage", () => {
  const options = {
    runId: "r",
    startUtc: "2026-08-30T12:00:00Z",
    endUtc: "2026-08-30T13:00:00Z",
  };
  const raw = {
    id: "raw",
    type: "propagated_visit",
    runId: "r",
    at: "2026-08-30T12:30:00.000Z",
    slug: SLUG,
    clientHash: "recipient",
    creatorHash: "creator",
    shareTokenFingerprint: "fingerprint",
    seed: false,
    exclusions: [],
  };
  const qualified = {
    id: "qualified",
    type: "qualified_propagation",
    runId: "r",
    at: "2026-08-30T12:30:00.001Z",
    slug: SLUG,
    clientHash: "recipient",
    creatorHash: "creator",
    shareTokenFingerprint: "fingerprint",
    derivedFrom: "raw",
  };
  assert.equal(
    reduceWindowEvents([qualified, raw], options).qualifiedPropagations,
    1,
  );
  assert.throws(
    () => reduceWindowEvents([qualified], options),
    /qualified_lineage_missing/,
  );
  assert.throws(
    () =>
      reduceWindowEvents(
        [{ ...raw, type: "result_view" }, qualified],
        options,
      ),
    /qualified_lineage_type/,
  );
  for (const [field, value] of [
    ["runId", "other"],
    ["slug", "move-fast-and-break-things"],
    ["clientHash", "other-recipient"],
    ["creatorHash", "other-creator"],
    ["shareTokenFingerprint", "other-fingerprint"],
  ]) {
    assert.throws(
      () =>
        reduceWindowEvents([{ ...raw, [field]: value }, qualified], options),
      new RegExp(`qualified_lineage_mismatch:qualified:${field}`),
    );
  }
  assert.throws(
    () => reduceWindowEvents([{ ...raw, seed: true }, qualified], options),
    /qualified_lineage_seed/,
  );
  assert.throws(
    () =>
      reduceWindowEvents(
        [raw, qualified, { ...qualified, id: "qualified-duplicate" }],
        options,
      ),
    /qualified_lineage_duplicate:raw/,
  );
  assert.throws(
    () =>
      reduceWindowEvents(
        [{ ...raw, exclusions: ["operator_excluded"] }, qualified],
        options,
      ),
    /qualified_lineage_excluded_raw/,
  );

  const rawView = {
    id: "raw-view-lineage",
    type: "result_view",
    runId: "r",
    at: "2026-08-30T12:40:00.000Z",
    slug: SLUG,
    clientHash: "viewer",
    exclusions: [],
  };
  const qualifiedView = {
    id: "qualified-view-lineage",
    type: "qualified_result_view",
    runId: "r",
    at: "2026-08-30T12:40:00.001Z",
    slug: SLUG,
    clientHash: "viewer",
    derivedFrom: "raw-view-lineage",
  };
  assert.equal(
    reduceWindowEvents([qualifiedView, rawView], options).qualifiedResultViews,
    1,
  );
  assert.throws(
    () => reduceWindowEvents([qualifiedView], options),
    /qualified_lineage_missing/,
  );
  assert.throws(
    () =>
      reduceWindowEvents(
        [{ ...rawView, type: "propagated_visit" }, qualifiedView],
        options,
      ),
    /qualified_lineage_type/,
  );
  for (const [field, value] of [
    ["runId", "other"],
    ["slug", "move-fast-and-break-things"],
    ["clientHash", "other-viewer"],
  ]) {
    assert.throws(
      () =>
        reduceWindowEvents(
          [{ ...rawView, [field]: value }, qualifiedView],
          options,
        ),
      new RegExp(`qualified_lineage_mismatch:qualified-view-lineage:${field}`),
    );
  }
});
