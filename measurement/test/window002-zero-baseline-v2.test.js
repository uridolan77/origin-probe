import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  closeSync,
  copyFileSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { reduceWindowEvents } from "../lib/reducer.js";
import {
  CAPTURE_BODY_FILENAMES,
  CAPTURE_RECEIPT_FILENAME,
  CAPTURE_SEQUENCE,
  PHASES,
  PRE_ROTATION_SERVICE_RUN_ID,
  PROTECTED_PROVENANCE_SCHEMA_VERSION,
  PROTECTED_WRAPPER_PATH,
  PROVIDER_LOOKUP_FILENAME,
  PUBLIC_SERVICE_URL,
  STAGED_RECEIPT_FILENAME,
  STAGED_RECEIPT_SCHEMA_VERSION,
  TRUST_MODEL,
  VERCEL_ORG_ID,
  VERCEL_PROJECT_ID,
  VERCEL_SCOPE,
  buildCaptureReceipt,
  requestUrls,
  windowIntent,
  withCaptureBinding,
} from "../scripts/window002-baseline-capture-v2.mjs";
import { ACTIVE_RUN_ID } from "../scripts/window002-historical-projection.mjs";
import {
  assertDistinctInputs,
  openStableDirectory,
  openStableInput,
  revalidateOpenDirectory,
  revalidateOpenInput,
} from "../scripts/window002-zero-baseline-v2.mjs";

const script = fileURLToPath(
  new URL("../scripts/window002-zero-baseline-v2.mjs", import.meta.url),
);
const captureScript = fileURLToPath(
  new URL("../scripts/window002-baseline-capture-v2.mjs", import.meta.url),
);
const wrapperScript = fileURLToPath(
  new URL(
    "../scripts/window002-baseline-capture-protected-v2.ps1",
    import.meta.url,
  ),
);
const originalRun = "ORIGIN-G2R-ACCEPTANCE";
const reacceptanceRun = "ORIGIN-G2R-UI-REACCEPTANCE-001";
const stagedUniqueUrl =
  "https://origin-probe-measure-efgh5678-uridolan77s-projects.vercel.app";
const observations = [
  "2026-09-01T11:56:00.000Z",
  "2026-09-01T11:57:00.000Z",
  "2026-09-01T11:58:00.000Z",
  "2026-09-01T11:59:00.000Z",
];
const startUtc = "2026-09-01T12:00:00.000Z";
const endUtc = "2026-09-15T12:00:00.000Z";
const digest = "a".repeat(64);
const bypassFingerprint = "b".repeat(64);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function stagedReceipt() {
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
      id: "dpl_Window002AssemblerTest",
      uniqueUrl: stagedUniqueUrl,
      inspectorUrl: "https://vercel.com/uridolan77s-projects/assembler-test",
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

function providerLookupBody(stage) {
  return jsonBytes({
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
  });
}

function exportFixture(serviceActiveRunId = PRE_ROTATION_SERVICE_RUN_ID) {
  const events = [];
  for (const [runId, count] of [
    [originalRun, 16],
    [reacceptanceRun, 21],
  ]) {
    for (let index = 0; index < count; index += 1) {
      events.push({
        id: `${runId}-${String(index).padStart(2, "0")}`,
        runId,
        type: "result_view",
        at: `2026-08-30T16:${String(index).padStart(2, "0")}:00.000Z`,
        slug: "culture-eats-strategy-for-breakfast",
        clientHash: `${runId}-client-${index}`,
        creatorHash: null,
        shareTokenFingerprint: null,
        seed: null,
        derivedFrom: null,
        exclusions: [],
        uaClass: "browser",
        payload: {},
      });
    }
  }
  return {
    ok: true,
    scope: "all",
    activeRunId: serviceActiveRunId,
    events,
    ledgerSchemaVersion: "v1",
  };
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

function boundedResponse(envelope, serviceActiveRunId, mutateReduction) {
  const response = {
    ok: true,
    reduction: reduceWindowEvents(envelope.events.map(reducerEvent), {
      runId: serviceActiveRunId,
      startUtc,
      endUtc,
    }),
  };
  mutateReduction?.(response);
  return response;
}

function jsonBytes(value, suffix = "") {
  return Buffer.from(`${JSON.stringify(value)}${suffix}`, "utf8");
}

function prepareFixture({
  mutateExport,
  mutateReduction,
  serviceActiveRunId = PRE_ROTATION_SERVICE_RUN_ID,
  export2Suffix = "",
  reduction2Suffix = "",
} = {}) {
  const directory = mkdtempSync(path.join(os.tmpdir(), "window002-baseline-v2-"));
  const envelope = exportFixture(serviceActiveRunId);
  mutateExport?.(envelope);
  const reduction = boundedResponse(
    envelope,
    serviceActiveRunId,
    mutateReduction,
  );
  const exportBody = jsonBytes(envelope);
  const reductionBody = jsonBytes(reduction);
  const exportBody2 = jsonBytes(envelope, export2Suffix);
  const reductionBody2 = jsonBytes(reduction, reduction2Suffix);
  const files = {
    export1: path.join(directory, CAPTURE_BODY_FILENAMES[0]),
    reduction1: path.join(directory, CAPTURE_BODY_FILENAMES[1]),
    export2: path.join(directory, CAPTURE_BODY_FILENAMES[2]),
    reduction2: path.join(directory, CAPTURE_BODY_FILENAMES[3]),
    receipt: path.join(directory, CAPTURE_RECEIPT_FILENAME),
    stageReceipt: path.join(directory, STAGED_RECEIPT_FILENAME),
    providerLookup: path.join(directory, PROVIDER_LOOKUP_FILENAME),
    output: path.join(directory, "zero-baseline-v2.json"),
  };
  writeFileSync(files.export1, exportBody);
  writeFileSync(files.reduction1, reductionBody);
  writeFileSync(files.export2, exportBody2);
  writeFileSync(files.reduction2, reductionBody2);

  const intent = windowIntent(startUtc);
  const uniqueUrl =
    serviceActiveRunId === ACTIVE_RUN_ID
      ? stagedUniqueUrl
      : PUBLIC_SERVICE_URL;
  let deploymentSource;
  let stage = null;
  let providerBytes = null;
  if (serviceActiveRunId === ACTIVE_RUN_ID) {
    stage = stagedReceipt();
    const stageReceiptBytes = Buffer.from(
      `${JSON.stringify(stage, null, 2)}\n`,
      "utf8",
    );
    writeFileSync(files.stageReceipt, stageReceiptBytes);
    providerBytes = providerLookupBody(stage);
    writeFileSync(files.providerLookup, providerBytes);
    deploymentSource = {
      kind: "staged_deployment_receipt",
      stageReceipt: {
        path: STAGED_RECEIPT_FILENAME,
        sha256: sha256(stageReceiptBytes),
      },
      deploymentId: stage.stagedDeployment.id,
      uniqueUrl: stagedUniqueUrl,
      projectId: VERCEL_PROJECT_ID,
      orgId: VERCEL_ORG_ID,
      scope: VERCEL_SCOPE,
    };
  } else {
    deploymentSource = {
      kind: "pre_rotation_public_alias",
      preRotationSource: "forced_exact_public_alias",
      alias: PUBLIC_SERVICE_URL,
    };
  }
  const wrapperSha256 = sha256(readFileSync(wrapperScript));
  const operatorProvenance = {
    schemaVersion: PROTECTED_PROVENANCE_SCHEMA_VERSION,
    trustModel: TRUST_MODEL,
    phase: serviceActiveRunId === ACTIVE_RUN_ID ? "staged" : "pre_rotation",
    deploymentProtectionFingerprintSha256:
      serviceActiveRunId === ACTIVE_RUN_ID ? bypassFingerprint : null,
    wrapper: {
      path: PROTECTED_WRAPPER_PATH,
      sha256: wrapperSha256,
    },
    fixedPaths: {
      protectedStore: "OriginProbeOperator",
      stagePass:
        serviceActiveRunId === ACTIVE_RUN_ID
          ? "window002-stage-pass.json"
          : null,
      outputDirectoryName:
        PHASES[
          serviceActiveRunId === ACTIVE_RUN_ID ? "staged" : "pre_rotation"
        ].outputDirectoryName,
    },
    windowsProtection: {
      ownerVerified: true,
      daclVerified: true,
      reparseFree: true,
      readLocksHeld: true,
    },
    providerLookup:
      serviceActiveRunId === ACTIVE_RUN_ID
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
            deployment: {
              id: stage.stagedDeployment.id,
              projectId: VERCEL_PROJECT_ID,
              ownerId: VERCEL_ORG_ID,
              url: new URL(stage.stagedDeployment.uniqueUrl).hostname,
              target: "production",
              readyState: "READY",
              readySubstate: "STAGED",
              aliasAssignedAtEpochMs:
                stage.providerReconciliation.candidateAliasAssignedAtEpochMs,
              createdAtEpochMs:
                stage.providerReconciliation.candidateCreatedAtEpochMs,
            },
          }
        : {
            performed: false,
            providerWrites: 0,
            reason: "pre_rotation_exact_public_alias",
          },
  };
  const deploymentProtection = {
    header: "x-vercel-protection-bypass",
    source: "stdin_only_via_protected_wrapper",
    presented: serviceActiveRunId === ACTIVE_RUN_ID,
    fingerprintSha256:
      serviceActiveRunId === ACTIVE_RUN_ID ? bypassFingerprint : null,
    secretPersisted: false,
    secretLogged: false,
  };
  const urls = requestUrls(uniqueUrl, intent);
  const bodies = [exportBody, reductionBody, exportBody2, reductionBody2];
  const receipt = buildCaptureReceipt({
    uniqueUrl,
    intent,
    serviceActiveRunId,
    deploymentSource,
    operatorProvenance,
    deploymentProtection,
    captureToolSha256: sha256(readFileSync(captureScript)),
    requests: CAPTURE_SEQUENCE.map((kind, index) => ({
      sequence: index + 1,
      kind,
      method: "GET",
      url: urls[index],
      status: 200,
      xVercelId: `iad1::baseline-${index + 1}`,
      observedAtUtc: observations[index],
      rawBody: {
        path: CAPTURE_BODY_FILENAMES[index],
        sha256: sha256(bodies[index]),
      },
    })),
  });
  writeFileSync(files.receipt, `${JSON.stringify(receipt, null, 2)}\n`);
  return {
    directory,
    files,
    exportBody,
    reductionBody,
    exportBody2,
    reductionBody2,
  };
}

function invoke(
  fixture,
  {
    receipt = fixture.files.receipt,
    output = fixture.files.output,
    extraArgs = [],
  } = {},
) {
  return spawnSync(
    process.execPath,
    [script, receipt, output, ...extraArgs],
    { encoding: "utf8" },
  );
}

function rewriteReceipt(fixture, mutator, { rebind = true } = {}) {
  const receipt = JSON.parse(readFileSync(fixture.files.receipt));
  let updated;
  if (rebind) {
    const payload = structuredClone(receipt);
    delete payload.captureBindingSha256;
    mutator(payload);
    updated = withCaptureBinding(payload);
  } else {
    mutator(receipt);
    updated = receipt;
  }
  writeFileSync(fixture.files.receipt, `${JSON.stringify(updated, null, 2)}\n`);
}

function assertFailed(result, expected) {
  assert.notEqual(result.status, 0, "adversarial input unexpectedly passed");
  assert.match(result.stderr, new RegExp(expected));
}

test("assembles deterministic evidence with reopenable raw-body pins", () => {
  const fixture = prepareFixture();
  try {
    const first = invoke(fixture);
    assert.equal(first.status, 0, first.stderr);
    const outputBytes = readFileSync(fixture.files.output);
    const evidence = JSON.parse(outputBytes);
    const summary = JSON.parse(first.stdout);

    assert.equal(evidence.schemaVersion, "origin.window002.zero-baseline.v2");
    assert.equal(evidence.result, "PASS");
    assert.equal(evidence.runId, ACTIVE_RUN_ID);
    assert.equal(evidence.observedAtUtc, observations[3]);
    assert.deepEqual(evidence.captureReceipt, {
      path: CAPTURE_RECEIPT_FILENAME,
      sha256: sha256(readFileSync(fixture.files.receipt)),
    });
    assert.equal(evidence.captureProvenance.targetRunId, ACTIVE_RUN_ID);
    assert.deepEqual(evidence.captureProvenance.deploymentSource, {
      kind: "pre_rotation_public_alias",
      preRotationSource: "forced_exact_public_alias",
      alias: PUBLIC_SERVICE_URL,
    });
    assert.equal(
      evidence.captureProvenance.serviceActiveRunId,
      PRE_ROTATION_SERVICE_RUN_ID,
    );
    assert.deepEqual(evidence.window, {
      startUtc,
      endUtc,
      days: 14,
      intervalSemantics: "[startUtc,endUtc)",
      eventTimeAuthority: "database_event_time",
    });
    assert.equal(evidence.initialActiveRunEventCount, 0);
    assert.equal(evidence.initialLedgerEventCount, 37);
    assert.equal(evidence.activeRunBaseline.allMetricsZero, true);
    assert.equal(evidence.activeRunBaseline.disposition, "HOLD_ONCE");
    assert.equal(evidence.retainedHistoricalLedger.totalEventCount, 37);
    assert.equal(evidence.retainedHistoricalLedger.wrongRunCount, 37);
    assert.deepEqual(evidence.retainedHistoricalLedger.runDistribution, [
      { runId: originalRun, eventCount: 16 },
      { runId: reacceptanceRun, eventCount: 21 },
    ]);
    assert.deepEqual(evidence.unexpectedBoundaryExclusions, {
      wrongRunDelta: 0,
      unrecognizedRun: 0,
      beforeStart: 0,
      atOrAfterEnd: 0,
    });
    assert.deepEqual(evidence.ledgerMutation, {
      detected: false,
      rawExportsByteIdentical: true,
      boundedReductionsByteIdentical: true,
      canonicalProjectionsEqual: true,
      deletedEvents: 0,
      updatedEvents: 0,
    });
    assert.equal(JSON.stringify(evidence).includes('"initialEventCount"'), false);

    const pins = [
      [evidence.reads.read1.rawExport, fixture.files.export1],
      [evidence.reads.read1.boundedReduction, fixture.files.reduction1],
      [evidence.reads.read2.rawExport, fixture.files.export2],
      [evidence.reads.read2.boundedReduction, fixture.files.reduction2],
    ];
    for (const [pin, expectedPath] of pins) {
      assert.equal(pin.path, path.basename(expectedPath));
      assert.equal(pin.sha256, sha256(readFileSync(expectedPath)));
      assert.doesNotMatch(pin.path, /^[A-Za-z]:|\\|(?:^|\/)\.\.(?:\/|$)/);
    }
    assert.equal(evidence.reads.read1.observedAtUtc, observations[1]);
    assert.equal(evidence.reads.read2.observedAtUtc, observations[3]);
    assert.equal(
      evidence.reads.read1.rawExportSha256,
      evidence.reads.read2.rawExportSha256,
    );
    assert.equal(
      evidence.reads.read1.boundedReductionRawSha256,
      evidence.reads.read2.boundedReductionRawSha256,
    );
    assert.equal(summary.evidenceSha256, sha256(outputBytes));

    const secondOutput = path.join(fixture.directory, "zero-baseline-v2-copy.json");
    const second = invoke(fixture, { output: secondOutput });
    assert.equal(second.status, 0, second.stderr);
    assert.deepEqual(readFileSync(secondOutput), outputBytes);

    const beforeReplay = Buffer.from(outputBytes);
    const replay = invoke(fixture);
    assertFailed(replay, "EEXIST");
    assert.deepEqual(readFileSync(fixture.files.output), beforeReplay);
  } finally {
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test("assembles the same target baseline after the service rotates to Window 002", () => {
  const fixture = prepareFixture({ serviceActiveRunId: ACTIVE_RUN_ID });
  try {
    const result = invoke(fixture);
    assert.equal(result.status, 0, result.stderr);
    const evidence = JSON.parse(readFileSync(fixture.files.output));
    assert.equal(evidence.captureProvenance.targetRunId, ACTIVE_RUN_ID);
    assert.equal(evidence.captureProvenance.serviceActiveRunId, ACTIVE_RUN_ID);
    assert.deepEqual(evidence.captureProvenance.deploymentSource.stageReceipt, {
      path: STAGED_RECEIPT_FILENAME,
      sha256: sha256(readFileSync(fixture.files.stageReceipt)),
    });
    assert.equal(evidence.initialActiveRunEventCount, 0);
    assert.equal(evidence.initialLedgerEventCount, 37);
    assert.deepEqual(evidence.unexpectedBoundaryExclusions, {
      wrongRunDelta: 0,
      unrecognizedRun: 0,
      beforeStart: 0,
      atOrAfterEnd: 0,
    });
  } finally {
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test("rejects a 38th row, active-run state, and forged hosted reductions", async (t) => {
  await t.test("38th ledger row", () => {
    const fixture = prepareFixture({
      mutateExport(envelope) {
        envelope.events.push({ ...envelope.events[0], id: "thirty-eighth" });
      },
    });
    try {
      assertFailed(invoke(fixture), "unexpected_total_event_count");
    } finally {
      rmSync(fixture.directory, { recursive: true, force: true });
    }
  });

  await t.test("active Window 002 row", () => {
    const fixture = prepareFixture({
      mutateExport(envelope) {
        envelope.events[0].runId = ACTIVE_RUN_ID;
      },
    });
    try {
      assertFailed(invoke(fixture), "active_run_events_nonzero");
    } finally {
      rmSync(fixture.directory, { recursive: true, force: true });
    }
  });

  for (const [name, mutateReduction] of [
    ["zero metric", (response) => { response.reduction.qualifiedResultViews = 1; }],
    ["wrong-run count", (response) => { response.reduction.windowExclusionCounts.wrongRun = 36; }],
    ["before-start boundary", (response) => { response.reduction.windowExclusionCounts.beforeStart = 1; }],
    ["at-or-after-end boundary", (response) => { response.reduction.windowExclusionCounts.atOrAfterEnd = 1; }],
  ]) {
    await t.test(`forged ${name}`, () => {
      const fixture = prepareFixture({ mutateReduction });
      try {
        assertFailed(invoke(fixture), "hosted_reduction_mismatch_read1");
      } finally {
        rmSync(fixture.directory, { recursive: true, force: true });
      }
    });
  }
});

test("rejects non-independent bodies, drift, invalid times, and unsafe windows", async (t) => {
  await t.test("same input file", () => {
    const fixture = prepareFixture();
    try {
      assertFailed(
        (() => {
          unlinkSync(fixture.files.reduction1);
          linkSync(fixture.files.export1, fixture.files.reduction1);
          rewriteReceipt(fixture, (receipt) => {
            receipt.requests[1].rawBody.sha256 = sha256(
              readFileSync(fixture.files.export1),
            );
          });
          return invoke(fixture);
        })(),
        "capture_inputs_must_be_distinct_files",
      );
    } finally {
      rmSync(fixture.directory, { recursive: true, force: true });
    }
  });

  await t.test("semantically equal but byte-different export", () => {
    const fixture = prepareFixture({ export2Suffix: " " });
    try {
      assertFailed(invoke(fixture), "mismatched_export_reads");
    } finally {
      rmSync(fixture.directory, { recursive: true, force: true });
    }
  });

  await t.test("semantically equal but byte-different reduction", () => {
    const fixture = prepareFixture({ reduction2Suffix: " " });
    try {
      assertFailed(invoke(fixture), "mismatched_bounded_reduction_reads");
    } finally {
      rmSync(fixture.directory, { recursive: true, force: true });
    }
  });

  for (const [name, mutateReceipt, expected] of [
    [
      "noncanonical observation",
      (receipt) => { receipt.requests[0].observedAtUtc = "2026-09-01T11:56:00Z"; },
      "noncanonical_capture_observation_utc",
    ],
    [
      "non-increasing observations",
      (receipt) => { receipt.requests[1].observedAtUtc = observations[0]; },
      "capture_observations_not_strictly_increasing",
    ],
    [
      "observation at start",
      (receipt) => { receipt.requests[3].observedAtUtc = startUtc; },
      "baseline_observations_must_precede_start",
    ],
    [
      "stale observations",
      (receipt) => {
        receipt.requests[0].observedAtUtc = "2026-09-01T11:54:00.000Z";
        receipt.requests[1].observedAtUtc = "2026-09-01T11:54:59.999Z";
      },
      "baseline_observations_not_recent",
    ],
    [
      "non-whole-hour start",
      (receipt) => {
        receipt.windowIntent.startUtc = "2026-09-01T12:00:01.000Z";
        receipt.windowIntent.endUtc = "2026-09-15T12:00:01.000Z";
      },
      "window_start_must_be_whole_hour_utc",
    ],
    [
      "non-14-day window",
      (receipt) => { receipt.windowIntent.endUtc = "2026-09-15T11:59:59.999Z"; },
      "invalid_capture_window_intent",
    ],
  ]) {
    await t.test(name, () => {
      const fixture = prepareFixture();
      try {
        rewriteReceipt(fixture, mutateReceipt);
        assertFailed(invoke(fixture), expected);
      } finally {
        rmSync(fixture.directory, { recursive: true, force: true });
      }
    });
  }

  await t.test("caller-supplied timestamp argument", () => {
    const fixture = prepareFixture();
    try {
      assertFailed(
        invoke(fixture, { extraArgs: ["2026-09-01T11:59:30.000Z"] }),
        "usage: window002-zero-baseline-v2",
      );
    } finally {
      rmSync(fixture.directory, { recursive: true, force: true });
    }
  });

  await t.test("copied raw body cannot replace capture receipt", () => {
    const fixture = prepareFixture();
    try {
      const copied = path.join(fixture.directory, "copied-export.json");
      copyFileSync(fixture.files.export1, copied);
      assertFailed(
        invoke(fixture, { receipt: copied }),
        "capture_receipt_filename_mismatch",
      );
    } finally {
      rmSync(fixture.directory, { recursive: true, force: true });
    }
  });

  await t.test("capture sequence drift", () => {
    const fixture = prepareFixture();
    try {
      rewriteReceipt(fixture, (receipt) => {
        [receipt.requests[0], receipt.requests[1]] = [
          receipt.requests[1],
          receipt.requests[0],
        ];
      });
      assertFailed(invoke(fixture), "capture_request_sequence_mismatch");
    } finally {
      rmSync(fixture.directory, { recursive: true, force: true });
    }
  });

  await t.test("capture pin drift", () => {
    const fixture = prepareFixture();
    try {
      rewriteReceipt(
        fixture,
        (receipt) => { receipt.requests[0].rawBody.sha256 = "0".repeat(64); },
        { rebind: false },
      );
      assertFailed(invoke(fixture), "capture_binding_sha256_mismatch");
    } finally {
      rmSync(fixture.directory, { recursive: true, force: true });
    }
  });

  await t.test("staged deployment receipt pin drift", () => {
    const fixture = prepareFixture({ serviceActiveRunId: ACTIVE_RUN_ID });
    try {
      writeFileSync(
        fixture.files.stageReceipt,
        `${JSON.stringify({ ...stagedReceipt(), result: "FAIL" })}\n`,
      );
      assertFailed(invoke(fixture), "staged_deployment_receipt_sha256_mismatch");
    } finally {
      rmSync(fixture.directory, { recursive: true, force: true });
    }
  });

  await t.test("copied body path substitution", () => {
    const fixture = prepareFixture();
    try {
      const copied = path.join(fixture.directory, "copied-export.json");
      copyFileSync(fixture.files.export1, copied);
      rewriteReceipt(fixture, (receipt) => {
        receipt.requests[0].rawBody.path = path.basename(copied);
      });
      assertFailed(invoke(fixture), "invalid_capture_raw_body_pin");
    } finally {
      rmSync(fixture.directory, { recursive: true, force: true });
    }
  });
});

test("descriptor custody rejects same-path replacement and unavailable IDs", async (t) => {
  await t.test("input path replacement", () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "zero-input-identity-"));
    const input = path.join(directory, "input.json");
    const moved = path.join(directory, "input-original.json");
    writeFileSync(input, "{}\n");
    const opened = openStableInput(input, 1024, "test_input");
    try {
      renameSync(input, moved);
      writeFileSync(input, "{}\n", { flag: "wx" });
      assert.throws(
        () => revalidateOpenInput(opened, "test_input"),
        /test_input_identity_changed/,
      );
    } finally {
      closeSync(opened.descriptor);
      rmSync(directory, { recursive: true, force: true });
    }
  });

  await t.test("directory path replacement", () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "zero-dir-identity-"));
    const moved = `${directory}.moved`;
    const opened = openStableDirectory(directory, "test_directory");
    try {
      renameSync(directory, moved);
      mkdirSync(directory);
      assert.throws(
        () => revalidateOpenDirectory(opened, "test_directory"),
        /test_directory_identity_changed/,
      );
    } finally {
      closeSync(opened.descriptor);
      rmSync(directory, { recursive: true, force: true });
      rmSync(moved, { recursive: true, force: true });
    }
  });

  await t.test("unavailable file identity", () => {
    assert.throws(
      () =>
        assertDistinctInputs([
          { comparablePath: "one", dev: 0n, ino: 0n },
          { comparablePath: "two", dev: 0n, ino: 1n },
        ]),
      /capture_input_file_identity_unavailable/,
    );
  });
});
