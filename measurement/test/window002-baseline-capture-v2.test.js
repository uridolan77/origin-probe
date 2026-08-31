import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  ACTIVE_RUN_ID,
  ALLOWED_SERVICE_RUN_IDS as PROJECTOR_ALLOWED_SERVICE_RUN_IDS,
  PRE_ROTATION_SERVICE_RUN_ID as PROJECTOR_PRE_ROTATION_SERVICE_RUN_ID,
} from "../scripts/window002-historical-projection.mjs";
import {
  ALLOWED_SERVICE_RUN_IDS,
  CAPTURE_BODY_FILENAMES,
  CAPTURE_RECEIPT_FILENAME,
  CAPTURE_SEQUENCE,
  OUTPUT_DIRECTORY_GUARD_FILENAME,
  PHASES,
  PROTECTED_INPUT_SCHEMA_VERSION,
  PROTECTED_PROVENANCE_SCHEMA_VERSION,
  PROTECTED_WRAPPER_PATH,
  PROVIDER_LOOKUP_FILENAME,
  PRE_ROTATION_SERVICE_RUN_ID,
  PUBLIC_SERVICE_URL,
  REQUEST_TIMEOUT_MS,
  STAGED_RECEIPT_FILENAME,
  STAGED_RECEIPT_SCHEMA_VERSION,
  TRUST_MODEL,
  VERCEL_ORG_ID,
  VERCEL_PROJECT_ID,
  VERCEL_SCOPE,
  captureRequests,
  containsCredentialReflection,
  main,
  requestUrls,
  validateCaptureReceipt,
  validateStagedDeploymentReceiptBytes,
  windowIntent,
} from "../scripts/window002-baseline-capture-v2.mjs";

const captureScript = fileURLToPath(
  new URL("../scripts/window002-baseline-capture-v2.mjs", import.meta.url),
);
const wrapperScript = fileURLToPath(
  new URL(
    "../scripts/window002-baseline-capture-protected-v2.ps1",
    import.meta.url,
  ),
);
const startUtc = "2030-01-01T12:00:00.000Z";
const stagedUrl =
  "https://origin-probe-measure-capturev2-uridolan77s-projects.vercel.app";
const adminKey = "capture-admin-key-never-persisted";
const protectionBypass = "capture-bypass-never-persisted";
const digest = "a".repeat(64);
const guardBytes = Buffer.from(
  "origin-window002-capture-directory-identity-guard-v1",
  "utf8",
);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function jsonBytes(value) {
  return Buffer.from(JSON.stringify(value), "utf8");
}

function fullStageReceipt() {
  return {
    schemaVersion: STAGED_RECEIPT_SCHEMA_VERSION,
    attemptId: "11111111-1111-4111-8111-111111111111",
    createdAtUtc: "2026-08-31T10:00:00.000Z",
    updatedAtUtc: "2026-08-31T10:04:00.000Z",
    completedAtUtc: "2026-08-31T10:04:00.000Z",
    result: "PASS",
    providerWriteState: "STAGED_READY_NOT_PROMOTED",
    providerWriteRetryPolicy:
      "single_cli_invocation_one_discovery_post_one_upload_per_declared_missing_digest_one_identical_continuation_no_automatic_mutation_retry",
    runId: ACTIVE_RUN_ID,
    projectId: VERCEL_PROJECT_ID,
    orgId: VERCEL_ORG_ID,
    scope: VERCEL_SCOPE,
    repairedCommit: "2e4f33c334f5eb07204d6a69481b5c85fe15e45a",
    repairedMeasurementTree: "76218da5886b022ec7d7310dfc6c79f00228a17e",
    archiveTarSha256:
      "926f9468c5faa5991f113f86bd0d852602dd46af75c43de77d0efa114154b556",
    archiveTarBytes: 184320,
    deployManifestSha256Before:
      "cdd30fe6a9f18c7136a882d903302282f35e6ec5b273f247f45b0fdc9d0ebda7",
    deployFileCountBefore: 26,
    wrapperSha256Before:
      "0447b882e6f1b521f7945bb42460770dbbcd778111645959df83b6568bb2a6cd",
    rotationReceiptSha256: digest,
    rotationAttemptId: "22222222-2222-4222-8222-222222222222",
    expectedMeasurementConfigFingerprint: digest,
    secretSetFingerprint: digest,
    nodeVersion: "v22.14.0",
    nodeSha256:
      "33b1bc1a8aca11fd5a4f2699e51019c63c0af30cf437701d07af69be7706771b",
    vercelCliVersion: "57.0.0",
    vercelTreeManifestSha256:
      "21545361d00941da2994447db68cbd5c5ddc2899a326974996fe05210e80b994",
    executionReadLockCount: 42,
    noRetryPreloadSha256:
      "d8ac99ea2805cd00e11e28270083192b8a5389e4142695b7c49a0fd6c04de2fe",
    scratchItemCountBefore: 0,
    scratchFileCountBefore: 0,
    scratchManifestSha256Before: digest,
    providerCredentialMode: "VERCEL_TOKEN_child_environment_skip_write",
    providerBearerExpiresAtEpochSeconds: 2_000_000_000,
    providerExecutionConfigSha256:
      "889e23d72f6500793b541d7dace3cb13a8e8cddb0d0cba4babc60841f14fdf96",
    projectNodeVersion: "24.x",
    acceptedDeploymentId: "dpl_FzYtRPK5oxnoG4TJnjNxEYrcZbs7",
    providerBaseline: {
      projectRawSha256: digest,
      domainRawSha256: digest,
      acceptedDeploymentRawSha256: digest,
      acceptedAliasesRawSha256: digest,
      aliasRawSha256: {
        "origin-probe-measure-uridolan77s-projects.vercel.app": digest,
        "origin-probe-measure.vercel.app": digest,
      },
    },
    normalAuthSha256Before: digest,
    localUtcBeforeCli: "2026-08-31T10:01:00.000Z",
    localUtcAfterCli: "2026-08-31T10:02:00.000Z",
    cliTimedOut: false,
    cliExitCode: 0,
    cliStdoutSha256: digest,
    cliStderrSha256: digest,
    stagedDeployment: {
      id: "dpl_CaptureV2Test",
      uniqueUrl: stagedUrl,
      inspectorUrl: "https://vercel.com/uridolan77s-projects/capture-test",
      target: "production",
      readyState: "READY",
      readySubstate: "STAGED",
    },
    providerReconciliation: {
      candidateDeploymentRawSha256: digest,
      candidateDeploymentRawBytes: 1024,
      candidateAliasSetRawSha256: digest,
      candidateAliasAssignedAtEpochMs: 1_788_169_720_000,
      candidateCreatedAtEpochMs: 1_788_169_660_000,
      candidateAliasAssignedSemantics:
        "staged_readiness_signal_not_window_start",
      postStageProjectRawSha256: digest,
      postStageDomainRawSha256: digest,
      postStageAcceptedDeploymentRawSha256: digest,
      postStageAcceptedAliasesRawSha256: digest,
    },
    productionAliasesRemainOnAcceptedDeployment: true,
    deployManifestSha256After:
      "cdd30fe6a9f18c7136a882d903302282f35e6ec5b273f247f45b0fdc9d0ebda7",
    normalAuthSha256After: digest,
    wrapperSha256After:
      "0447b882e6f1b521f7945bb42460770dbbcd778111645959df83b6568bb2a6cd",
    scratchItemCountAfter: 4,
    scratchFileCountAfter: 4,
    scratchTotalBytesAfter: 4096,
    scratchManifestSha256After: digest,
  };
}

function providerDeployment(stage = fullStageReceipt()) {
  return {
    id: stage.stagedDeployment.id,
    projectId: VERCEL_PROJECT_ID,
    ownerId: VERCEL_ORG_ID,
    url: new URL(stage.stagedDeployment.uniqueUrl).hostname,
    target: "production",
    readyState: "READY",
    readySubstate: "STAGED",
    aliasAssignedAt: stage.providerReconciliation.candidateAliasAssignedAtEpochMs,
    createdAt: stage.providerReconciliation.candidateCreatedAtEpochMs,
    extraProviderField: true,
  };
}

function projection(value) {
  return {
    id: value.id,
    projectId: value.projectId,
    ownerId: value.ownerId,
    url: value.url,
    target: value.target,
    readyState: value.readyState,
    readySubstate: value.readySubstate,
    aliasAssignedAtEpochMs: value.aliasAssignedAt,
    createdAtEpochMs: value.createdAt,
  };
}

function responseBodies(serviceActiveRunId) {
  const intent = windowIntent(startUtc);
  const exported = jsonBytes({
    ok: true,
    scope: "all",
    activeRunId: serviceActiveRunId,
    events: [],
    ledgerSchemaVersion: "v1",
  });
  const reduced = jsonBytes({
    ok: true,
    reduction: {
      runId: serviceActiveRunId,
      window: {
        startUtc: intent.startUtc,
        endUtc: intent.endUtc,
        semantics: "[startUtc,endUtc)",
      },
    },
  });
  return [exported, reduced, exported, reduced];
}

function makeProvenance(
  phase,
  stage,
  providerBytes,
  fixtureProtectionBypass = protectionBypass,
) {
  return {
    schemaVersion: PROTECTED_PROVENANCE_SCHEMA_VERSION,
    trustModel: TRUST_MODEL,
    phase,
    deploymentProtectionFingerprintSha256:
      phase === "staged"
        ? sha256(Buffer.from(fixtureProtectionBypass))
        : null,
    wrapper: {
      path: PROTECTED_WRAPPER_PATH,
      sha256: sha256(readFileSync(wrapperScript)),
    },
    fixedPaths: {
      protectedStore: "OriginProbeOperator",
      stagePass: phase === "staged" ? "window002-stage-pass.json" : null,
      outputDirectoryName: PHASES[phase].outputDirectoryName,
    },
    windowsProtection: {
      ownerVerified: true,
      daclVerified: true,
      reparseFree: true,
      readLocksHeld: true,
    },
    providerLookup:
      phase === "staged"
        ? {
            performed: true,
            providerWrites: 0,
            method: "GET",
            apiOrigin: "https://api.vercel.com",
            pathAndQuery: `/v13/deployments/${stage.stagedDeployment.id}?teamId=${VERCEL_ORG_ID}`,
            notBeforeUtc: "2026-08-31T10:05:00.000Z",
            notAfterUtc: "2026-08-31T10:05:01.000Z",
            rawBody: {
              path: PROVIDER_LOOKUP_FILENAME,
              sha256: sha256(providerBytes),
              byteLength: providerBytes.length,
            },
            deployment: projection(JSON.parse(providerBytes)),
          }
        : {
            performed: false,
            providerWrites: 0,
            reason: "pre_rotation_exact_public_alias",
          },
  };
}

function makeFetch(
  phase,
  mutate,
  {
    fixtureAdminKey = adminKey,
    fixtureProtectionBypass = protectionBypass,
  } = {},
) {
  const runId = PHASES[phase].serviceActiveRunId;
  const url = phase === "staged" ? stagedUrl : PUBLIC_SERVICE_URL;
  const urls = requestUrls(url, windowIntent(startUtc));
  const bodies = responseBodies(runId);
  const calls = [];
  return {
    calls,
    async fetchImpl(requestUrl, options) {
      const index = calls.length;
      const entry = {
        body: Buffer.from(bodies[index]),
        status: 200,
        xVercelId: `iad1::capture-${index + 1}`,
      };
      const headers = new Headers(options.headers);
      assert.equal(String(requestUrl), urls[index]);
      assert.equal(headers.get("x-admin-key"), fixtureAdminKey);
      assert.equal(
        headers.get("x-vercel-protection-bypass"),
        phase === "staged" ? fixtureProtectionBypass : null,
      );
      mutate?.(entry, index);
      calls.push(entry);
      return new Response(entry.body, {
        status: entry.status,
        headers: {
          "content-type": "application/json",
          "x-vercel-id": entry.xVercelId,
        },
      });
    },
  };
}

async function fixture(options = {}) {
  const phase = options.phase ?? "pre_rotation";
  const fixtureAdminKey = options.adminKey ?? adminKey;
  const fixtureProtectionBypass =
    phase === "staged"
      ? (options.protectionBypass ?? protectionBypass)
      : null;
  const root = mkdtempSync(path.join(os.tmpdir(), "capture-v2-protected-"));
  const outputDirectory = path.join(root, PHASES[phase].outputDirectoryName);
  const stagePassPath = path.join(root, "window002-stage-pass.json");
  const guardPath = path.join(outputDirectory, OUTPUT_DIRECTORY_GUARD_FILENAME);
  mkdirSync(outputDirectory);
  let stage = null;
  let providerBytes = null;
  if (phase === "staged") {
    stage = fullStageReceipt();
    options.mutateStage?.(stage);
    writeFileSync(stagePassPath, `${JSON.stringify(stage)}\n`);
    const provider = providerDeployment(stage);
    options.mutateProvider?.(provider);
    providerBytes = jsonBytes(provider);
    writeFileSync(path.join(outputDirectory, PROVIDER_LOOKUP_FILENAME), providerBytes);
  }
  if (options.guardMode !== "missing") {
    writeFileSync(
      guardPath,
      options.guardMode === "malformed" ? Buffer.from("malformed", "utf8") : guardBytes,
    );
  }
  const provenance = makeProvenance(
    phase,
    stage,
    providerBytes,
    fixtureProtectionBypass,
  );
  options.mutateProvenance?.(provenance);
  const mock = makeFetch(phase, options.mutateResponse, {
    fixtureAdminKey,
    fixtureProtectionBypass,
  });
  const input = Readable.from([
    JSON.stringify({
      schemaVersion: PROTECTED_INPUT_SCHEMA_VERSION,
      adminKey: fixtureAdminKey,
      protectionBypass: fixtureProtectionBypass,
      provenance,
    }),
  ]);
  return {
    root,
    outputDirectory,
    guardPath,
    initialEntries: readdirSync(outputDirectory).sort(),
    fixtureAdminKey,
    fixtureProtectionBypass,
    stage,
    providerBytes,
    provenance,
    mock,
    invoke: () => main([phase, startUtc], {
      input,
      fetchImpl: mock.fetchImpl,
      pathOverrides: {
        storePath: root,
        stagePassPath,
        outputDirectory,
        wrapperPath: wrapperScript,
      },
      emitSummary: false,
      lifecycleHooks: options.lifecycleHooks ?? {},
      importedTestOnlyAllowGuardlessOutputDirectory:
        options.importedTestOnlyAllowGuardlessOutputDirectory ?? false,
    }),
  };
}

test("pre-rotation capture fixes the public alias and emits no secret", async () => {
  const value = await fixture();
  try {
    await value.invoke();
    const receiptBytes = readFileSync(
      path.join(value.outputDirectory, CAPTURE_RECEIPT_FILENAME),
    );
    const receipt = JSON.parse(receiptBytes);
    validateCaptureReceipt(receipt, {
      expectedToolSha256: sha256(readFileSync(captureScript)),
    });
    assert.equal(receipt.uniqueUrl, PUBLIC_SERVICE_URL);
    assert.equal(receipt.operatorProvenance.trustModel, TRUST_MODEL);
    assert.equal(receipt.deploymentProtection.presented, false);
    assert.equal(receiptBytes.includes(Buffer.from(adminKey)), false);
    assert.equal(value.mock.calls.length, 4);
    assert.deepEqual(readdirSync(value.outputDirectory).sort(), [
      ...CAPTURE_BODY_FILENAMES,
      CAPTURE_RECEIPT_FILENAME,
      OUTPUT_DIRECTORY_GUARD_FILENAME,
    ].sort());
  } finally { rmSync(value.root, { recursive: true, force: true }); }
});

test("staged capture binds stage, provider raw bytes, and bypass fingerprint", async () => {
  const value = await fixture({ phase: "staged" });
  try {
    await value.invoke();
    const receipt = JSON.parse(
      readFileSync(path.join(value.outputDirectory, CAPTURE_RECEIPT_FILENAME)),
    );
    assert.equal(receipt.uniqueUrl, stagedUrl);
    assert.deepEqual(receipt.operatorProvenance.providerLookup.rawBody, {
      path: PROVIDER_LOOKUP_FILENAME,
      sha256: sha256(value.providerBytes),
      byteLength: value.providerBytes.length,
    });
    assert.equal(
      receipt.deploymentProtection.fingerprintSha256,
      sha256(Buffer.from(protectionBypass)),
    );
    assert.equal(receipt.deploymentSource.stageReceipt.path, STAGED_RECEIPT_FILENAME);
    for (const name of readdirSync(value.outputDirectory)) {
      const bytes = readFileSync(path.join(value.outputDirectory, name));
      assert.equal(bytes.includes(Buffer.from(adminKey)), false);
      assert.equal(bytes.includes(Buffer.from(protectionBypass)), false);
    }
  } finally { rmSync(value.root, { recursive: true, force: true }); }
});

test("full stage receipt rejects extra, missing, secret, state, and time drift", async (t) => {
  assert.equal(
    validateStagedDeploymentReceiptBytes(jsonBytes(fullStageReceipt())).uniqueUrl,
    stagedUrl,
  );
  for (const [name, mutate, error] of [
    ["extra", (v) => { v.extra = true; }, "invalid_staged_deployment_receipt"],
    ["missing", (v) => { delete v.archiveTarBytes; }, "invalid_staged_deployment_receipt"],
    ["secret", (v) => { v.adminKey = "secret"; }, "contains_secret_key"],
    ["state", (v) => { v.stagedDeployment.readySubstate = "PROMOTED"; }, "invalid_staged_deployment_receipt"],
    ["time", (v) => { v.completedAtUtc = "2026-08-31T09:00:00.000Z"; v.updatedAtUtc = v.completedAtUtc; }, "time_order"],
  ]) {
    await t.test(name, () => {
      const value = fullStageReceipt();
      mutate(value);
      assert.throws(
        () => validateStagedDeploymentReceiptBytes(jsonBytes(value)),
        new RegExp(error),
      );
    });
  }
});

test("provider lookup fails closed on identity, state, timestamp, pin, and timing drift", async (t) => {
  for (const [name, mutateProvider, mutateProvenance, error] of [
    ["project", (v) => { v.projectId = "prj_attacker"; }, null, "provider_lookup_deployment_mismatch"],
    ["team", (v) => { v.ownerId = "team_attacker"; }, null, "provider_lookup_deployment_mismatch"],
    ["host", (v) => { v.url = "attacker.example"; }, null, "provider_lookup_deployment_mismatch"],
    ["state", (v) => { v.readySubstate = "PROMOTED"; }, null, "provider_lookup_deployment_mismatch"],
    ["timestamp", (v) => { v.aliasAssignedAt += 1; }, null, "provider_lookup_deployment_mismatch"],
    ["pin", null, (v) => { v.providerLookup.rawBody.sha256 = "0".repeat(64); }, "provider_lookup_raw_body_mismatch"],
    ["timing", null, (v) => { v.providerLookup.notAfterUtc = "2026-08-31T10:06:00.000Z"; }, "observation_window"],
  ]) {
    await t.test(name, async () => {
      const value = await fixture({
        phase: "staged",
        mutateProvider,
        mutateProvenance,
      });
      try { await assert.rejects(value.invoke(), new RegExp(error)); }
      finally { rmSync(value.root, { recursive: true, force: true }); }
    });
  }
});

test("capture rejects provider IDs, status, and wrong service envelopes", async (t) => {
  for (const [name, mutateResponse, error] of [
    ["missing id", (v, i) => { if (i === 0) v.xVercelId = ""; }, "missing_or_invalid_x_vercel_id"],
    ["duplicate id", (v, i) => { if (i === 1) v.xVercelId = "iad1::capture-1"; }, "duplicate_x_vercel_id"],
    ["status", (v, i) => { if (i === 0) v.status = 401; }, "capture_http_status_1"],
    ["export run", (v, i) => { if (i === 0) { const body = JSON.parse(v.body); body.activeRunId = ACTIVE_RUN_ID; v.body = jsonBytes(body); } }, "invalid_capture_export_1"],
    ["reduce run", (v, i) => { if (i === 1) { const body = JSON.parse(v.body); body.reduction.runId = ACTIVE_RUN_ID; v.body = jsonBytes(body); } }, "invalid_capture_reduction_2"],
  ]) {
    await t.test(name, async () => {
      const value = await fixture({ mutateResponse });
      try { await assert.rejects(value.invoke(), new RegExp(error)); }
      finally { rmSync(value.root, { recursive: true, force: true }); }
    });
  }
});

test("bypass is staged-only and production CLI has no URL/path freedom", async () => {
  await assert.rejects(
    captureRequests({
      uniqueUrl: PUBLIC_SERVICE_URL,
      intent: windowIntent(startUtc),
      serviceActiveRunId: PRE_ROTATION_SERVICE_RUN_ID,
      adminKey,
      protectionBypass,
      fetchImpl: async () => { throw new Error("must_not_fetch"); },
    }),
    /invalid_protection_bypass_for_phase/,
  );
  await assert.rejects(
    main(["pre_rotation", startUtc, "https://attacker.example"], {
      emitSummary: false,
    }),
    /usage: window002-baseline-capture-v2/,
  );
});

test("streaming reads enforce 5 MiB, timeout, and secret non-echo", async (t) => {
  const base = {
    uniqueUrl: PUBLIC_SERVICE_URL,
    intent: windowIntent(startUtc),
    serviceActiveRunId: PRE_ROTATION_SERVICE_RUN_ID,
    adminKey,
    protectionBypass: null,
  };
  await t.test("content length", async () => {
    await assert.rejects(captureRequests({
      ...base,
      fetchImpl: async () => new Response("{}", {
        headers: {
          "content-type": "application/json",
          "content-length": String(5 * 1024 * 1024 + 1),
          "x-vercel-id": "iad1::large",
        },
      }),
    }), /capture_response_body_size_invalid_1/);
  });
  await t.test("chunked", async () => {
    const body = new ReadableStream({
      start(controller) {
        for (let index = 0; index < 6; index += 1) {
          controller.enqueue(new Uint8Array(1024 * 1024));
        }
        controller.close();
      },
    });
    await assert.rejects(captureRequests({
      ...base,
      fetchImpl: async () => new Response(body, {
        headers: {
          "content-type": "application/json",
          "x-vercel-id": "iad1::chunked",
        },
      }),
    }), /capture_response_body_size_invalid_1/);
  });
  await t.test("timeout", async () => {
    let signal;
    await assert.rejects(captureRequests({
      ...base,
      requestTimeoutMs: 25,
      fetchImpl(_url, options) {
        signal = options.signal;
        return new Promise(() => {});
      },
    }), /capture_request_timeout_1/);
    assert.equal(signal.aborted, true);
  });
  await t.test("secret body", async () => {
    await assert.rejects(captureRequests({
      ...base,
      fetchImpl: async () => new Response(JSON.stringify({ value: adminKey }), {
        headers: {
          "content-type": "application/json",
          "x-vercel-id": "iad1::leak",
        },
      }),
    }), /capture_response_contains_secret_1/);
  });
});

test("capture sequence and timeout contract stay exact", () => {
  assert.deepEqual(CAPTURE_SEQUENCE, [
    "read1_export_all",
    "read1_bounded_reduction",
    "read2_export_all",
    "read2_bounded_reduction",
  ]);
  assert.equal(REQUEST_TIMEOUT_MS, 15_000);
  const source = readFileSync(captureScript, "utf8");
  assert.match(source, /left\.ino !== 0n/);
  assert.match(source, /importedTestOnlyAllowGuardlessOutputDirectory = false/);
  assert.match(
    source,
    /origin-window002-capture-directory-identity-guard-v1/,
  );
  assert.strictEqual(
    ALLOWED_SERVICE_RUN_IDS,
    PROJECTOR_ALLOWED_SERVICE_RUN_IDS,
  );
  assert.equal(
    PRE_ROTATION_SERVICE_RUN_ID,
    PROJECTOR_PRE_ROTATION_SERVICE_RUN_ID,
  );
});

test("credential reflection scanning is structural and pre-write", async (t) => {
  assert.equal(
    containsCredentialReflection(
      Buffer.from('{"safe":{"value":"ordinary"}}', "utf8"),
      [adminKey, null],
    ),
    false,
  );

  const unicodeEscapeFirstA = (value) => value.replace("a", "\\u0061");
  const encodedSecret = "capture-admin-credential-!>!";
  const encodedSecretBytes = Buffer.from(encodedSecret, "utf8");
  const base64 = encodedSecretBytes.toString("base64");
  const base64UrlUnpadded = base64
    .replace(/=+$/u, "")
    .replace(/\+/gu, "-")
    .replace(/\//gu, "_");
  const base64UrlPadded = `${base64UrlUnpadded}${"=".repeat(
    (4 - (base64UrlUnpadded.length % 4)) % 4,
  )}`;
  const fullPercent = Array.from(
    encodedSecretBytes,
    (byte) => `%${byte.toString(16).padStart(2, "0").toUpperCase()}`,
  ).join("");
  const cases = [
    {
      name: "quote and backslash JSON escaping",
      adminKey: 'capture-"quoted\\path"-admin-credential',
      mutateResponse(entry, index) {
        if (index === 0) {
          entry.body = jsonBytes({
            nested: { value: `prefix:${this.adminKey}:suffix` },
          });
        }
      },
      error: "capture_response_contains_secret_1",
    },
    {
      name: "Unicode escape in nested value",
      mutateResponse(entry, index) {
        if (index === 0) {
          entry.body = Buffer.from(
            `{"nested":{"value":"${unicodeEscapeFirstA(adminKey)}"}}`,
            "utf8",
          );
        }
      },
      error: "capture_response_contains_secret_1",
    },
    {
      name: "Unicode escape in nested key",
      mutateResponse(entry, index) {
        if (index === 0) {
          entry.body = Buffer.from(
            `{"nested":{"prefix-${unicodeEscapeFirstA(adminKey)}-suffix":"safe"}}`,
            "utf8",
          );
        }
      },
      error: "capture_response_contains_secret_1",
    },
    {
      name: "Unicode escape in provider identity header",
      mutateResponse(entry, index) {
        if (index === 0) {
          entry.xVercelId = `iad1::${unicodeEscapeFirstA(adminKey)}`;
        }
      },
      error: "provider_identity_contains_secret",
    },
    {
      name: "staged bypass reflection",
      phase: "staged",
      mutateResponse(entry, index) {
        if (index === 0) {
          entry.body = Buffer.from(
            `{"nested":"${unicodeEscapeFirstA(protectionBypass)}"}`,
            "utf8",
          );
        }
      },
      error: "capture_response_contains_secret_1",
    },
    ...[
      ["full UTF-8 percent encoding", fullPercent],
      ["lowercase full UTF-8 percent encoding", fullPercent.toLowerCase()],
      ["standard URI encoding", encodeURIComponent(encodedSecret)],
      ["base64 encoding", base64],
      ["base64 encoding without padding", base64.replace(/=+$/u, "")],
      ["base64url encoding with padding", base64UrlPadded],
      ["base64url encoding without padding", base64UrlUnpadded],
      ["lowercase hex encoding", encodedSecretBytes.toString("hex")],
      ["uppercase hex encoding", encodedSecretBytes.toString("hex").toUpperCase()],
    ].map(([name, reflected]) => ({
      name,
      adminKey: encodedSecret,
      mutateResponse(entry, index) {
        if (index === 0) {
          entry.body = Buffer.from(
            JSON.stringify({ nested: { reflected } }),
            "utf8",
          );
        }
      },
      error: "capture_response_contains_secret_1",
    })),
    {
      name: "encoded credential in a recursively decoded JSON key",
      adminKey: encodedSecret,
      mutateResponse(entry, index) {
        if (index === 0) {
          entry.body = Buffer.from(
            JSON.stringify({ nested: { [`prefix-${base64UrlUnpadded}`]: "safe" } }),
            "utf8",
          );
        }
      },
      error: "capture_response_contains_secret_1",
    },
    {
      name: "encoded credential in provider identity header",
      adminKey: encodedSecret,
      mutateResponse(entry, index) {
        if (index === 0) entry.xVercelId = `iad1::${base64UrlPadded}`;
      },
      error: "provider_identity_contains_secret",
    },
  ];

  for (const reflectionCase of cases) {
    await t.test(reflectionCase.name, async () => {
      const configured = {
        phase: reflectionCase.phase,
        adminKey: reflectionCase.adminKey,
        mutateResponse: reflectionCase.mutateResponse.bind(reflectionCase),
      };
      const value = await fixture(configured);
      try {
        await assert.rejects(value.invoke(), new RegExp(reflectionCase.error));
        assert.deepEqual(
          readdirSync(value.outputDirectory).sort(),
          value.initialEntries,
        );
      } finally {
        rmSync(value.root, { recursive: true, force: true });
      }
    });
  }
});

test("capture authority requires an exact held output guard", async (t) => {
  await t.test("guardless without imported-test seam", async () => {
    const value = await fixture({ guardMode: "missing" });
    try {
      await assert.rejects(
        value.invoke(),
        /prepared_output_directory_(?:not_exact|guard_missing_or_unreadable)/,
      );
      assert.equal(value.mock.calls.length, 0);
    } finally {
      rmSync(value.root, { recursive: true, force: true });
    }
  });

  await t.test("explicit imported-test-only guardless seam", async () => {
    const value = await fixture({
      guardMode: "missing",
      importedTestOnlyAllowGuardlessOutputDirectory: true,
    });
    try {
      await value.invoke();
      assert.equal(value.mock.calls.length, 4);
      assert.equal(
        readdirSync(value.outputDirectory).includes(
          OUTPUT_DIRECTORY_GUARD_FILENAME,
        ),
        false,
      );
    } finally {
      rmSync(value.root, { recursive: true, force: true });
    }
  });

  await t.test("malformed guard", async () => {
    const value = await fixture({ guardMode: "malformed" });
    try {
      await assert.rejects(
        value.invoke(),
        /prepared_output_directory_guard_(?:invalid|malformed)/,
      );
      assert.equal(value.mock.calls.length, 0);
    } finally {
      rmSync(value.root, { recursive: true, force: true });
    }
  });
});

test("capture rejects output-directory and artifact pathname swaps", async (t) => {
  await t.test("guard replacement at the same pathname", async () => {
    let guardPath;
    const value = await fixture({
      lifecycleHooks: {
        beforeOutputWrites() {
          renameSync(guardPath, `${guardPath}.moved`);
          writeFileSync(guardPath, guardBytes, { flag: "wx" });
        },
      },
    });
    guardPath = value.guardPath;
    try {
      await assert.rejects(
        value.invoke(),
        /prepared_output_directory_guard_identity_changed/,
      );
    } finally {
      rmSync(value.root, { recursive: true, force: true });
    }
  });

  await t.test("directory replacement at the same pathname", async () => {
    let outputDirectory;
    const value = await fixture({
      lifecycleHooks: {
        beforeOutputWrites() {
          renameSync(outputDirectory, `${outputDirectory}.moved`);
          mkdirSync(outputDirectory);
        },
      },
    });
    outputDirectory = value.outputDirectory;
    try {
      await assert.rejects(
        value.invoke(),
        /(?:prepared_output_directory_identity_changed|EPERM|EACCES)/,
      );
    } finally {
      rmSync(value.root, { recursive: true, force: true });
    }
  });

  await t.test("artifact replacement at the same pathname", async () => {
    const value = await fixture({
      lifecycleHooks: {
        afterFirstArtifactFsync({ artifactPath }) {
          renameSync(artifactPath, `${artifactPath}.moved`);
          writeFileSync(artifactPath, "{}", { flag: "wx" });
        },
      },
    });
    try {
      await assert.rejects(value.invoke(), /capture_body_1_identity_changed/);
    } finally {
      rmSync(value.root, { recursive: true, force: true });
    }
  });
});
