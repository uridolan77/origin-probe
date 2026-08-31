import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdtempSync,
  mkdirSync,
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { reduceWindowEvents } from "../lib/reducer.js";
import {
  CAPTURE_BODY_FILENAMES,
  CAPTURE_RECEIPT_FILENAME,
  CAPTURE_SEQUENCE,
  PROVIDER_LOOKUP_FILENAME,
  PROTECTED_PROVENANCE_SCHEMA_VERSION,
  PROTECTED_WRAPPER_PATH,
  TRUST_MODEL,
  buildCaptureReceipt,
  requestUrls,
  windowIntent,
  withCaptureBinding,
} from "../scripts/window002-baseline-capture-v2.mjs";
import { assembleZeroBaselineV2 } from "../scripts/window002-zero-baseline-v2.mjs";
import { ACTIVE_RUN_ID } from "../scripts/window002-historical-projection.mjs";

const productRoot = fileURLToPath(new URL("../../", import.meta.url));
const script = fileURLToPath(
  new URL("../scripts/window002-promote-v2.ps1", import.meta.url),
);
const testFile = fileURLToPath(import.meta.url);
const captureScript = fileURLToPath(
  new URL("../scripts/window002-baseline-capture-v2.mjs", import.meta.url),
);
const protectedCaptureWrapper = fileURLToPath(
  new URL("../scripts/window002-baseline-capture-protected-v2.ps1", import.meta.url),
);
const protectedCaptureTest = fileURLToPath(
  new URL("./window002-baseline-capture-protected-v2.test.js", import.meta.url),
);
const captureTest = fileURLToPath(
  new URL("./window002-baseline-capture-v2.test.js", import.meta.url),
);
const zeroScript = fileURLToPath(
  new URL("../scripts/window002-zero-baseline-v2.mjs", import.meta.url),
);
const zeroTest = fileURLToPath(
  new URL("./window002-zero-baseline-v2.test.js", import.meta.url),
);
const historicalScript = fileURLToPath(
  new URL("../scripts/window002-historical-projection.mjs", import.meta.url),
);
const historicalTest = fileURLToPath(
  new URL("./window002-historical-projection.test.js", import.meta.url),
);

const originalRun = "ORIGIN-G2R-ACCEPTANCE";
const reacceptanceRun = "ORIGIN-G2R-UI-REACCEPTANCE-001";
const uniqueUrl =
  "https://origin-probe-measure-contract123-uridolan77s-projects.vercel.app";
const startUtc = "2030-01-01T12:00:00.000Z";
const endUtc = "2030-01-15T12:00:00.000Z";
const nowUtc = "2030-01-01T11:59:30.000Z";
const observations = [
  "2030-01-01T11:56:00.000Z",
  "2030-01-01T11:57:00.000Z",
  "2030-01-01T11:58:00.000Z",
  "2030-01-01T11:59:00.000Z",
];
const supplementalName = "window002-supplemental-runtime-seal-v2.json";
const zeroName = "window002-zero-baseline-v2.json";
const protectionBypass = "promotion-contract-protection-bypass-never-persist";
const providerToken = "promotion-contract-provider-token-never-persist";
const candidateId = "dpl_ContractWindow002";
const candidateHost = new URL(uniqueUrl).hostname;
const journalStates = [
  "LAUNCHED_SINGLE_ATTEMPT",
  "CLI_RETURNED_RECONCILIATION_REQUIRED",
  "PROMOTED_RECONCILED_AUTHORITATIVE_GATE_PENDING",
  "PROMOTED_RECONCILED_AUTHORITATIVE_GATE_PASSED_FINAL_RECONCILIATION_PENDING",
  "PROMOTED_RECONCILED_AUTHORITATIVE_GATE_PASSED_FINAL_RECONCILIATION_VERIFIED_PASS_PENDING",
];

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function pin(relativePath, absolutePath) {
  return { path: relativePath, sha256: sha256(readFileSync(absolutePath)) };
}

function jsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value)}\n`, "utf8");
}

function eventsFixture() {
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
  return events;
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

function exportEnvelope(events = eventsFixture()) {
  return {
    ok: true,
    scope: "all",
    activeRunId: ACTIVE_RUN_ID,
    events,
    ledgerSchemaVersion: "v1",
  };
}

function boundedEnvelope(events, window = { startUtc, endUtc }) {
  return {
    ok: true,
    reduction: reduceWindowEvents(events.map(reducerEvent), {
      runId: ACTIVE_RUN_ID,
      startUtc: window.startUtc,
      endUtc: window.endUtc,
    }),
  };
}

function stageReceipt() {
  return {
    schemaVersion: "origin.window002.staged-deployment-receipt.v1",
    result: "PASS",
    providerWriteState: "STAGED_READY_NOT_PROMOTED",
    runId: ACTIVE_RUN_ID,
    projectId: "prj_BGVULzAdg0iZSZPUwdUdVO0RO0cY",
    orgId: "team_OD1jaVJioNw3IjsSJdp5fMwB",
    scope: "uridolan77s-projects",
    repairedCommit: "2e4f33c334f5eb07204d6a69481b5c85fe15e45a",
    repairedMeasurementTree: "76218da5886b022ec7d7310dfc6c79f00228a17e",
    vercelCliVersion: "57.0.0",
    vercelTreeManifestSha256:
      "21545361d00941da2994447db68cbd5c5ddc2899a326974996fe05210e80b994",
    noRetryPreloadSha256:
      "d8ac99ea2805cd00e11e28270083192b8a5389e4142695b7c49a0fd6c04de2fe",
    wrapperSha256Before:
      "0447b882e6f1b521f7945bb42460770dbbcd778111645959df83b6568bb2a6cd",
    wrapperSha256After:
      "0447b882e6f1b521f7945bb42460770dbbcd778111645959df83b6568bb2a6cd",
    productionAliasesRemainOnAcceptedDeployment: true,
    stagedDeployment: {
      id: candidateId,
      uniqueUrl,
      target: "production",
      readyState: "READY",
      readySubstate: "STAGED",
    },
    providerReconciliation: {
      candidateAliasAssignedAtEpochMs: 1893498600000,
      candidateCreatedAtEpochMs: 1893498500000,
      candidateAliasAssignedSemantics:
        "staged_readiness_signal_not_window_start",
    },
    completedAtUtc: "2030-01-01T11:55:00.000Z",
  };
}

function supplementalSeal() {
  return {
    schemaVersion: "origin.window002.baseline-supersession-runtime-seal.v2",
    result: "PASS",
    baseRuntimeSeal: {
      path: "origin-g2-public-probe/ORIGIN_G2_WINDOW_002_RUNTIME_SEAL_RECEIPT.json",
      sha256:
        "edddde2dcf37fe21f5d983b5f066ed5c7110a720bacd11228df2b0b3675ae158",
    },
    repository: "uridolan77/origin-probe",
    artifactPins: {
      historicalProjectionTool: pin(
        "measurement/scripts/window002-historical-projection.mjs",
        historicalScript,
      ),
      historicalProjectionTest: pin(
        "measurement/test/window002-historical-projection.test.js",
        historicalTest,
      ),
      baselineCaptureV2Tool: pin(
        "measurement/scripts/window002-baseline-capture-v2.mjs",
        captureScript,
      ),
      baselineCaptureV2Test: pin(
        "measurement/test/window002-baseline-capture-v2.test.js",
        captureTest,
      ),
      baselineCaptureProtectedV2Tool: pin(
        "measurement/scripts/window002-baseline-capture-protected-v2.ps1",
        protectedCaptureWrapper,
      ),
      baselineCaptureProtectedV2Test: pin(
        "measurement/test/window002-baseline-capture-protected-v2.test.js",
        protectedCaptureTest,
      ),
      zeroBaselineV2Tool: pin(
        "measurement/scripts/window002-zero-baseline-v2.mjs",
        zeroScript,
      ),
      zeroBaselineV2Test: pin(
        "measurement/test/window002-zero-baseline-v2.test.js",
        zeroTest,
      ),
      promoteV2Tool: pin(
        "measurement/scripts/window002-promote-v2.ps1",
        script,
      ),
      promoteV2Test: pin(
        "measurement/test/window002-promote-v2.test.js",
        testFile,
      ),
    },
    inheritedRuntime: {
      legacyPromotionHelperSha256:
        "76b3c3d6ce64f02ecaa6ee36f0f6800d2fd8bf9e17c12c973197700de9affede",
      promotionGuardSha256:
        "f975e7b191eeab86a4f486d246e95485d9af10d94e1245397c688574f6dc0a70",
      vercelCliVersion: "57.0.0",
      vercelTreeManifestSha256:
        "21545361d00941da2994447db68cbd5c5ddc2899a326974996fe05210e80b994",
    },
  };
}

function prepareFixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), "window002-promote-v2-"));
  const evidenceDirectory = path.join(root, "window002-baseline-supersession");
  mkdirSync(evidenceDirectory);
  const stagePath = path.join(root, "stage.json");
  const sealPath = path.join(root, supplementalName);
  const events = eventsFixture();
  const exported = jsonBytes(exportEnvelope(events));
  const reduced = jsonBytes(boundedEnvelope(events));
  const bodies = [exported, reduced, exported, reduced];
  const bodyPaths = CAPTURE_BODY_FILENAMES.map((name, index) => {
    const output = path.join(evidenceDirectory, name);
    writeFileSync(output, bodies[index]);
    return output;
  });
  const intent = windowIntent(startUtc);
  const urls = requestUrls(uniqueUrl, intent);
  const stage = stageReceipt();
  const stageBytes = jsonBytes(stage);
  const stageCopyPath = path.join(
    evidenceDirectory,
    "staged-deployment-receipt.json",
  );
  writeFileSync(stageCopyPath, stageBytes);
  const providerDeployment = {
    id: stage.stagedDeployment.id,
    projectId: stage.projectId,
    ownerId: stage.orgId,
    url: new URL(stage.stagedDeployment.uniqueUrl).hostname,
    target: "production",
    readyState: "READY",
    readySubstate: "STAGED",
    aliasAssignedAt: stage.providerReconciliation.candidateAliasAssignedAtEpochMs,
    createdAt: stage.providerReconciliation.candidateCreatedAtEpochMs,
  };
  const providerBytes = jsonBytes(providerDeployment);
  const providerPath = path.join(evidenceDirectory, PROVIDER_LOOKUP_FILENAME);
  writeFileSync(providerPath, providerBytes);
  const providerProjection = {
    id: providerDeployment.id,
    projectId: providerDeployment.projectId,
    ownerId: providerDeployment.ownerId,
    url: providerDeployment.url,
    target: providerDeployment.target,
    readyState: providerDeployment.readyState,
    readySubstate: providerDeployment.readySubstate,
    aliasAssignedAtEpochMs: providerDeployment.aliasAssignedAt,
    createdAtEpochMs: providerDeployment.createdAt,
  };
  const protectionFingerprint = sha256(Buffer.from(protectionBypass, "utf8"));
  const capture = buildCaptureReceipt({
    uniqueUrl,
    intent,
    serviceActiveRunId: ACTIVE_RUN_ID,
    deploymentSource: {
      kind: "staged_deployment_receipt",
      stageReceipt: {
        path: "staged-deployment-receipt.json",
        sha256: sha256(stageBytes),
      },
      deploymentId: "dpl_ContractWindow002",
      uniqueUrl,
      projectId: "prj_BGVULzAdg0iZSZPUwdUdVO0RO0cY",
      orgId: "team_OD1jaVJioNw3IjsSJdp5fMwB",
      scope: "uridolan77s-projects",
    },
    operatorProvenance: {
      schemaVersion: PROTECTED_PROVENANCE_SCHEMA_VERSION,
      trustModel: TRUST_MODEL,
      phase: "staged",
      deploymentProtectionFingerprintSha256: protectionFingerprint,
      wrapper: {
        path: PROTECTED_WRAPPER_PATH,
        sha256: sha256(readFileSync(protectedCaptureWrapper)),
      },
      fixedPaths: {
        protectedStore: "OriginProbeOperator",
        stagePass: "window002-stage-pass.json",
        outputDirectoryName: "window002-baseline-supersession",
      },
      windowsProtection: {
        ownerVerified: true,
        daclVerified: true,
        reparseFree: true,
        readLocksHeld: true,
      },
      providerLookup: {
        performed: true,
        providerWrites: 0,
        method: "GET",
        apiOrigin: "https://api.vercel.com",
        pathAndQuery: `/v13/deployments/${stage.stagedDeployment.id}?teamId=${stage.orgId}`,
        notBeforeUtc: "2030-01-01T11:55:10.000Z",
        notAfterUtc: "2030-01-01T11:55:11.000Z",
        rawBody: {
          path: PROVIDER_LOOKUP_FILENAME,
          sha256: sha256(providerBytes),
          byteLength: providerBytes.length,
        },
        deployment: providerProjection,
      },
    },
    deploymentProtection: {
      header: "x-vercel-protection-bypass",
      source: "stdin_only_via_protected_wrapper",
      presented: true,
      fingerprintSha256: protectionFingerprint,
      secretLogged: false,
      secretPersisted: false,
    },
    captureToolSha256: sha256(readFileSync(captureScript)),
    requests: CAPTURE_SEQUENCE.map((kind, index) => ({
      sequence: index + 1,
      kind,
      method: "GET",
      url: urls[index],
      status: 200,
      xVercelId: `iad1::promotion-contract-${index + 1}`,
      observedAtUtc: observations[index],
      rawBody: { path: CAPTURE_BODY_FILENAMES[index], sha256: sha256(bodies[index]) },
    })),
  });
  const capturePath = path.join(evidenceDirectory, CAPTURE_RECEIPT_FILENAME);
  const captureBytes = jsonBytes(capture);
  writeFileSync(capturePath, captureBytes);
  const evidence = assembleZeroBaselineV2({
    captureReceipt: capture,
    captureReceiptPin: {
      path: CAPTURE_RECEIPT_FILENAME,
      sha256: sha256(captureBytes),
    },
    exportRead1: { bytes: bodies[0], sha256: sha256(bodies[0]) },
    reductionRead1: { bytes: bodies[1], sha256: sha256(bodies[1]) },
    exportRead2: { bytes: bodies[2], sha256: sha256(bodies[2]) },
    reductionRead2: { bytes: bodies[3], sha256: sha256(bodies[3]) },
  });
  const zeroPath = path.join(evidenceDirectory, zeroName);
  writeFileSync(zeroPath, jsonBytes(evidence));
  writeFileSync(stagePath, stageBytes);
  writeFileSync(sealPath, jsonBytes(supplementalSeal()));
  return {
    root,
    evidenceDirectory,
    stagePath,
    stageCopyPath,
    sealPath,
    capturePath,
    zeroPath,
    bodyPaths,
    providerPath,
  };
}

function invoke(fixture, extraArgs = [], spawnOptions = {}) {
  return spawnSync(
    "pwsh",
    [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-File",
      script,
      "ContractTest",
      "-ExpectedCutoverUtc",
      startUtc,
      "-EvidenceDirectoryPath",
      fixture.evidenceDirectory,
      "-SupplementalRuntimeSealPath",
      fixture.sealPath,
      "-ContractStageReceiptPath",
      fixture.stagePath,
      "-ContractNowUtc",
      nowUtc,
      "-ContractNodePath",
      process.execPath,
      ...extraArgs,
    ],
    { encoding: "utf8", cwd: productRoot, ...spawnOptions },
  );
}

function rewriteJson(file, mutate) {
  const value = JSON.parse(readFileSync(file));
  mutate(value);
  writeFileSync(file, jsonBytes(value));
}

function rewriteCapture(fixture, mutate) {
  const receipt = JSON.parse(readFileSync(fixture.capturePath));
  delete receipt.captureBindingSha256;
  mutate(receipt);
  writeFileSync(fixture.capturePath, jsonBytes(withCaptureBinding(receipt)));
}

function rewriteRawLedger(fixture, mutateEvents) {
  const envelope = JSON.parse(readFileSync(fixture.bodyPaths[0]));
  mutateEvents(envelope.events);
  const exported = jsonBytes(envelope);
  const reduced = jsonBytes(boundedEnvelope(envelope.events));
  for (const index of [0, 2]) writeFileSync(fixture.bodyPaths[index], exported);
  for (const index of [1, 3]) writeFileSync(fixture.bodyPaths[index], reduced);
  rewriteCapture(fixture, (capture) => {
    const bodies = [exported, reduced, exported, reduced];
    capture.requests.forEach((request, index) => {
      request.rawBody.sha256 = sha256(bodies[index]);
    });
  });
}

function rewriteRawBodyPair(fixture, indexes, mutate) {
  const value = JSON.parse(readFileSync(fixture.bodyPaths[indexes[0]]));
  mutate(value);
  const bytes = jsonBytes(value);
  for (const index of indexes) writeFileSync(fixture.bodyPaths[index], bytes);
  rewriteCapture(fixture, (capture) => {
    for (const index of indexes) capture.requests[index].rawBody.sha256 = sha256(bytes);
  });
}

function rewriteProviderAndCapture(fixture, mutate) {
  const provider = JSON.parse(readFileSync(fixture.providerPath));
  mutate(provider);
  const bytes = jsonBytes(provider);
  writeFileSync(fixture.providerPath, bytes);
  rewriteCapture(fixture, (capture) => {
    const lookup = capture.operatorProvenance.providerLookup;
    lookup.rawBody.sha256 = sha256(bytes);
    lookup.rawBody.byteLength = bytes.length;
    lookup.deployment.aliasAssignedAtEpochMs = provider.aliasAssignedAt;
    lookup.deployment.createdAtEpochMs = provider.createdAt;
  });
}

function prepareLiveGateProbe(
  fixture,
  { phase = "pre_promotion", window = { startUtc, endUtc }, mutateExports = () => {} } = {},
) {
  const rawBodyPaths = fixture.bodyPaths.map((source, index) => {
    const target = path.join(fixture.root, `live-gate-contract-${index + 1}.json`);
    if (index === 0 || index === 2) {
      const value = JSON.parse(readFileSync(source));
      mutateExports(value);
      writeFileSync(target, jsonBytes(value));
    } else if (window.startUtc !== startUtc || window.endUtc !== endUtc) {
      const events = JSON.parse(readFileSync(fixture.bodyPaths[0])).events;
      writeFileSync(target, jsonBytes(boundedEnvelope(events, window)));
    } else {
      writeFileSync(target, readFileSync(source));
    }
    return target;
  });
  const probePath = path.join(fixture.root, "live-gate-contract.json");
  writeFileSync(probePath, jsonBytes({
    schemaVersion: "origin.window002.live-gate-contract.v1",
    phase,
    startUtc: window.startUtc,
    endUtc: window.endUtc,
    rawBodyPaths,
  }));
  return probePath;
}

function assertRejected(fixture, expected) {
  const result = invoke(fixture);
  assert.notEqual(result.status, 0, "adversarial fixture unexpectedly passed");
  assert.match(result.stderr, new RegExp(expected));
}

function directorySnapshot(root) {
  const visit = (directory) =>
    readdirSync(directory, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name))
      .flatMap((entry) => {
        const absolute = path.join(directory, entry.name);
        const relative = path.relative(root, absolute).replaceAll("\\", "/");
        return entry.isDirectory()
          ? [{ path: relative, directory: true }, ...visit(absolute)]
          : [{ path: relative, sha256: sha256(readFileSync(absolute)) }];
      });
  return visit(root);
}

function prepareJournalProbe(fixture, recordCount = journalStates.length) {
  const attemptId = "11111111-1111-4111-8111-111111111111";
  const initialPath = path.join(fixture.root, "contract-pending.json");
  const initialBytes = jsonBytes({
    schemaVersion: "origin.window002.promotion-receipt.v2",
    attemptId,
    result: "PENDING",
    status: "AUTHORIZED_NOT_STARTED",
    providerWriteState: "MUTATION_AUTHORIZED_NOT_LAUNCHED",
  });
  writeFileSync(initialPath, initialBytes);
  let previous = { path: initialPath, sha256: sha256(initialBytes) };
  const records = [];
  for (let index = 0; index < recordCount; index += 1) {
    const sequence = index + 1;
    const recordPath = path.join(
      fixture.root,
      `contract-journal-${String(sequence).padStart(3, "0")}.json`,
    );
    const value = {
      schemaVersion: "origin.window002.promotion-journal-record.v1",
      attemptId,
      sequence,
      state: journalStates[index],
      recordedAtUtc: `2030-01-01T12:00:${String(sequence).padStart(2, "0")}.000Z`,
      previousRecord: {
        path: path.basename(previous.path),
        sha256: previous.sha256,
      },
      snapshot: {
        attemptId,
        result: "PENDING",
        status:
          sequence >= 3
            ? "INTEGRITY_WITHDRAWAL_REQUIRED_UNTIL_AUTHORITATIVE_GATE_PASSES"
            : "AUTHORIZED_NOT_STARTED",
        providerWriteState: journalStates[index],
      },
    };
    const bytes = jsonBytes(value);
    writeFileSync(recordPath, bytes);
    const entry = { path: recordPath, sha256: sha256(bytes), state: journalStates[index] };
    records.push(entry);
    previous = entry;
  }
  const manifestPath = path.join(fixture.root, "contract-journal-manifest.json");
  const manifest = {
    schemaVersion: "origin.window002.promotion-journal-contract.v1",
    attemptId,
    initial: { path: initialPath, sha256: sha256(initialBytes) },
    records,
    occupiedNextPath: path.join(fixture.root, "contract-journal-next.json"),
  };
  writeFileSync(manifestPath, jsonBytes(manifest));
  return { attemptId, initialPath, manifest, manifestPath, records };
}

function providerReconciliation(phase, overrides = {}) {
  const before =
    phase === "post_promotion_initial"
      ? "2030-01-01T12:00:01.000Z"
      : "2030-01-01T12:00:04.000Z";
  const after =
    phase === "post_promotion_initial"
      ? "2030-01-01T12:00:02.000Z"
      : "2030-01-01T12:00:05.000Z";
  const digest = (label) => sha256(Buffer.from(`${phase}:${label}`));
  return {
    schemaVersion: "origin.window002.provider-reconciliation.v2",
    phase,
    providerWrites: 0,
    projectId: "prj_BGVULzAdg0iZSZPUwdUdVO0RO0cY",
    orgId: "team_OD1jaVJioNw3IjsSJdp5fMwB",
    candidateDeploymentId: candidateId,
    candidateUniqueHost: candidateHost,
    candidateReadySubstate: "PROMOTED",
    aliasAssignedAtEpochMs: Date.parse(startUtc),
    startUtc,
    endUtc,
    aliasMappings: {
      publicAliasHost: "origin-probe-measure.vercel.app",
      publicAliasDeploymentId: candidateId,
      automaticAliasHost: "origin-probe-measure-uridolan77s-projects.vercel.app",
      automaticAliasDeploymentId: candidateId,
    },
    projectRawSha256: digest("project"),
    domainRawSha256: digest("domain"),
    candidateRawSha256: digest("candidate"),
    candidateAliasesRawSha256: digest("candidate-aliases"),
    supersededRawSha256: digest("superseded"),
    supersededAliasesRawSha256: digest("superseded-aliases"),
    publicAliasRawSha256: digest("public-alias"),
    automaticAliasRawSha256: digest("automatic-alias"),
    notBeforeUtc: before,
    notAfterUtc: after,
    ...overrides,
  };
}

function prepareProviderProbe(fixture, mutate = () => {}) {
  const value = {
    schemaVersion: "origin.window002.provider-reconciliation-contract.v1",
    expectedCandidateDeploymentId: candidateId,
    expectedCandidateUniqueHost: candidateHost,
    postGateNotAfterUtc: "2030-01-01T12:00:03.000Z",
    first: providerReconciliation("post_promotion_initial"),
    final: providerReconciliation("pre_pass_final"),
  };
  mutate(value);
  const probePath = path.join(fixture.root, "provider-continuity.json");
  writeFileSync(probePath, jsonBytes(value));
  return probePath;
}

function prepareCredentialProbe(
  fixture,
  {
    body = "{\"ok\":true}",
    bodyBytes,
    providerBody,
    providerBodyBytes,
    adminKey,
    bypass,
    token = providerToken,
    ...metadata
  },
) {
  const serviceBytes = bodyBytes ?? Buffer.from(body, "utf8");
  const providerBytes = providerBodyBytes ?? Buffer.from(providerBody ?? "{\"ok\":true}", "utf8");
  const value = {
    schemaVersion: "origin.window002.credential-reflection-contract.v1",
    providerToken: token,
    adminKey,
    protectionBypass: bypass,
    serviceResponseBase64: serviceBytes.toString("base64"),
    providerResponseBase64: providerBytes.toString("base64"),
    providerIdentity: "iad1::contract-safe-provider-id",
    cliStdout: "safe promotion output",
    cliStderr: "",
    ...metadata,
  };
  const probePath = path.join(fixture.root, "credential-reflection.json");
  writeFileSync(probePath, jsonBytes(value));
  return probePath;
}

function encodedCredentialRepresentations(secret) {
  const utf8 = Buffer.from(secret, "utf8");
  const utf16le = Buffer.from(secret, "utf16le");
  const utf16be = Buffer.from(utf16le);
  for (let index = 0; index < utf16be.length; index += 2) {
    [utf16be[index], utf16be[index + 1]] = [utf16be[index + 1], utf16be[index]];
  }
  const utf32le = Buffer.alloc(secret.length * 4);
  const utf32be = Buffer.alloc(secret.length * 4);
  [...secret].forEach((character, index) => {
    utf32le.writeUInt32LE(character.codePointAt(0), index * 4);
    utf32be.writeUInt32BE(character.codePointAt(0), index * 4);
  });
  const binaryForms = [];
  for (const [label, bytes] of [
    ["utf8", utf8],
    ["utf16le", utf16le],
    ["utf16be", utf16be],
    ["utf32le", utf32le],
    ["utf32be", utf32be],
  ]) {
    const base64 = bytes.toString("base64");
    binaryForms.push(
      [`${label} base64 padded`, base64],
      [`${label} base64 unpadded`, base64.replace(/=+$/u, "")],
      [`${label} base64url padded`, base64.replaceAll("+", "-").replaceAll("/", "_")],
      [`${label} base64url unpadded`, base64.replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "")],
      [`${label} hex lower`, bytes.toString("hex")],
      [`${label} hex upper`, bytes.toString("hex").toUpperCase()],
    );
  }
  const fullPercent = [...utf8].map((byte) => `%${byte.toString(16).padStart(2, "0")}`).join("");
  return [
    ["raw", secret],
    ["canonical JSON escaped", JSON.stringify(secret).slice(1, -1)],
    ["encodeURIComponent", encodeURIComponent(secret)],
    ["encodeURI", encodeURI(secret)],
    ["full percent lower", fullPercent],
    ["full percent upper", fullPercent.toUpperCase()],
    ["HTML named/escaped", secret.replaceAll("&", "&amp;").replaceAll('"', "&quot;")],
    ["HTML decimal", [...secret].map((character) => `&#${character.codePointAt(0)};`).join("")],
    ["HTML hex lower", [...secret].map((character) => `&#x${character.codePointAt(0).toString(16)};`).join("")],
    ["HTML hex upper", [...secret].map((character) => `&#X${character.codePointAt(0).toString(16).toUpperCase()};`).join("")],
    ...binaryForms,
  ];
}

test("ContractTest accepts the exact 16/21/37 superseded baseline without writing", () => {
  const fixture = prepareFixture();
  try {
    const before = directorySnapshot(fixture.root);
    const result = invoke(fixture);
    assert.equal(result.status, 0, result.stderr);
    const summary = JSON.parse(result.stdout);
    assert.deepEqual(
      {
        schemaVersion: summary.schemaVersion,
        result: summary.result,
        providerWrites: summary.providerWrites,
        filesystemWrites: summary.filesystemWrites,
        journalWrites: summary.journalWrites,
        initialActiveRunEventCount: summary.initialActiveRunEventCount,
        initialLedgerEventCount: summary.initialLedgerEventCount,
        immediateGateContract: summary.immediateGateContract,
        windowReducerSha256: summary.windowReducerSha256,
      },
      {
        schemaVersion: "origin.window002.promotion-contract-test.v2",
        result: "PASS",
        providerWrites: 0,
        filesystemWrites: 0,
        journalWrites: 0,
        initialActiveRunEventCount: 0,
        initialLedgerEventCount: 37,
        immediateGateContract:
          "synthetic_two_read_export_reduction_recomputed",
        windowReducerSha256:
          "c2a14b8f14dd272f563f46b0ea16baa40715ed2799d845c733e00671e57f63b0",
      },
    );
    assert.deepEqual(directorySnapshot(fixture.root), before);
    assert.equal(JSON.stringify(summary).includes("initialEventCount"), false);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("pinned baseline analysis clears ambient Node and credential environments", () => {
  const fixture = prepareFixture();
  try {
    const markerPath = path.join(fixture.root, "ambient-node-options-ran.json");
    const maliciousImportPath = path.join(fixture.root, "ambient-node-options-import.mjs");
    writeFileSync(
      maliciousImportPath,
      [
        'import { writeFileSync } from "node:fs";',
        `const markerPath = ${JSON.stringify(markerPath)};`,
        "const inspected = Object.fromEntries(Object.entries(process.env).filter(([key]) =>",
        '  /NODE|TLS|PROXY|TOKEN|ADMIN|SENTINEL|PROFILE/iu.test(key)));',
        "writeFileSync(markerPath, JSON.stringify(inspected));",
        'throw new Error("ambient_node_options_executed");',
      ].join("\n"),
    );
    const before = directorySnapshot(fixture.root);
    const ambientSecrets = {
      ORIGIN_MEASUREMENT_ADMIN_KEY: "ambient-admin-key-must-not-reach-child",
      ORIGIN_OPERATOR_PROFILE: "ambient-profile-must-not-reach-child",
      ORIGIN_PROMOTION_SENTINEL: "ambient-sentinel-must-not-reach-child",
      VERCEL_TOKEN: "ambient-provider-token-must-not-reach-child",
    };
    const result = invoke(fixture, [], {
      env: {
        ...process.env,
        ...ambientSecrets,
        ALL_PROXY: "http://ambient-proxy.invalid",
        HTTPS_PROXY: "http://ambient-proxy.invalid",
        HTTP_PROXY: "http://ambient-proxy.invalid",
        NODE_OPTIONS: `--import=${pathToFileURL(maliciousImportPath).href}`,
        NODE_PATH: path.join(fixture.root, "ambient-node-path"),
        NODE_TLS_REJECT_UNAUTHORIZED: "0",
        SSL_CERT_FILE: path.join(fixture.root, "ambient-ca.pem"),
      },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).result, "PASS");
    assert.equal(existsSync(markerPath), false, "NODE_OPTIONS import executed");
    for (const secret of Object.values(ambientSecrets)) {
      assert.equal(`${result.stdout}${result.stderr}`.includes(secret), false);
    }
    assert.deepEqual(directorySnapshot(fixture.root), before);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("pinned Node analysis rejects multiline, bounded overflow, and timeout", async (t) => {
  for (const [mode, expected] of [
    ["Multiline", /must be exactly one line/],
    ["OversizedStdout", /bounded stdout/],
    ["OversizedStderr", /bounded stderr/],
    ["Timeout", /timed out/],
  ]) {
    await t.test(mode, () => {
      const fixture = prepareFixture();
      try {
        const before = directorySnapshot(fixture.root);
        const result = invoke(fixture, ["-ContractPinnedNodeProbeMode", mode]);
        assert.notEqual(result.status, 0, `${mode} unexpectedly passed`);
        assert.match(result.stderr, expected);
        assert.doesNotMatch(result.stdout, /PUBLIC_PROBE_WINDOW_RUNNING|"result":"PASS"/);
        assert.deepEqual(directorySnapshot(fixture.root), before);
      } finally {
        rmSync(fixture.root, { recursive: true, force: true });
      }
    });
  }
});

test("rejects legacy, active, 38th-row, and historical-split baselines", async (t) => {
  for (const [name, mutate, expected] of [
    [
      "legacy v1 baseline",
      (fixture) => rewriteJson(fixture.zeroPath, (zero) => { zero.schemaVersion = "origin.window002.zero-baseline.v1"; }),
      "legacy or unknown zero-baseline",
    ],
    [
      "active Window 002 row",
      (fixture) => rewriteRawLedger(fixture, (events) => { events[0].runId = ACTIVE_RUN_ID; }),
      "active or unrecognized run",
    ],
    [
      "38th ledger row",
      (fixture) => rewriteRawLedger(fixture, (events) => { events.push({ ...events[0], id: "row-38" }); }),
      "retained Window 002 ledger",
    ],
    [
      "15/22 historical split",
      (fixture) => rewriteRawLedger(fixture, (events) => { events[0].runId = reacceptanceRun; }),
      "exact 16/21 historical split",
    ],
  ]) {
    await t.test(name, () => {
      const fixture = prepareFixture();
      try {
        mutate(fixture);
        assertRejected(fixture, expected);
      } finally {
        rmSync(fixture.root, { recursive: true, force: true });
      }
    });
  }
});

test("rejects metric, boundary, mutation, capture, stage, and seal drift", async (t) => {
  for (const [name, mutate, expected] of [
    [
      "nonzero active metric",
      (fixture) => rewriteJson(fixture.zeroPath, (zero) => { zero.activeRunBaseline.qualifiedResultViews = 1; }),
      "active Window 002 baseline is nonzero",
    ],
    [
      "boundary exclusion",
      (fixture) => rewriteJson(fixture.zeroPath, (zero) => { zero.unexpectedBoundaryExclusions.beforeStart = 1; }),
      "unexpected boundary beforeStart",
    ],
    [
      "ledger mutation",
      (fixture) => rewriteJson(fixture.zeroPath, (zero) => { zero.ledgerMutation.detected = true; }),
      "ledger mutation detected is not the exact JSON Boolean false",
    ],
    [
      "capture stage mismatch",
      (fixture) => rewriteCapture(fixture, (capture) => { capture.uniqueUrl = "https://origin-probe-measure-other123-uridolan77s-projects.vercel.app"; }),
      "capture is not bound",
    ],
    [
      "missing staged deployment source",
      (fixture) => rewriteCapture(fixture, (capture) => { delete capture.deploymentSource; }),
      "capture receipt field set changed",
    ],
    [
      "forged staged deployment source pin",
      (fixture) => rewriteCapture(fixture, (capture) => { capture.deploymentSource.stageReceipt.sha256 = "0".repeat(64); }),
      "capture staged-deployment receipt pin does not match",
    ],
    [
      "captured stage receipt drift",
      (fixture) => rewriteJson(fixture.stageCopyPath, (stage) => { stage.repairedCommit = "0".repeat(40); }),
      "captured stage receipt differs",
    ],
    [
      "missing captured stage receipt",
      (fixture) => rmSync(fixture.stageCopyPath),
      "captured stage receipt is absent",
    ],
    [
      "stage identity mismatch",
      (fixture) => rewriteJson(fixture.stagePath, (stage) => { stage.repairedCommit = "0".repeat(40); }),
      "stage receipt does not pin",
    ],
    [
      "supplemental seal mismatch",
      (fixture) => rewriteJson(fixture.sealPath, (seal) => { seal.artifactPins.zeroBaselineV2Tool.sha256 = "0".repeat(64); }),
      "does not match the exact artifact",
    ],
    [
      "protected wrapper supplemental pin mismatch",
      (fixture) => rewriteJson(fixture.sealPath, (seal) => { seal.artifactPins.baselineCaptureProtectedV2Tool.sha256 = "0".repeat(64); }),
      "does not match the exact artifact",
    ],
    [
      "inherited runtime mismatch",
      (fixture) => rewriteJson(fixture.sealPath, (seal) => { seal.inheritedRuntime.vercelCliVersion = "56.0.0"; }),
      "inherited sealed runtime identity changed",
    ],
  ]) {
    await t.test(name, () => {
      const fixture = prepareFixture();
      try {
        mutate(fixture);
        assertRejected(fixture, expected);
      } finally {
        rmSync(fixture.root, { recursive: true, force: true });
      }
    });
  }
});

test("rejects staged protection and protected operator provenance drift", async (t) => {
  for (const [name, mutate, expected] of [
    [
      "deployment protection not presented",
      (fixture) => rewriteCapture(fixture, (capture) => { capture.deploymentProtection.presented = false; }),
      "capture deploymentProtection.presented is not the exact JSON Boolean true",
    ],
    [
      "deployment protection persisted",
      (fixture) => rewriteCapture(fixture, (capture) => { capture.deploymentProtection.secretPersisted = true; }),
      "capture deploymentProtection.secretPersisted is not the exact JSON Boolean false",
    ],
    [
      "deployment protection fingerprint drift",
      (fixture) => rewriteCapture(fixture, (capture) => { capture.deploymentProtection.fingerprintSha256 = "0".repeat(64); }),
      "protected operator provenance binding changed",
    ],
    [
      "operator trust-model drift",
      (fixture) => rewriteCapture(fixture, (capture) => { capture.operatorProvenance.trustModel = "self_asserted"; }),
      "protected operator provenance binding changed",
    ],
    [
      "protected wrapper receipt pin drift",
      (fixture) => rewriteCapture(fixture, (capture) => { capture.operatorProvenance.wrapper.sha256 = "0".repeat(64); }),
      "protected capture wrapper pin does not match",
    ],
    [
      "fixed protected output path drift",
      (fixture) => rewriteCapture(fixture, (capture) => { capture.operatorProvenance.fixedPaths.outputDirectoryName = "unprotected-output"; }),
      "protected capture fixed paths changed",
    ],
    [
      "incomplete Windows protection",
      (fixture) => rewriteCapture(fixture, (capture) => { capture.operatorProvenance.windowsProtection.readLocksHeld = false; }),
      "Windows protection provenance readLocksHeld is not the exact JSON Boolean true",
    ],
  ]) {
    await t.test(name, () => {
      const fixture = prepareFixture();
      try {
        mutate(fixture);
        assertRejected(fixture, expected);
      } finally {
        rmSync(fixture.root, { recursive: true, force: true });
      }
    });
  }
});

test("rejects staged GET-only provider provenance and raw lookup drift", async (t) => {
  for (const [name, mutate, expected] of [
    [
      "provider lookup method drift",
      (fixture) => rewriteCapture(fixture, (capture) => { capture.operatorProvenance.providerLookup.method = "POST"; }),
      "not exact GET-only provenance",
    ],
    [
      "provider lookup mutation count",
      (fixture) => rewriteCapture(fixture, (capture) => { capture.operatorProvenance.providerLookup.providerWrites = 1; }),
      "not exact GET-only provenance",
    ],
    [
      "provider lookup endpoint drift",
      (fixture) => rewriteCapture(fixture, (capture) => { capture.operatorProvenance.providerLookup.pathAndQuery = "/v13/deployments/other"; }),
      "not exact GET-only provenance",
    ],
    [
      "provider lookup raw byte-length drift",
      (fixture) => rewriteCapture(fixture, (capture) => { capture.operatorProvenance.providerLookup.rawBody.byteLength += 1; }),
      "provider lookup raw-body pin changed",
    ],
    [
      "provider lookup raw file drift",
      (fixture) => rewriteJson(fixture.providerPath, (provider) => { provider.readySubstate = "PROMOTED"; }),
      "provider lookup raw-body pin changed",
    ],
    [
      "provider lookup UTC bracket too wide",
      (fixture) => rewriteCapture(fixture, (capture) => { capture.operatorProvenance.providerLookup.notAfterUtc = "2030-01-01T11:55:31.000Z"; }),
      "provider lookup UTC bracket is invalid",
    ],
    [
      "provider lookup after capture",
      (fixture) => rewriteCapture(fixture, (capture) => {
        capture.operatorProvenance.providerLookup.notBeforeUtc = "2030-01-01T11:56:00.000Z";
        capture.operatorProvenance.providerLookup.notAfterUtc = "2030-01-01T11:56:01.000Z";
      }),
      "provider lookup was not bracketed before",
    ],
    [
      "provider projection identity drift",
      (fixture) => rewriteCapture(fixture, (capture) => { capture.operatorProvenance.providerLookup.deployment.url = "other.vercel.app"; }),
      "provider lookup projection identity changed",
    ],
  ]) {
    await t.test(name, () => {
      const fixture = prepareFixture();
      try {
        mutate(fixture);
        assertRejected(fixture, expected);
      } finally {
        rmSync(fixture.root, { recursive: true, force: true });
      }
    });
  }
});

test("rejects zero-baseline provenance that does not exactly bind capture", async (t) => {
  for (const [name, mutate] of [
    [
      "operator provenance drift",
      (zero) => { zero.captureProvenance.operatorProvenance.trustModel = "self_asserted"; },
    ],
    [
      "deployment protection drift",
      (zero) => { zero.captureProvenance.deploymentProtection.presented = false; },
    ],
    [
      "deployment source drift",
      (zero) => { zero.captureProvenance.deploymentSource.deploymentId = "dpl_Other"; },
    ],
  ]) {
    await t.test(name, () => {
      const fixture = prepareFixture();
      try {
        rewriteJson(fixture.zeroPath, mutate);
        assertRejected(fixture, "zero-baseline capture provenance changed");
      } finally {
        rmSync(fixture.root, { recursive: true, force: true });
      }
    });
  }
});

test("rejects a coordinated fake canonical projection digest", () => {
  const fixture = prepareFixture();
  try {
    rewriteJson(fixture.zeroPath, (zero) => {
      const fake = "f".repeat(64);
      zero.reads.read1.canonicalEventProjectionSha256 = fake;
      zero.reads.read2.canonicalEventProjectionSha256 = fake;
      zero.retainedHistoricalLedger.canonicalEventProjectionSha256 = fake;
    });
    assertRejected(fixture, "zero-baseline read digest differs from reopened evidence");
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("live-gate contract binds exact accepted export bytes and selected reduction bytes", async (t) => {
  await t.test("selected-window exact raw evidence passes", () => {
    const fixture = prepareFixture();
    try {
      const probePath = prepareLiveGateProbe(fixture);
      const before = directorySnapshot(fixture.root);
      const result = invoke(fixture, ["-ContractLiveGateProbePath", probePath]);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(JSON.parse(result.stdout).liveGateContractChecks, 1);
      assert.deepEqual(directorySnapshot(fixture.root), before);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });
  await t.test("authoritative post window recomputes without stale reduction pins", () => {
    const fixture = prepareFixture();
    try {
      const window = {
        startUtc: "2030-01-01T12:00:01.000Z",
        endUtc: "2030-01-15T12:00:01.000Z",
      };
      const probePath = prepareLiveGateProbe(fixture, {
        phase: "post_promotion_authoritative",
        window,
      });
      const result = invoke(fixture, ["-ContractLiveGateProbePath", probePath]);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(JSON.parse(result.stdout).liveGateContractChecks, 1);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });
  await t.test("ignored payload drift preserves projection/reduction but cannot reach RUNNING", () => {
    const fixture = prepareFixture();
    try {
      const probePath = prepareLiveGateProbe(fixture, {
        mutateExports: (envelope) => {
          envelope.events[0].payload = { ignoredMutation: "raw-bytes-drift-only" };
          envelope.events[0].uaClass = "ignored-metadata-drift";
        },
      });
      const result = invoke(fixture, ["-ContractLiveGateProbePath", probePath]);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /live export raw bytes differ from the accepted retained history/);
      assert.doesNotMatch(result.stdout, /PUBLIC_PROBE_WINDOW_RUNNING|"result":"PASS"/);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });
  await t.test("property-order-only drift preserves canonical facts but fails exact raw bytes", () => {
    const fixture = prepareFixture();
    try {
      const probePath = prepareLiveGateProbe(fixture, {
        mutateExports: (envelope) => {
          envelope.events[0] = Object.fromEntries(Object.entries(envelope.events[0]).reverse());
        },
      });
      const result = invoke(fixture, ["-ContractLiveGateProbePath", probePath]);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /live export raw bytes differ from the accepted retained history/);
      assert.doesNotMatch(result.stdout, /PUBLIC_PROBE_WINDOW_RUNNING|"result":"PASS"/);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });
});

test("nested zero-baseline artifact pins reject extra fields", async (t) => {
  for (const [name, mutate] of [
    ["raw export pin", (zero) => { zero.reads.read1.rawExport.extra = "not-pinned"; }],
    ["bounded reduction pin", (zero) => { zero.reads.read2.boundedReduction.extra = "not-pinned"; }],
  ]) {
    await t.test(name, () => {
      const fixture = prepareFixture();
      try {
        rewriteJson(fixture.zeroPath, mutate);
        assertRejected(fixture, "field set changed");
      } finally {
        rmSync(fixture.root, { recursive: true, force: true });
      }
    });
  }
});

test("strict JSON scalar types reject strings, nulls, Booleans, and fractions", async (t) => {
  const cases = [
    ["stage expected-true string", (fixture) => rewriteJson(fixture.stagePath, (stage) => { stage.productionAliasesRemainOnAcceptedDeployment = "true"; })],
    ["stage integer string", (fixture) => rewriteJson(fixture.stagePath, (stage) => { stage.providerReconciliation.candidateAliasAssignedAtEpochMs = "1893498600000"; })],
    ["capture expected-true integer", (fixture) => rewriteCapture(fixture, (capture) => { capture.deploymentProtection.presented = 1; })],
    ["capture expected-false null", (fixture) => rewriteCapture(fixture, (capture) => { capture.deploymentProtection.secretLogged = null; })],
    ["Windows expected-true string", (fixture) => rewriteCapture(fixture, (capture) => { capture.operatorProvenance.windowsProtection.ownerVerified = "true"; })],
    ["providerWrites Boolean", (fixture) => rewriteCapture(fixture, (capture) => { capture.operatorProvenance.providerLookup.providerWrites = false; })],
    ["provider raw fractional timestamp", (fixture) => rewriteProviderAndCapture(fixture, (provider) => { provider.createdAt += 0.5; })],
    ["window days string", (fixture) => rewriteCapture(fixture, (capture) => { capture.windowIntent.days = "14"; })],
    ["request timeout fraction", (fixture) => rewriteCapture(fixture, (capture) => { capture.contract.requestTimeoutMs = 15000.5; })],
    ["authentication status null", (fixture) => rewriteCapture(fixture, (capture) => { capture.authentication.acceptedStatus = null; })],
    ["request sequence string", (fixture) => rewriteCapture(fixture, (capture) => { capture.requests[0].sequence = "1"; })],
    ["export ok string", (fixture) => rewriteRawBodyPair(fixture, [0, 2], (body) => { body.ok = "true"; })],
    ["reduction ok integer", (fixture) => rewriteRawBodyPair(fixture, [1, 3], (body) => { body.ok = 1; })],
    ["zero active integer string", (fixture) => rewriteJson(fixture.zeroPath, (zero) => { zero.activeRunBaseline.rawEventCount = "0"; })],
    ["zero expected-true integer", (fixture) => rewriteJson(fixture.zeroPath, (zero) => { zero.retainedHistoricalLedger.historyPreserved = 1; })],
    ["zero expected-false integer", (fixture) => rewriteJson(fixture.zeroPath, (zero) => { zero.ledgerMutation.detected = 0; })],
    ["zero initial count fraction", (fixture) => rewriteJson(fixture.zeroPath, (zero) => { zero.initialLedgerEventCount = 37.5; })],
  ];
  for (const [name, mutate] of cases) {
    await t.test(name, () => {
      const fixture = prepareFixture();
      try {
        mutate(fixture);
        const result = invoke(fixture);
        assert.notEqual(result.status, 0, "wrong scalar type unexpectedly passed");
        assert.match(result.stderr, /exact JSON Boolean|not a JSON integer/);
      } finally {
        rmSync(fixture.root, { recursive: true, force: true });
      }
    });
  }
  await t.test("journal sequence numeric string", () => {
    const fixture = prepareFixture();
    try {
      const probe = prepareJournalProbe(fixture);
      const record = JSON.parse(readFileSync(probe.records[0].path));
      record.sequence = "1";
      const bytes = jsonBytes(record);
      writeFileSync(probe.records[0].path, bytes);
      probe.manifest.records[0].sha256 = sha256(bytes);
      writeFileSync(probe.manifestPath, jsonBytes(probe.manifest));
      const result = invoke(fixture, ["-ContractJournalManifestPath", probe.manifestPath]);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /promotion journal sequence is not a JSON integer/);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });
  for (const [name, mutate] of [
    ["providerWrites numeric string", (probe) => { probe.first.providerWrites = "0"; }],
    ["alias timestamp fraction", (probe) => { probe.final.aliasAssignedAtEpochMs += 0.5; }],
  ]) {
    await t.test(name, () => {
      const fixture = prepareFixture();
      try {
        const probePath = prepareProviderProbe(fixture, mutate);
        const result = invoke(fixture, ["-ContractProviderReconciliationPath", probePath]);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /not a JSON integer/);
      } finally {
        rmSync(fixture.root, { recursive: true, force: true });
      }
    });
  }
});

test("supplemental seal rejects unsupported repository commit and tree claims", () => {
  const fixture = prepareFixture();
  try {
    rewriteJson(fixture.sealPath, (seal) => {
      seal.commit = "a".repeat(40);
      seal.tree = "b".repeat(40);
    });
    assertRejected(fixture, "supplemental runtime seal field set changed");
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("ContractTest validates the immutable append-only journal without writes", async (t) => {
  for (const [name, mutate, shouldPass, expected] of [
    ["full contiguous chain", () => {}, true, null],
    [
      "wrong previous digest",
      (probe) => {
        const record = JSON.parse(readFileSync(probe.records[2].path));
        record.previousRecord.sha256 = "f".repeat(64);
        const bytes = jsonBytes(record);
        writeFileSync(probe.records[2].path, bytes);
        probe.manifest.records[2].sha256 = sha256(bytes);
      },
      false,
      "append-only promotion journal chain is invalid",
    ],
    [
      "reopened-byte mismatch",
      (probe) => {
        const record = JSON.parse(readFileSync(probe.records[1].path));
        record.snapshot.extra = "tampered-after-pin";
        writeFileSync(probe.records[1].path, jsonBytes(record));
      },
      false,
      "reopened with different bytes",
    ],
    [
      "gapped sequence",
      (probe) => probe.manifest.records.shift(),
      false,
      "sequence state is not fixed",
    ],
    [
      "wrong attempt",
      (probe) => {
        const record = JSON.parse(readFileSync(probe.records[0].path));
        record.attemptId = "22222222-2222-4222-8222-222222222222";
        const bytes = jsonBytes(record);
        writeFileSync(probe.records[0].path, bytes);
        probe.manifest.records[0].sha256 = sha256(bytes);
      },
      false,
      "append-only promotion journal chain is invalid",
    ],
    [
      "wrong deterministic state",
      (probe) => { probe.manifest.records[1].state = "ARBITRARY"; },
      false,
      "sequence state is not fixed",
    ],
    [
      "unexpected extra record",
      (probe) => probe.manifest.records.push({
        path: probe.records[4].path,
        sha256: probe.records[4].sha256,
        state: "EXTRA",
      }),
      false,
      "unexpected extra record",
    ],
    [
      "concurrent creator occupies next sequence",
      (probe) => writeFileSync(probe.manifest.occupiedNextPath, jsonBytes({ competing: true })),
      false,
      "next append-only journal sequence is already occupied",
    ],
  ]) {
    await t.test(name, () => {
      const fixture = prepareFixture();
      try {
        const probe = prepareJournalProbe(fixture);
        mutate(probe);
        writeFileSync(probe.manifestPath, jsonBytes(probe.manifest));
        const before = directorySnapshot(fixture.root);
        const result = invoke(fixture, [
          "-ContractJournalManifestPath",
          probe.manifestPath,
        ]);
        if (shouldPass) {
          assert.equal(result.status, 0, result.stderr);
          assert.equal(JSON.parse(result.stdout).journalChainChecks, 6);
        } else {
          assert.notEqual(result.status, 0);
          assert.match(result.stderr, new RegExp(expected));
        }
        assert.deepEqual(directorySnapshot(fixture.root), before);
      } finally {
        rmSync(fixture.root, { recursive: true, force: true });
      }
    });
  }
});

test("exclusive journal creation admits exactly one concurrent creator", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "window002-journal-race-"));
  try {
    const target = path.join(root, "next-record.json");
    const program = [
      'const fs = require("node:fs");',
      "try {",
      '  const fd = fs.openSync(process.argv[1], "wx", 0o600);',
      '  fs.writeFileSync(fd, process.argv[2], "utf8");',
      "  fs.fsyncSync(fd); fs.closeSync(fd); process.exit(0);",
      '} catch (error) { process.exit(error.code === "EEXIST" ? 17 : 18); }',
    ].join("\n");
    const run = (marker) =>
      new Promise((resolve) => {
        const child = spawn(process.execPath, ["-e", program, target, marker], {
          stdio: "ignore",
          windowsHide: true,
        });
        child.once("exit", (code) => resolve(code));
      });
    const results = await Promise.all([run("creator-a"), run("creator-b")]);
    assert.deepEqual(results.toSorted((a, b) => a - b), [0, 17]);
    assert.match(readFileSync(target, "utf8"), /^creator-[ab]$/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("ContractTest makes RUNNING unreachable when provider aliases move", async (t) => {
  await t.test("stable final provider truth passes read-only", () => {
    const fixture = prepareFixture();
    try {
      const probePath = prepareProviderProbe(fixture);
      const before = directorySnapshot(fixture.root);
      const result = invoke(fixture, ["-ContractProviderReconciliationPath", probePath]);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(JSON.parse(result.stdout).providerContinuityChecks, 1);
      assert.deepEqual(directorySnapshot(fixture.root), before);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });
  await t.test("public alias moves between reconciliations", () => {
    const fixture = prepareFixture();
    try {
      const probePath = prepareProviderProbe(fixture, (probe) => {
        probe.final.aliasMappings.publicAliasDeploymentId = "dpl_MovedElsewhere";
      });
      const before = directorySnapshot(fixture.root);
      const result = invoke(fixture, ["-ContractProviderReconciliationPath", probePath]);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /provider reconciliation evidence is not exact|Provider aliases/);
      assert.doesNotMatch(result.stdout, /PUBLIC_PROBE_WINDOW_RUNNING|"result":"PASS"/);
      assert.deepEqual(directorySnapshot(fixture.root), before);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });
});

test("credential reflection is rejected in memory before evidence creation", async (t) => {
  const quotedAdmin = 'contract-admin-"quoted"\\segment-0001';
  const bypass = "contract-protection-bypass-00000001";
  const simpleAdmin = "contract-admin-secret-0000000001";
  for (const [name, configure, shouldPass] of [
    ["safe nested JSON", () => ({ body: JSON.stringify({ ok: true, nested: ["safe"] }), adminKey: simpleAdmin, bypass }), true],
    ["direct nested value", () => ({ body: JSON.stringify({ nested: { value: `prefix-${simpleAdmin}-suffix` } }), adminKey: simpleAdmin, bypass }), false],
    ["decoded object key", () => ({ body: JSON.stringify({ [`prefix-${simpleAdmin}-suffix`]: true }), adminKey: simpleAdmin, bypass }), false],
    ["quote and backslash escaped value", () => ({ body: JSON.stringify({ nested: quotedAdmin }), adminKey: quotedAdmin, bypass }), false],
    ["unicode-escaped decoded value", () => ({ body: `{"nested":"\\u0063${simpleAdmin.slice(1)}"}`, adminKey: simpleAdmin, bypass }), false],
    ["double-encoded JSON Unicode value", () => ({
      body: JSON.stringify({ nested: JSON.stringify({
        deeper: [...simpleAdmin]
          .map((character) => `\\u${character.codePointAt(0).toString(16).padStart(4, "0")}`)
          .join(""),
      }) }),
      adminKey: simpleAdmin,
      bypass,
    }), false],
    ["provider body reflection", () => ({ providerBody: JSON.stringify({ nested: bypass }), adminKey: simpleAdmin, bypass }), false],
    ["provider token base64 reflection", () => ({
      providerBody: JSON.stringify({ token: Buffer.from(providerToken, "utf8").toString("base64") }),
      adminKey: simpleAdmin,
      bypass,
    }), false],
    ["provider identity reflection", () => ({ body: "{\"ok\":true}", adminKey: simpleAdmin, bypass, providerIdentity: `iad1::${bypass}` }), false],
    ["CLI escaped reflection", () => ({ body: "{\"ok\":true}", adminKey: quotedAdmin, bypass, cliStdout: JSON.stringify(quotedAdmin) }), false],
    ["CLI bypass hex reflection", () => ({ body: "{\"ok\":true}", adminKey: simpleAdmin, bypass, cliStderr: Buffer.from(bypass).toString("hex") }), false],
    ["invalid UTF-8 service body", () => ({ bodyBytes: Buffer.from([0xc3, 0x28]), adminKey: simpleAdmin, bypass }), false, /strict UTF-8/],
  ]) {
    await t.test(name, () => {
      const fixture = prepareFixture();
      try {
        const probePath = prepareCredentialProbe(fixture, configure());
        const before = directorySnapshot(fixture.root);
        const result = invoke(fixture, ["-ContractCredentialProbePath", probePath]);
        if (shouldPass) {
          assert.equal(result.status, 0, result.stderr);
          assert.equal(JSON.parse(result.stdout).credentialReflectionChecks, 1);
        } else {
          assert.notEqual(result.status, 0);
          assert.match(result.stderr, /reflected a supplied credential|decoded to a supplied credential|strict UTF-8/);
        }
        assert.deepEqual(directorySnapshot(fixture.root), before);
      } finally {
        rmSync(fixture.root, { recursive: true, force: true });
      }
    });
  }
});

test("credential scanner rejects reversible encodings across every evidence surface", async (t) => {
  const secret = 'contract-"matrix"\\&?/=+0001';
  const bypass = "contract-matrix-bypass-00000001";
  const surfaces = ["service", "provider", "x-vercel-id", "cli-stdout", "cli-stderr"];
  const representations = encodedCredentialRepresentations(secret);
  for (let index = 0; index < representations.length; index += 1) {
    const [encoding, reflected] = representations[index];
    const surface = surfaces[index % surfaces.length];
    await t.test(`${encoding} in ${surface}`, () => {
      const fixture = prepareFixture();
      try {
        const options = { adminKey: secret, bypass };
        if (surface === "service") options.body = JSON.stringify({ reflected });
        if (surface === "provider") options.providerBody = JSON.stringify({ reflected });
        if (surface === "x-vercel-id") options.providerIdentity = `iad1::${reflected}`;
        if (surface === "cli-stdout") options.cliStdout = reflected;
        if (surface === "cli-stderr") options.cliStderr = reflected;
        const probePath = prepareCredentialProbe(fixture, options);
        const before = directorySnapshot(fixture.root);
        const result = invoke(fixture, ["-ContractCredentialProbePath", probePath]);
        assert.notEqual(result.status, 0, `${encoding} reflection unexpectedly passed`);
        assert.match(result.stderr, /reflected a supplied credential|decoded to a supplied credential/);
        assert.doesNotMatch(result.stdout, /PUBLIC_PROBE_WINDOW_RUNNING|"result":"PASS"/);
        assert.deepEqual(directorySnapshot(fixture.root), before);
      } finally {
        rmSync(fixture.root, { recursive: true, force: true });
      }
    });
  }
});

test("ContractTest path probe rejects out-of-root and reparse traversal", async (t) => {
  await t.test("out-of-root", () => {
    const fixture = prepareFixture();
    try {
      const result = invoke(fixture, [
        "-ContractPathProbePath",
        fixture.stagePath,
        "-ContractPathProbeRoot",
        fixture.evidenceDirectory,
      ]);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /outside its pinned root/);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });
  await t.test("reparse traversal", () => {
    const fixture = prepareFixture();
    try {
      const target = path.join(fixture.root, "probe-target");
      const link = path.join(fixture.root, "probe-link");
      mkdirSync(target);
      writeFileSync(path.join(target, "item.json"), jsonBytes({ ok: true }));
      symlinkSync(target, link, process.platform === "win32" ? "junction" : "dir");
      const result = invoke(fixture, [
        "-ContractPathProbePath",
        path.join(link, "item.json"),
        "-ContractPathProbeRoot",
        fixture.root,
      ]);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /traverses a reparse point/);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });
});

test("source preserves the sealed one-shot machinery and v2 receipt field contract", () => {
  const source = readFileSync(script, "utf8");
  assert.match(source, /Global\\OriginG2Window002Promotion/);
  assert.match(source, /window002-promotion-v2-pending\.json/);
  assert.match(source, /FileMode\]::CreateNew/);
  assert.match(source, /New-V2InitialPendingMarkerExclusive/);
  assert.match(source, /New-V2JournalRecordExclusive/);
  assert.match(source, /window002-promotion-v2-journal-005-final-provider-verified\.json/);
  assert.match(source, /StructuralEqualityComparer/);
  assert.match(source, /ContractJournalManifestPath/);
  assert.match(source, /ContractPathProbePath/);
  assert.match(source, /ContractLiveGateProbePath/);
  assert.match(source, /Invoke-SinglePromotionCli -Token/);
  assert.match(source, /one_exact_guarded_promote_post_no_redirect_no_rebuild_no_retry/);
  assert.match(source, /Get-ProviderPromotionResult/);
  assert.match(source, /normalAuthSha256Before/);
  assert.match(source, /schemaVersion = 'origin\.window002\.promotion-receipt\.v2'/);
  assert.match(source, /initialActiveRunEventCount = 0/);
  assert.match(source, /initialLedgerEventCount = 37/);
  assert.doesNotMatch(source, /initialEventCount\s*=/);
  assert.match(source, /76b3c3d6ce64f02ecaa6ee36f0f6800d2fd8bf9e17c12c973197700de9affede/);
  assert.match(source, /ContractTest[\s\S]*providerWrites = 0[\s\S]*filesystemWrites = 0/);
  assert.match(source, /baselineCaptureProtectedV2Tool/);
  assert.match(source, /baselineCaptureProtectedV2Test/);
  assert.match(source, /StageCopy\.Path/);
  assert.match(source, /ProviderLookup\.Path/);
  assert.match(source, /prePromotionImmediateGate/);
  assert.match(source, /postPromotionAuthoritativeGate/);
  assert.match(source, /providerFinalizationReconciliation/);
  assert.match(source, /INTEGRITY_WITHDRAWAL_REQUIRED_UNTIL_AUTHORITATIVE_GATE_PASSES/);
  assert.match(source, /deployment_protection_blocks_public_pre_promotion_traffic/);
  assert.match(source, /maximum UTC bracket/);
  assert.match(source, /maximumBracketSeconds = \$maxImmediateGateSeconds/);
  assert.match(source, /foreach \(\$protectedEvidence in/);
  assert.match(source, /A protected baseline evidence file/);
  assert.match(source, /A final protected live measurement evidence file/);
  assert.match(source, /The final protected promotion runtime directory/);
  assert.match(
    source,
    /PROMOTED_RECONCILED_AUTHORITATIVE_GATE_PASSED_FINAL_RECONCILIATION_VERIFIED_PASS_PENDING/,
  );
  assert.match(source, /Read-V2BoundedSecretLines/);
  assert.match(source, /x-vercel-protection-bypass/);
  assert.match(source, /deploymentProtectionPresented = \(\$Phase -ceq 'pre_promotion'\)/);
  assert.match(source, /live-gate provider identity reflected a supplied credential/);
  assert.match(source, /promotion CLI output reflected a supplied credential/);
  assert.match(source, /Get-V2CredentialRepresentations/);
  assert.match(source, /retainedHistoryExportRawSha256/);
  assert.match(source, /acceptedReductionPinsApplied/);
  assert.match(source, /Assert-V2JsonBoolean/);
  assert.match(source, /Get-V2JsonInteger/);
  assert.match(source, /Assert-V2ProviderReconciliationContinuity/);
  assert.match(source, /https:\/\/\$publicProductionAliasHost/);
  assert.match(source, /window002-runtime/);
  assert.match(source, /\[Diagnostics\.ProcessStartInfo\]::new\(\)/);
  assert.match(source, /\.ArgumentList\.Add\(\$argument\)/);
  assert.match(source, /UseShellExecute = \$false/);
  assert.match(source, /RedirectStandardInput = \$true/);
  assert.match(source, /Environment\.Clear\(\)/);
  assert.match(source, /Environment\['SystemRoot'\] = 'C:\\Windows'/);
  assert.match(source, /Environment\['WINDIR'\] = 'C:\\Windows'/);
  assert.match(source, /StandardInput\.Close\(\)/);
  assert.match(source, /BaseStream\.ReadAsync/);
  assert.match(source, /process\.Kill\(\$true\)/);
  assert.doesNotMatch(source, /& \$NodeExecutable/);
  assert.doesNotMatch(source, /Update-V2PendingMarkerChecked|ExpectedCurrentSha256/);
  assert.doesNotMatch(source, /Move-FileWriteThrough|-Replace/);
  assert.doesNotMatch(source, /C:\\dev\\[A-Za-z0-9._-]+\\scripts\\origin-g2-window002/);
  assert.match(
    source,
    /ReadAllBytes\(\$legacyItem\.FullName\)[\s\S]*Get-BootstrapBytesSha256 -Bytes \$legacyBytes[\s\S]*Parser\]::ParseInput/,
  );
  assert.doesNotMatch(source, /Parser\]::ParseFile/);
  const realFlow = source.slice(source.indexOf("$postGate = Invoke-V2LiveTwoReadGate"));
  const publicGate = realFlow.indexOf("$postGate = Invoke-V2LiveTwoReadGate");
  const finalProvider = realFlow.indexOf("$providerFinal = Get-ProviderPromotionResult");
  const terminalRecord = realFlow.indexOf("-Sequence 5");
  const running = realFlow.indexOf("'PUBLIC_PROBE_WINDOW_RUNNING'");
  const passAnchor = realFlow.indexOf("Write-V2ProtectedJsonExclusive -LiteralPath $promotionPassPath");
  assert.ok(publicGate >= 0 && publicGate < finalProvider);
  assert.ok(finalProvider < terminalRecord && terminalRecord < running && running < passAnchor);
});
