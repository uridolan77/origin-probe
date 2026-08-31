#!/usr/bin/env node

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isDeepStrictEqual, TextDecoder } from "node:util";

import {
  ACTIVE_RUN_ID,
  ALLOWED_SERVICE_RUN_IDS,
  PRE_ROTATION_SERVICE_RUN_ID,
} from "./window002-historical-projection.mjs";

export { ALLOWED_SERVICE_RUN_IDS, PRE_ROTATION_SERVICE_RUN_ID };

export const CAPTURE_SCHEMA_VERSION = "origin.window002.baseline-capture.v2";
export const CAPTURE_CONTRACT_VERSION =
  "origin.window002.baseline-capture.contract.v1";
export const CAPTURE_TOOL_PATH =
  "measurement/scripts/window002-baseline-capture-v2.mjs";
export const CAPTURE_RECEIPT_FILENAME =
  "window002-baseline-capture-v2.json";
export const PROTECTED_WRAPPER_PATH =
  "measurement/scripts/window002-baseline-capture-protected-v2.ps1";
export const PROTECTED_INPUT_SCHEMA_VERSION =
  "origin.window002.baseline-capture-protected-input.v1";
export const PROTECTED_PROVENANCE_SCHEMA_VERSION =
  "origin.window002.baseline-capture-provenance.v1";
export const TRUST_MODEL =
  "trusted_operator_tls_capture_plus_read_only_provider_lookup_not_a_signature";
export const PROVIDER_LOOKUP_FILENAME =
  "vercel-deployment-lookup.json";
export const OUTPUT_DIRECTORY_GUARD_FILENAME =
  ".origin-window002-capture-directory.lock";
const OUTPUT_DIRECTORY_GUARD_BYTES = Buffer.from(
  "origin-window002-capture-directory-identity-guard-v1",
  "utf8",
);
export const CAPTURE_SEQUENCE = Object.freeze([
  "read1_export_all",
  "read1_bounded_reduction",
  "read2_export_all",
  "read2_bounded_reduction",
]);
export const CAPTURE_BODY_FILENAMES = Object.freeze([
  "read-1-export-all.json",
  "read-1-bounded-reduction.json",
  "read-2-export-all.json",
  "read-2-bounded-reduction.json",
]);
export const PUBLIC_SERVICE_URL =
  "https://origin-probe-measure.vercel.app";
export const PRE_ROTATION_SOURCE_ARGUMENT =
  "pre-rotation-public-alias";
export const STAGED_RECEIPT_SCHEMA_VERSION =
  "origin.window002.staged-deployment-receipt.v1";
export const STAGED_RECEIPT_FILENAME =
  "staged-deployment-receipt.json";
export const VERCEL_PROJECT_ID =
  "prj_BGVULzAdg0iZSZPUwdUdVO0RO0cY";
export const VERCEL_ORG_ID =
  "team_OD1jaVJioNw3IjsSJdp5fMwB";
export const VERCEL_SCOPE = "uridolan77s-projects";
export const ACCEPTED_DEPLOYMENT_ID =
  "dpl_FzYtRPK5oxnoG4TJnjNxEYrcZbs7";
export const PROTECTED_STORE_PATH =
  "C:\\Users\\urido\\OriginProbeOperator";
export const STAGE_PASS_PATH =
  `${PROTECTED_STORE_PATH}\\window002-stage-pass.json`;
export const PHASES = Object.freeze({
  pre_rotation: Object.freeze({
    serviceActiveRunId: PRE_ROTATION_SERVICE_RUN_ID,
    outputDirectoryName: "window002-baseline-supersession-pre-rotation",
  }),
  staged: Object.freeze({
    serviceActiveRunId: ACTIVE_RUN_ID,
    outputDirectoryName: "window002-baseline-supersession",
  }),
});
const WINDOW_DURATION_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_BODY_BYTES = 5 * 1024 * 1024;
const MAX_PROTECTED_INPUT_BYTES = 64 * 1024;
const MAX_STAGE_RECEIPT_BYTES = 1024 * 1024;
export const REQUEST_TIMEOUT_MS = 15_000;
const utf8 = new TextDecoder("utf-8", { fatal: true });
const PUBLIC_SERVICE_HOST = new URL(PUBLIC_SERVICE_URL).hostname;
const UNIQUE_DEPLOYMENT_HOST =
  /^origin-probe-measure-[a-z0-9]+-uridolan77s-projects\.vercel\.app$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const STAGE_TOP_LEVEL_KEYS = Object.freeze([
  "acceptedDeploymentId",
  "archiveTarBytes",
  "archiveTarSha256",
  "attemptId",
  "cliExitCode",
  "cliStderrSha256",
  "cliStdoutSha256",
  "cliTimedOut",
  "completedAtUtc",
  "createdAtUtc",
  "deployFileCountBefore",
  "deployManifestSha256After",
  "deployManifestSha256Before",
  "executionReadLockCount",
  "expectedMeasurementConfigFingerprint",
  "localUtcAfterCli",
  "localUtcBeforeCli",
  "nodeSha256",
  "nodeVersion",
  "noRetryPreloadSha256",
  "normalAuthSha256After",
  "normalAuthSha256Before",
  "orgId",
  "productionAliasesRemainOnAcceptedDeployment",
  "projectId",
  "projectNodeVersion",
  "providerBaseline",
  "providerBearerExpiresAtEpochSeconds",
  "providerCredentialMode",
  "providerExecutionConfigSha256",
  "providerReconciliation",
  "providerWriteRetryPolicy",
  "providerWriteState",
  "repairedCommit",
  "repairedMeasurementTree",
  "result",
  "rotationAttemptId",
  "rotationReceiptSha256",
  "runId",
  "schemaVersion",
  "scope",
  "scratchFileCountAfter",
  "scratchFileCountBefore",
  "scratchItemCountAfter",
  "scratchItemCountBefore",
  "scratchManifestSha256After",
  "scratchManifestSha256Before",
  "scratchTotalBytesAfter",
  "secretSetFingerprint",
  "stagedDeployment",
  "updatedAtUtc",
  "vercelCliVersion",
  "vercelTreeManifestSha256",
  "wrapperSha256After",
  "wrapperSha256Before",
]);
const STAGE_DIGEST_FIELDS = Object.freeze([
  "archiveTarSha256",
  "deployManifestSha256After",
  "deployManifestSha256Before",
  "expectedMeasurementConfigFingerprint",
  "nodeSha256",
  "noRetryPreloadSha256",
  "normalAuthSha256After",
  "normalAuthSha256Before",
  "providerExecutionConfigSha256",
  "rotationReceiptSha256",
  "scratchManifestSha256After",
  "scratchManifestSha256Before",
  "secretSetFingerprint",
  "vercelTreeManifestSha256",
  "wrapperSha256After",
  "wrapperSha256Before",
  "cliStdoutSha256",
  "cliStderrSha256",
]);
const FORBIDDEN_SECRET_KEY =
  /"(?:adminKey|clientSalt|hmacSecret|originCid|protectionBypass|providerToken|refreshToken|token|password)"\s*:/i;

const CONTRACT = Object.freeze({
  version: CAPTURE_CONTRACT_VERSION,
  method: "GET",
  sequence: CAPTURE_SEQUENCE,
  authenticationHeader: "x-admin-key",
  authenticationSource: "stdin_only",
  providerIdentityHeader: "x-vercel-id",
  rawBodyPreservation: "exact_response_bytes",
  outputCreation: "protected_wrapper_precreated_empty_fixed_directory",
  requestTimeoutMs: REQUEST_TIMEOUT_MS,
});

function fail(code) {
  throw new Error(code);
}

export function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function exactKeys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return (
    keys.length === sortedExpected.length &&
    keys.every((key, index) => key === sortedExpected[index])
  );
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

export function canonicalJsonSha256(value) {
  return sha256(Buffer.from(JSON.stringify(canonicalize(value)), "utf8"));
}

function parseJsonBody(rawBytes, code) {
  if (!Buffer.isBuffer(rawBytes)) fail(`${code}_must_be_raw_bytes`);
  try {
    return JSON.parse(utf8.decode(rawBytes));
  } catch {
    fail(`invalid_${code}_json`);
  }
}

export function canonicalMillisecondUtc(value, code = "noncanonical_utc") {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  ) {
    fail(code);
  }
  const milliseconds = Date.parse(value);
  if (
    !Number.isFinite(milliseconds) ||
    new Date(milliseconds).toISOString() !== value
  ) {
    fail(code);
  }
  return milliseconds;
}

export function normalizeUniqueUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    fail("invalid_unique_url");
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.port !== "" ||
    (parsed.pathname !== "" && parsed.pathname !== "/") ||
    parsed.search !== "" ||
    parsed.hash !== "" ||
    (parsed.hostname !== PUBLIC_SERVICE_HOST &&
      !UNIQUE_DEPLOYMENT_HOST.test(parsed.hostname)) ||
    (value !== parsed.origin && value !== `${parsed.origin}/`)
  ) {
    fail("invalid_unique_url");
  }
  return parsed.origin;
}

export function validateStagedDeploymentReceiptBytes(rawBytes) {
  if (
    !Buffer.isBuffer(rawBytes) ||
    rawBytes.length === 0 ||
    rawBytes.length > MAX_STAGE_RECEIPT_BYTES
  ) {
    fail("invalid_staged_deployment_receipt_size");
  }
  const receiptSha256 = sha256(rawBytes);
  const rawText = utf8.decode(rawBytes);
  if (FORBIDDEN_SECRET_KEY.test(rawText)) {
    fail("staged_deployment_receipt_contains_secret_key");
  }
  const receipt = parseJsonBody(rawBytes, "staged_deployment_receipt");
  const staged = receipt?.stagedDeployment;
  const baseline = receipt?.providerBaseline;
  const reconciliation = receipt?.providerReconciliation;
  if (
    !exactKeys(receipt, STAGE_TOP_LEVEL_KEYS) ||
    receipt?.schemaVersion !== STAGED_RECEIPT_SCHEMA_VERSION ||
    receipt?.result !== "PASS" ||
    receipt?.runId !== ACTIVE_RUN_ID ||
    receipt?.projectId !== VERCEL_PROJECT_ID ||
    receipt?.orgId !== VERCEL_ORG_ID ||
    receipt?.scope !== VERCEL_SCOPE ||
    receipt?.providerWriteState !== "STAGED_READY_NOT_PROMOTED" ||
    receipt?.providerWriteRetryPolicy !==
      "single_cli_invocation_one_discovery_post_one_upload_per_declared_missing_digest_one_identical_continuation_no_automatic_mutation_retry" ||
    receipt?.productionAliasesRemainOnAcceptedDeployment !== true ||
    receipt?.repairedCommit !== "2e4f33c334f5eb07204d6a69481b5c85fe15e45a" ||
    receipt?.repairedMeasurementTree !==
      "76218da5886b022ec7d7310dfc6c79f00228a17e" ||
    receipt?.archiveTarSha256 !==
      "926f9468c5faa5991f113f86bd0d852602dd46af75c43de77d0efa114154b556" ||
    receipt?.archiveTarBytes !== 184320 ||
    receipt?.deployManifestSha256Before !==
      "cdd30fe6a9f18c7136a882d903302282f35e6ec5b273f247f45b0fdc9d0ebda7" ||
    receipt?.deployManifestSha256After !==
      receipt?.deployManifestSha256Before ||
    receipt?.deployFileCountBefore !== 26 ||
    receipt?.nodeVersion !== "v22.14.0" ||
    receipt?.nodeSha256 !==
      "33b1bc1a8aca11fd5a4f2699e51019c63c0af30cf437701d07af69be7706771b" ||
    receipt?.vercelCliVersion !== "57.0.0" ||
    receipt?.vercelTreeManifestSha256 !==
      "21545361d00941da2994447db68cbd5c5ddc2899a326974996fe05210e80b994" ||
    receipt?.noRetryPreloadSha256 !==
      "d8ac99ea2805cd00e11e28270083192b8a5389e4142695b7c49a0fd6c04de2fe" ||
    receipt?.providerCredentialMode !==
      "VERCEL_TOKEN_child_environment_skip_write" ||
    receipt?.providerExecutionConfigSha256 !==
      "889e23d72f6500793b541d7dace3cb13a8e8cddb0d0cba4babc60841f14fdf96" ||
    receipt?.projectNodeVersion !== "24.x" ||
    receipt?.acceptedDeploymentId !== ACCEPTED_DEPLOYMENT_ID ||
    receipt?.cliTimedOut !== false ||
    receipt?.cliExitCode !== 0 ||
    !Number.isSafeInteger(receipt?.archiveTarBytes) ||
    !Number.isSafeInteger(receipt?.deployFileCountBefore) ||
    !Number.isSafeInteger(receipt?.executionReadLockCount) ||
    receipt.executionReadLockCount <= 0 ||
    !Number.isSafeInteger(receipt?.providerBearerExpiresAtEpochSeconds) ||
    receipt.providerBearerExpiresAtEpochSeconds <= 0 ||
    !Number.isSafeInteger(receipt?.scratchItemCountBefore) ||
    !Number.isSafeInteger(receipt?.scratchFileCountBefore) ||
    !Number.isSafeInteger(receipt?.scratchItemCountAfter) ||
    !Number.isSafeInteger(receipt?.scratchFileCountAfter) ||
    !Number.isSafeInteger(receipt?.scratchTotalBytesAfter) ||
    !/^[0-9a-f]{40}$/.test(receipt?.repairedCommit || "") ||
    !/^[0-9a-f]{40}$/.test(receipt?.repairedMeasurementTree || "") ||
    !/^[0-9a-f-]{36}$/.test(receipt?.attemptId || "") ||
    !/^[0-9a-f-]{36}$/.test(receipt?.rotationAttemptId || "") ||
    !exactKeys(baseline, [
      "acceptedAliasesRawSha256",
      "acceptedDeploymentRawSha256",
      "aliasRawSha256",
      "domainRawSha256",
      "projectRawSha256",
    ]) ||
    !exactKeys(reconciliation, [
      "candidateAliasAssignedAtEpochMs",
      "candidateAliasAssignedSemantics",
      "candidateAliasSetRawSha256",
      "candidateCreatedAtEpochMs",
      "candidateDeploymentRawBytes",
      "candidateDeploymentRawSha256",
      "postStageAcceptedAliasesRawSha256",
      "postStageAcceptedDeploymentRawSha256",
      "postStageDomainRawSha256",
      "postStageProjectRawSha256",
    ]) ||
    !staged ||
    typeof staged !== "object" ||
    Array.isArray(staged) ||
    !/^dpl_[A-Za-z0-9]+$/.test(staged.id || "") ||
    staged.target !== "production" ||
    staged.readyState !== "READY" ||
    staged.readySubstate !== "STAGED" ||
    !exactKeys(staged, [
      "id",
      "inspectorUrl",
      "readyState",
      "readySubstate",
      "target",
      "uniqueUrl",
    ])
  ) {
    fail("invalid_staged_deployment_receipt");
  }
  for (const field of STAGE_DIGEST_FIELDS) {
    if (!SHA256_PATTERN.test(receipt[field] || "")) {
      fail("invalid_staged_deployment_receipt_digest");
    }
  }
  for (const field of [
    "acceptedAliasesRawSha256",
    "acceptedDeploymentRawSha256",
    "domainRawSha256",
    "projectRawSha256",
  ]) {
    if (!SHA256_PATTERN.test(baseline[field] || "")) {
      fail("invalid_staged_deployment_receipt_digest");
    }
  }
  if (
    !exactKeys(baseline.aliasRawSha256, [
      "origin-probe-measure-uridolan77s-projects.vercel.app",
      "origin-probe-measure.vercel.app",
    ]) ||
    Object.values(baseline.aliasRawSha256).some(
      (value) => !SHA256_PATTERN.test(value || ""),
    )
  ) {
    fail("invalid_staged_deployment_receipt_alias_digests");
  }
  for (const field of [
    "candidateAliasSetRawSha256",
    "candidateDeploymentRawSha256",
    "postStageAcceptedAliasesRawSha256",
    "postStageAcceptedDeploymentRawSha256",
    "postStageDomainRawSha256",
    "postStageProjectRawSha256",
  ]) {
    if (!SHA256_PATTERN.test(reconciliation[field] || "")) {
      fail("invalid_staged_deployment_receipt_digest");
    }
  }
  if (
    !Number.isSafeInteger(reconciliation.candidateAliasAssignedAtEpochMs) ||
    reconciliation.candidateAliasAssignedAtEpochMs <= 0 ||
    !Number.isSafeInteger(reconciliation.candidateCreatedAtEpochMs) ||
    reconciliation.candidateCreatedAtEpochMs <= 0 ||
    !Number.isSafeInteger(reconciliation.candidateDeploymentRawBytes) ||
    reconciliation.candidateDeploymentRawBytes <= 0 ||
    reconciliation.candidateAliasAssignedSemantics !==
      "staged_readiness_signal_not_window_start"
  ) {
    fail("invalid_staged_deployment_receipt_reconciliation");
  }
  const times = [
    "createdAtUtc",
    "localUtcBeforeCli",
    "localUtcAfterCli",
    "completedAtUtc",
    "updatedAtUtc",
  ].map((field) => canonicalMillisecondUtc(receipt[field], `invalid_stage_${field}`));
  if (
    !(times[0] <= times[1] &&
      times[1] <= times[2] &&
      times[2] <= times[3] &&
      times[3] === times[4])
  ) {
    fail("invalid_staged_deployment_receipt_time_order");
  }
  const uniqueUrl = normalizeUniqueUrl(staged.uniqueUrl);
  let inspectorUrl;
  try {
    inspectorUrl = new URL(staged.inspectorUrl);
  } catch {
    fail("invalid_staged_deployment_inspector_url");
  }
  if (
    uniqueUrl === PUBLIC_SERVICE_URL ||
    !UNIQUE_DEPLOYMENT_HOST.test(new URL(uniqueUrl).hostname) ||
    inspectorUrl.protocol !== "https:" ||
    inspectorUrl.hostname !== "vercel.com" ||
    inspectorUrl.username !== "" ||
    inspectorUrl.password !== "" ||
    inspectorUrl.port !== ""
  ) {
    fail("invalid_staged_deployment_unique_url");
  }
  return {
    receipt,
    receiptSha256,
    deploymentId: staged.id,
    uniqueUrl,
    aliasAssignedAtEpochMs:
      reconciliation.candidateAliasAssignedAtEpochMs,
    createdAtEpochMs: reconciliation.candidateCreatedAtEpochMs,
  };
}

function preRotationDeploymentSource() {
  return {
    kind: "pre_rotation_public_alias",
    preRotationSource: "forced_exact_public_alias",
    alias: PUBLIC_SERVICE_URL,
  };
}

function stagedDeploymentSource(validatedStageReceipt) {
  return {
    kind: "staged_deployment_receipt",
    stageReceipt: {
      path: STAGED_RECEIPT_FILENAME,
      sha256: validatedStageReceipt.receiptSha256,
    },
    deploymentId: validatedStageReceipt.deploymentId,
    uniqueUrl: validatedStageReceipt.uniqueUrl,
    projectId: VERCEL_PROJECT_ID,
    orgId: VERCEL_ORG_ID,
    scope: VERCEL_SCOPE,
  };
}

function safeArtifactPin(pin, expectedPath, code) {
  if (
    !exactKeys(pin, ["path", "sha256"]) ||
    pin.path !== expectedPath ||
    !SHA256_PATTERN.test(pin.sha256 || "")
  ) {
    fail(code);
  }
}

function canonicalPhase(value) {
  if (!Object.hasOwn(PHASES, value)) fail("invalid_capture_phase");
  return value;
}

function validateProviderDeployment(value, validatedStage, exact = false) {
  if (
    (exact &&
      !exactKeys(value, [
        "aliasAssignedAtEpochMs",
        "createdAtEpochMs",
        "id",
        "ownerId",
        "projectId",
        "readyState",
        "readySubstate",
        "target",
        "url",
      ])) ||
    value.id !== validatedStage.deploymentId ||
    value.projectId !== VERCEL_PROJECT_ID ||
    value.ownerId !== VERCEL_ORG_ID ||
    value.url !== new URL(validatedStage.uniqueUrl).hostname ||
    value.target !== "production" ||
    value.readyState !== "READY" ||
    value.readySubstate !== "STAGED" ||
    value.aliasAssignedAtEpochMs !== validatedStage.aliasAssignedAtEpochMs ||
    value.createdAtEpochMs !== validatedStage.createdAtEpochMs
  ) {
    fail("provider_lookup_deployment_mismatch");
  }
}

function providerDeploymentProjection(value) {
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

export function validateProtectedProvenance(
  provenance,
  {
    phase,
    wrapperSha256,
    validatedStage = null,
    providerLookupBytes = null,
  },
) {
  const selectedPhase = canonicalPhase(phase);
  if (
    !exactKeys(provenance, [
      "deploymentProtectionFingerprintSha256",
      "fixedPaths",
      "phase",
      "providerLookup",
      "schemaVersion",
      "trustModel",
      "windowsProtection",
      "wrapper",
    ]) ||
    provenance.schemaVersion !== PROTECTED_PROVENANCE_SCHEMA_VERSION ||
    provenance.trustModel !== TRUST_MODEL ||
    provenance.phase !== selectedPhase ||
    (selectedPhase === "staged"
      ? !SHA256_PATTERN.test(
          provenance.deploymentProtectionFingerprintSha256 || "",
        )
      : provenance.deploymentProtectionFingerprintSha256 !== null)
  ) {
    fail("invalid_protected_capture_provenance");
  }
  safeArtifactPin(
    provenance.wrapper,
    PROTECTED_WRAPPER_PATH,
    "invalid_protected_wrapper_pin",
  );
  if (provenance.wrapper.sha256 !== wrapperSha256) {
    fail("protected_wrapper_digest_mismatch");
  }
  if (
    !exactKeys(provenance.windowsProtection, [
      "daclVerified",
      "ownerVerified",
      "readLocksHeld",
      "reparseFree",
    ]) ||
    Object.values(provenance.windowsProtection).some((value) => value !== true)
  ) {
    fail("invalid_windows_protection_provenance");
  }
  if (
    !exactKeys(provenance.fixedPaths, [
      "outputDirectoryName",
      "protectedStore",
      "stagePass",
    ]) ||
    provenance.fixedPaths.protectedStore !== "OriginProbeOperator" ||
    provenance.fixedPaths.outputDirectoryName !==
      PHASES[selectedPhase].outputDirectoryName ||
    provenance.fixedPaths.stagePass !==
      (selectedPhase === "staged" ? "window002-stage-pass.json" : null)
  ) {
    fail("invalid_fixed_path_provenance");
  }
  const lookup = provenance.providerLookup;
  if (selectedPhase === "pre_rotation") {
    if (
      !exactKeys(lookup, ["performed", "providerWrites", "reason"]) ||
      lookup.performed !== false ||
      lookup.providerWrites !== 0 ||
      lookup.reason !== "pre_rotation_exact_public_alias" ||
      validatedStage !== null ||
      providerLookupBytes !== null
    ) {
      fail("invalid_pre_rotation_provider_provenance");
    }
    return provenance;
  }
  if (
    validatedStage === null ||
    !Buffer.isBuffer(providerLookupBytes) ||
    !exactKeys(lookup, [
      "apiOrigin",
      "deployment",
      "method",
      "notAfterUtc",
      "notBeforeUtc",
      "pathAndQuery",
      "performed",
      "providerWrites",
      "rawBody",
    ]) ||
    lookup.performed !== true ||
    lookup.providerWrites !== 0 ||
    lookup.method !== "GET" ||
    lookup.apiOrigin !== "https://api.vercel.com" ||
    lookup.pathAndQuery !==
      `/v13/deployments/${validatedStage.deploymentId}?teamId=${VERCEL_ORG_ID}`
  ) {
    fail("invalid_staged_provider_provenance");
  }
  if (
    !exactKeys(lookup.rawBody, ["byteLength", "path", "sha256"]) ||
    lookup.rawBody.path !== PROVIDER_LOOKUP_FILENAME ||
    !SHA256_PATTERN.test(lookup.rawBody.sha256 || "") ||
    lookup.rawBody.byteLength !== providerLookupBytes.length ||
    lookup.rawBody.sha256 !== sha256(providerLookupBytes) ||
    providerLookupBytes.length === 0 ||
    providerLookupBytes.length > MAX_BODY_BYTES
  ) {
    fail("provider_lookup_raw_body_mismatch");
  }
  const before = canonicalMillisecondUtc(
    lookup.notBeforeUtc,
    "invalid_provider_lookup_not_before_utc",
  );
  const after = canonicalMillisecondUtc(
    lookup.notAfterUtc,
    "invalid_provider_lookup_not_after_utc",
  );
  if (before > after || after - before > 20_000) {
    fail("invalid_provider_lookup_observation_window");
  }
  const providerEnvelope = parseJsonBody(
    providerLookupBytes,
    "provider_lookup_response",
  );
  validateProviderDeployment(
    providerDeploymentProjection(providerEnvelope),
    validatedStage,
    true,
  );
  validateProviderDeployment(lookup.deployment, validatedStage, true);
  if (
    !isDeepStrictEqual(
      providerDeploymentProjection(providerEnvelope),
      lookup.deployment,
    )
  ) {
    fail("provider_lookup_projection_mismatch");
  }
  return provenance;
}

export function validateDeploymentSource(
  deploymentSource,
  serviceActiveRunId,
  uniqueUrl,
) {
  if (serviceActiveRunId === PRE_ROTATION_SERVICE_RUN_ID) {
    const expected = preRotationDeploymentSource();
    if (
      !exactKeys(deploymentSource, ["alias", "kind", "preRotationSource"]) ||
      canonicalJsonSha256(deploymentSource) !== canonicalJsonSha256(expected) ||
      uniqueUrl !== PUBLIC_SERVICE_URL
    ) {
      fail("invalid_pre_rotation_deployment_source");
    }
    return deploymentSource;
  }
  if (
    serviceActiveRunId !== ACTIVE_RUN_ID ||
    !exactKeys(deploymentSource, [
      "deploymentId",
      "kind",
      "orgId",
      "projectId",
      "scope",
      "stageReceipt",
      "uniqueUrl",
    ]) ||
    deploymentSource.kind !== "staged_deployment_receipt" ||
    deploymentSource.projectId !== VERCEL_PROJECT_ID ||
    deploymentSource.orgId !== VERCEL_ORG_ID ||
    deploymentSource.scope !== VERCEL_SCOPE ||
    !/^dpl_[A-Za-z0-9]+$/.test(deploymentSource.deploymentId || "") ||
    normalizeUniqueUrl(deploymentSource.uniqueUrl) !== uniqueUrl ||
    uniqueUrl === PUBLIC_SERVICE_URL
  ) {
    fail("invalid_staged_deployment_source");
  }
  safePin(
    deploymentSource.stageReceipt,
    STAGED_RECEIPT_FILENAME,
    "invalid_staged_deployment_receipt_pin",
  );
  return deploymentSource;
}

function matchingFileIdentity(left, right) {
  return (
    left.isFile() &&
    right.isFile() &&
    left.ino !== 0n &&
    right.ino !== 0n &&
    (left.dev === 0n || right.dev === 0n || left.dev === right.dev) &&
    left.ino === right.ino &&
    left.size === right.size &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs
  );
}

function assertCurrentFilePathIdentity(
  inputPath,
  expectedRealPath,
  expectedStat,
  descriptor,
  code,
) {
  const link = fs.lstatSync(inputPath, { bigint: true });
  const pathStat = fs.statSync(inputPath, { bigint: true });
  const descriptorStat = fs.fstatSync(descriptor, { bigint: true });
  const realPath = fs.realpathSync.native(inputPath);
  if (
    link.isSymbolicLink() ||
    !matchingFileIdentity(link, expectedStat) ||
    !matchingFileIdentity(pathStat, expectedStat) ||
    !matchingFileIdentity(descriptorStat, expectedStat) ||
    realPath !== expectedRealPath
  ) {
    fail(`${code}_identity_changed`);
  }
}

function stableReadFile(inputPath, maximumBytes, code) {
  let descriptor;
  try {
    const beforePath = fs.realpathSync.native(inputPath);
    const link = fs.lstatSync(inputPath, { bigint: true });
    if (link.isSymbolicLink()) fail(`${code}_reparse_or_symlink`);
    descriptor = fs.openSync(inputPath, "r");
    const before = fs.fstatSync(descriptor, { bigint: true });
    if (
      !before.isFile() ||
      before.size <= 0n ||
      before.size > BigInt(maximumBytes)
    ) {
      fail(`${code}_size_invalid`);
    }
    assertCurrentFilePathIdentity(
      inputPath,
      beforePath,
      before,
      descriptor,
      code,
    );
    const bytes = Buffer.alloc(Number(before.size));
    let offset = 0;
    while (offset < bytes.length) {
      const count = fs.readSync(
        descriptor,
        bytes,
        offset,
        bytes.length - offset,
        offset,
      );
      if (count === 0) fail(`${code}_short_read`);
      offset += count;
    }
    assertCurrentFilePathIdentity(
      inputPath,
      beforePath,
      before,
      descriptor,
      code,
    );
    return bytes;
  } catch (error) {
    if (String(error?.message || "").startsWith(code)) throw error;
    fail(`${code}_read_failed`);
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
}

function phasePaths(phase, overrides = {}) {
  const selected = PHASES[canonicalPhase(phase)];
  const storePath = overrides.storePath ?? PROTECTED_STORE_PATH;
  return {
    stagePassPath:
      overrides.stagePassPath ?? path.join(storePath, "window002-stage-pass.json"),
    outputDirectory:
      overrides.outputDirectory ??
      path.join(storePath, selected.outputDirectoryName),
    wrapperPath:
      overrides.wrapperPath ??
      fileURLToPath(
        new URL("./window002-baseline-capture-protected-v2.ps1", import.meta.url),
      ),
  };
}

function preparePhaseInputs(phase, overrides = {}) {
  const selectedPhase = canonicalPhase(phase);
  const paths = phasePaths(selectedPhase, overrides);
  if (selectedPhase === "pre_rotation") {
    return {
      ...paths,
      uniqueUrl: PUBLIC_SERVICE_URL,
      serviceActiveRunId: PRE_ROTATION_SERVICE_RUN_ID,
      deploymentSource: preRotationDeploymentSource(),
      stagedReceiptBytes: null,
      validatedStage: null,
      providerLookupBytes: null,
    };
  }
  const stagedReceiptBytes = stableReadFile(
    paths.stagePassPath,
    MAX_STAGE_RECEIPT_BYTES,
    "staged_deployment_receipt",
  );
  const validatedStage = validateStagedDeploymentReceiptBytes(
    stagedReceiptBytes,
  );
  const providerLookupPath = path.join(
    paths.outputDirectory,
    PROVIDER_LOOKUP_FILENAME,
  );
  const providerLookupBytes = stableReadFile(
    providerLookupPath,
    MAX_BODY_BYTES,
    "provider_lookup",
  );
  return {
    ...paths,
    uniqueUrl: validatedStage.uniqueUrl,
    serviceActiveRunId: ACTIVE_RUN_ID,
    deploymentSource: stagedDeploymentSource(validatedStage),
    stagedReceiptBytes,
    validatedStage,
    providerLookupBytes,
  };
}

export function expectedServiceRunId(value) {
  if (!ALLOWED_SERVICE_RUN_IDS.includes(value)) {
    fail("invalid_expected_service_run_id");
  }
  return value;
}

export function windowIntent(startUtc) {
  const startMs = canonicalMillisecondUtc(startUtc, "noncanonical_start_utc");
  const start = new Date(startMs);
  if (
    start.getUTCMinutes() !== 0 ||
    start.getUTCSeconds() !== 0 ||
    start.getUTCMilliseconds() !== 0
  ) {
    fail("window_start_must_be_whole_hour_utc");
  }
  return {
    startUtc,
    endUtc: new Date(startMs + WINDOW_DURATION_MS).toISOString(),
    days: 14,
    wholeHourUtc: true,
    intervalSemantics: "[startUtc,endUtc)",
  };
}

export function requestUrls(uniqueUrl, intent) {
  const exportUrl = new URL("/v1/export", uniqueUrl);
  exportUrl.searchParams.set("scope", "all");
  const reductionUrl = new URL("/v1/reduce", uniqueUrl);
  reductionUrl.searchParams.set("startUtc", intent.startUtc);
  reductionUrl.searchParams.set("endUtc", intent.endUtc);
  return [
    exportUrl.toString(),
    reductionUrl.toString(),
    exportUrl.toString(),
    reductionUrl.toString(),
  ];
}

function safePin(pin, expectedPath, code) {
  if (
    !exactKeys(pin, ["path", "sha256"]) ||
    pin.path !== expectedPath ||
    !/^[0-9a-f]{64}$/.test(pin.sha256)
  ) {
    fail(code);
  }
}

function providerRequestId(value, code) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 512 ||
    value !== value.trim() ||
    !/^[\x21-\x7e]+$/.test(value)
  ) {
    fail(code);
  }
  return value;
}

function validateExportEnvelope(value, serviceActiveRunId, code) {
  if (
    !exactKeys(value, [
      "activeRunId",
      "events",
      "ledgerSchemaVersion",
      "ok",
      "scope",
    ]) ||
    value.ok !== true ||
    value.scope !== "all" ||
    value.activeRunId !== serviceActiveRunId ||
    value.ledgerSchemaVersion !== "v1" ||
    !Array.isArray(value.events)
  ) {
    fail(code);
  }
}

function validateReductionEnvelope(value, intent, serviceActiveRunId, code) {
  if (
    !exactKeys(value, ["ok", "reduction"]) ||
    value.ok !== true ||
    !value.reduction ||
    typeof value.reduction !== "object" ||
    Array.isArray(value.reduction) ||
    value.reduction.runId !== serviceActiveRunId ||
    value.reduction.window?.startUtc !== intent.startUtc ||
    value.reduction.window?.endUtc !== intent.endUtc ||
    value.reduction.window?.semantics !== "[startUtc,endUtc)"
  ) {
    fail(code);
  }
}

export function withCaptureBinding(receiptWithoutBinding) {
  return {
    ...receiptWithoutBinding,
    captureBindingSha256: canonicalJsonSha256(receiptWithoutBinding),
  };
}

export function buildCaptureReceipt({
  uniqueUrl,
  intent,
  serviceActiveRunId,
  deploymentSource,
  operatorProvenance,
  deploymentProtection,
  captureToolSha256,
  requests,
}) {
  const receipt = withCaptureBinding({
    schemaVersion: CAPTURE_SCHEMA_VERSION,
    result: "PASS",
    targetRunId: ACTIVE_RUN_ID,
    serviceActiveRunId,
    uniqueUrl,
    deploymentSource,
    operatorProvenance,
    deploymentProtection,
    windowIntent: intent,
    captureTool: {
      path: CAPTURE_TOOL_PATH,
      sha256: captureToolSha256,
    },
    contract: CONTRACT,
    authentication: {
      header: "x-admin-key",
      source: "stdin_only",
      acceptedByAdminOnlyEndpoint: true,
      acceptedStatus: 200,
      secretPersisted: false,
      secretLogged: false,
    },
    sequence: CAPTURE_SEQUENCE,
    requests,
  });
  validateCaptureReceipt(receipt, { expectedToolSha256: captureToolSha256 });
  return receipt;
}

export function validateCaptureReceipt(
  receipt,
  { expectedToolSha256 } = {},
) {
  if (
    !exactKeys(receipt, [
      "authentication",
      "captureBindingSha256",
      "captureTool",
      "contract",
      "deploymentSource",
      "deploymentProtection",
      "operatorProvenance",
      "requests",
      "result",
      "schemaVersion",
      "sequence",
      "serviceActiveRunId",
      "targetRunId",
      "uniqueUrl",
      "windowIntent",
    ]) ||
    receipt.schemaVersion !== CAPTURE_SCHEMA_VERSION ||
    receipt.result !== "PASS" ||
    receipt.targetRunId !== ACTIVE_RUN_ID ||
    !/^[0-9a-f]{64}$/.test(receipt.captureBindingSha256 || "")
  ) {
    fail("invalid_capture_receipt");
  }
  const { captureBindingSha256, ...bindingPayload } = receipt;
  if (canonicalJsonSha256(bindingPayload) !== captureBindingSha256) {
    fail("capture_binding_sha256_mismatch");
  }

  const uniqueUrl = normalizeUniqueUrl(receipt.uniqueUrl);
  if (uniqueUrl !== receipt.uniqueUrl) fail("noncanonical_capture_unique_url");
  expectedServiceRunId(receipt.serviceActiveRunId);
  validateDeploymentSource(
    receipt.deploymentSource,
    receipt.serviceActiveRunId,
    uniqueUrl,
  );
  if (
    !exactKeys(receipt.deploymentProtection, [
      "fingerprintSha256",
      "header",
      "presented",
      "secretLogged",
      "secretPersisted",
      "source",
    ]) ||
    receipt.deploymentProtection.header !==
      "x-vercel-protection-bypass" ||
    receipt.deploymentProtection.source !==
      "stdin_only_via_protected_wrapper" ||
    receipt.deploymentProtection.secretLogged !== false ||
    receipt.deploymentProtection.secretPersisted !== false ||
    (receipt.serviceActiveRunId === ACTIVE_RUN_ID
      ? receipt.deploymentProtection.presented !== true ||
        !SHA256_PATTERN.test(
          receipt.deploymentProtection.fingerprintSha256 || "",
        )
      : receipt.deploymentProtection.presented !== false ||
        receipt.deploymentProtection.fingerprintSha256 !== null)
  ) {
    fail("invalid_deployment_protection_contract");
  }
  const phase =
    receipt.serviceActiveRunId === ACTIVE_RUN_ID ? "staged" : "pre_rotation";
  if (
    !receipt.operatorProvenance ||
    receipt.operatorProvenance.schemaVersion !==
      PROTECTED_PROVENANCE_SCHEMA_VERSION ||
    receipt.operatorProvenance.trustModel !== TRUST_MODEL ||
    receipt.operatorProvenance.phase !== phase ||
    receipt.operatorProvenance.deploymentProtectionFingerprintSha256 !==
      receipt.deploymentProtection.fingerprintSha256
  ) {
    fail("invalid_operator_provenance_binding");
  }
  const expectedIntent = windowIntent(receipt.windowIntent?.startUtc);
  if (
    !exactKeys(receipt.windowIntent, [
      "days",
      "endUtc",
      "intervalSemantics",
      "startUtc",
      "wholeHourUtc",
    ]) ||
    canonicalJsonSha256(receipt.windowIntent) !==
      canonicalJsonSha256(expectedIntent)
  ) {
    fail("invalid_capture_window_intent");
  }

  if (
    !exactKeys(receipt.captureTool, ["path", "sha256"]) ||
    receipt.captureTool.path !== CAPTURE_TOOL_PATH ||
    !/^[0-9a-f]{64}$/.test(receipt.captureTool.sha256 || "") ||
    (expectedToolSha256 !== undefined &&
      receipt.captureTool.sha256 !== expectedToolSha256)
  ) {
    fail("capture_tool_digest_mismatch");
  }
  if (
    !exactKeys(receipt.contract, [
      "authenticationHeader",
      "authenticationSource",
      "method",
      "outputCreation",
      "providerIdentityHeader",
      "rawBodyPreservation",
      "requestTimeoutMs",
      "sequence",
      "version",
    ]) ||
    canonicalJsonSha256(receipt.contract) !== canonicalJsonSha256(CONTRACT)
  ) {
    fail("capture_contract_mismatch");
  }
  if (
    !exactKeys(receipt.authentication, [
      "acceptedByAdminOnlyEndpoint",
      "acceptedStatus",
      "header",
      "secretLogged",
      "secretPersisted",
      "source",
    ]) ||
    receipt.authentication.header !== "x-admin-key" ||
    receipt.authentication.source !== "stdin_only" ||
    receipt.authentication.acceptedByAdminOnlyEndpoint !== true ||
    receipt.authentication.acceptedStatus !== 200 ||
    receipt.authentication.secretPersisted !== false ||
    receipt.authentication.secretLogged !== false
  ) {
    fail("capture_authentication_contract_mismatch");
  }
  if (
    !Array.isArray(receipt.sequence) ||
    JSON.stringify(receipt.sequence) !== JSON.stringify(CAPTURE_SEQUENCE) ||
    !Array.isArray(receipt.requests) ||
    receipt.requests.length !== CAPTURE_SEQUENCE.length
  ) {
    fail("capture_sequence_mismatch");
  }

  const expectedUrls = requestUrls(uniqueUrl, expectedIntent);
  const providerIds = new Set();
  let previousObservedMs = -Infinity;
  for (let index = 0; index < receipt.requests.length; index += 1) {
    const request = receipt.requests[index];
    if (
      !exactKeys(request, [
        "kind",
        "method",
        "observedAtUtc",
        "rawBody",
        "sequence",
        "status",
        "url",
        "xVercelId",
      ]) ||
      request.sequence !== index + 1 ||
      request.kind !== CAPTURE_SEQUENCE[index] ||
      request.method !== "GET" ||
      request.url !== expectedUrls[index] ||
      request.status !== 200
    ) {
      fail("capture_request_sequence_mismatch");
    }
    const observedMs = canonicalMillisecondUtc(
      request.observedAtUtc,
      "noncanonical_capture_observation_utc",
    );
    if (observedMs <= previousObservedMs) {
      fail("capture_observations_not_strictly_increasing");
    }
    previousObservedMs = observedMs;
    const requestId = providerRequestId(
      request.xVercelId,
      "missing_or_invalid_x_vercel_id",
    );
    if (providerIds.has(requestId)) fail("duplicate_x_vercel_id");
    providerIds.add(requestId);
    safePin(
      request.rawBody,
      CAPTURE_BODY_FILENAMES[index],
      "invalid_capture_raw_body_pin",
    );
  }
  return receipt;
}

async function nextLocalObservation(previousMs) {
  for (let attempt = 0; attempt < 2_000; attempt += 1) {
    const nowMs = Date.now();
    if (Number.isSafeInteger(nowMs) && nowMs > previousMs) {
      return { milliseconds: nowMs, utc: new Date(nowMs).toISOString() };
    }
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  fail("local_clock_did_not_advance");
}

async function responseBytes(response, sequence) {
  const contentLength = response.headers.get("content-length");
  if (
    contentLength !== null &&
    (!/^\d+$/.test(contentLength) || Number(contentLength) > MAX_BODY_BYTES)
  ) {
    fail(`capture_response_body_size_invalid_${sequence}`);
  }
  if (!response.body || typeof response.body.getReader !== "function") {
    fail(`capture_response_body_failed_${sequence}`);
  }
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) {
        fail(`capture_response_body_failed_${sequence}`);
      }
      length += value.byteLength;
      if (length > MAX_BODY_BYTES) {
        await reader.cancel("capture_response_limit");
        fail(`capture_response_body_size_invalid_${sequence}`);
      }
      chunks.push(Buffer.from(value));
    }
  } catch (error) {
    if (String(error?.message || "").startsWith("capture_")) throw error;
    fail(`capture_response_body_failed_${sequence}`);
  } finally {
    reader.releaseLock();
  }
  const bytes = Buffer.concat(chunks, length);
  for (const chunk of chunks) chunk.fill(0);
  if (bytes.length === 0) {
    fail(`capture_response_body_size_invalid_${sequence}`);
  }
  return bytes;
}

function encodedCredentialCandidates(secret) {
  const utf8Bytes = Buffer.from(secret, "utf8");
  const fullPercentUpper = Array.from(
    utf8Bytes,
    (byte) => `%${byte.toString(16).padStart(2, "0").toUpperCase()}`,
  ).join("");
  const standardUri = encodeURIComponent(secret);
  const uri = encodeURI(secret);
  const lowerPercentEscapes = (value) =>
    value.replace(/%[0-9A-F]{2}/gu, (entry) => entry.toLowerCase());
  const base64 = utf8Bytes.toString("base64");
  const base64Unpadded = base64.replace(/=+$/u, "");
  const base64UrlUnpadded = base64Unpadded
    .replace(/\+/gu, "-")
    .replace(/\//gu, "_");
  const base64UrlPadded = `${base64UrlUnpadded}${"=".repeat(
    (4 - (base64UrlUnpadded.length % 4)) % 4,
  )}`;
  const hexLower = utf8Bytes.toString("hex");
  return new Set(
    [
      secret,
      fullPercentUpper,
      fullPercentUpper.toLowerCase(),
      standardUri,
      lowerPercentEscapes(standardUri),
      uri,
      lowerPercentEscapes(uri),
      base64,
      base64Unpadded,
      base64UrlPadded,
      base64UrlUnpadded,
      hexLower,
      hexLower.toUpperCase(),
    ].filter((candidate) => candidate.length > 0),
  );
}

function decodedJsonContainsSecret(value, candidates) {
  if (typeof value === "string") {
    return candidates.some((candidate) => value.includes(candidate));
  }
  if (Array.isArray(value)) {
    return value.some((entry) => decodedJsonContainsSecret(entry, candidates));
  }
  if (value && typeof value === "object") {
    return Object.entries(value).some(
      ([key, entry]) =>
        candidates.some((candidate) => key.includes(candidate)) ||
        decodedJsonContainsSecret(entry, candidates),
    );
  }
  return false;
}

function parsedJsonContainsSecret(text, candidates) {
  try {
    if (decodedJsonContainsSecret(JSON.parse(text), candidates)) return true;
  } catch {}
  if (
    /^(?:[^"\\\u0000-\u001f]|\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4}))*$/u.test(
      text,
    )
  ) {
    try {
      if (
        decodedJsonContainsSecret(JSON.parse(`"${text}"`), candidates)
      ) {
        return true;
      }
    } catch {}
  }
  return false;
}

export function containsCredentialReflection(value, candidateSecrets) {
  if (!Array.isArray(candidateSecrets)) {
    fail("credential_reflection_scan_secrets_invalid");
  }
  const secrets = candidateSecrets.filter((secret) => secret !== null);
  if (
    secrets.some(
      (secret) => typeof secret !== "string" || secret.length === 0,
    )
  ) {
    fail("credential_reflection_scan_secrets_invalid");
  }
  if (secrets.length === 0) return false;
  const candidates = Array.from(
    new Set(secrets.flatMap((secret) => [...encodedCredentialCandidates(secret)])),
  );
  let text;
  if (typeof value === "string") {
    text = value;
  } else if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    try {
      text = utf8.decode(value);
    } catch {
      fail("credential_reflection_scan_invalid_utf8");
    }
  } else {
    fail("credential_reflection_scan_input_invalid");
  }
  for (const candidate of candidates) {
    if (text.includes(candidate)) return true;
    const encoded = JSON.stringify(candidate);
    const escaped = encoded.slice(1, -1);
    if (escaped.length > 0 && text.includes(escaped)) return true;
  }
  return parsedJsonContainsSecret(text, candidates);
}

async function withinRequestDeadline(sequence, timeoutMs, work) {
  const controller = new AbortController();
  let timedOut = false;
  let timeout;
  const deadline = new Promise((_, reject) => {
    timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
      reject(new Error("request_deadline_elapsed"));
    }, timeoutMs);
  });
  try {
    return await Promise.race([work(controller.signal), deadline]);
  } catch (error) {
    if (timedOut) fail(`capture_request_timeout_${sequence}`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function captureRequests({
  uniqueUrl,
  intent,
  serviceActiveRunId,
  adminKey,
  protectionBypass = null,
  fetchImpl,
  requestTimeoutMs = REQUEST_TIMEOUT_MS,
}) {
  if (
    !Number.isSafeInteger(requestTimeoutMs) ||
    requestTimeoutMs <= 0 ||
    requestTimeoutMs > REQUEST_TIMEOUT_MS
  ) {
    fail("invalid_request_timeout_ms");
  }
  if (
    (serviceActiveRunId === ACTIVE_RUN_ID &&
      (typeof protectionBypass !== "string" ||
        !/^[\x21-\x7e]{16,4096}$/.test(protectionBypass))) ||
    (serviceActiveRunId !== ACTIVE_RUN_ID && protectionBypass !== null)
  ) {
    fail("invalid_protection_bypass_for_phase");
  }
  const urls = requestUrls(uniqueUrl, intent);
  const captures = [];
  let previousObservedMs = -Infinity;
  for (let index = 0; index < urls.length; index += 1) {
    let response;
    let bytes;
    try {
      ({ response, bytes } = await withinRequestDeadline(
        index + 1,
        requestTimeoutMs,
        async (signal) => {
          const headers = {
            accept: "application/json",
            "x-admin-key": adminKey,
          };
          if (protectionBypass !== null) {
            headers["x-vercel-protection-bypass"] = protectionBypass;
          }
          const fetched = await fetchImpl(urls[index], {
            method: "GET",
            headers,
            redirect: "error",
            cache: "no-store",
            signal,
          });
          return {
            response: fetched,
            bytes: await responseBytes(fetched, index + 1),
          };
        },
      ));
    } catch (error) {
      if (String(error?.message || "").startsWith("capture_")) throw error;
      fail(`capture_get_failed_${index + 1}`);
    }
    const captureSecrets = [adminKey, protectionBypass];
    if (containsCredentialReflection(bytes, captureSecrets)) {
      fail(`capture_response_contains_secret_${index + 1}`);
    }
    if (response.status !== 200) fail(`capture_http_status_${index + 1}`);
    const contentType = String(response.headers.get("content-type") || "")
      .split(";", 1)[0]
      .trim()
      .toLowerCase();
    if (contentType !== "application/json") {
      fail(`capture_content_type_not_json_${index + 1}`);
    }
    const parsed = parseJsonBody(bytes, `capture_response_${index + 1}`);
    if (index === 0 || index === 2) {
      validateExportEnvelope(
        parsed,
        serviceActiveRunId,
        `invalid_capture_export_${index + 1}`,
      );
    } else {
      validateReductionEnvelope(
        parsed,
        intent,
        serviceActiveRunId,
        `invalid_capture_reduction_${index + 1}`,
      );
    }
    const rawRequestId = response.headers.get("x-vercel-id");
    if (
      typeof rawRequestId === "string" &&
      containsCredentialReflection(rawRequestId, captureSecrets)
    ) {
      fail("provider_identity_contains_secret");
    }
    const requestId = providerRequestId(
      rawRequestId,
      "missing_or_invalid_x_vercel_id",
    );
    if (
      captures.some(
        (capture) => capture.request.xVercelId === requestId,
      )
    ) {
      fail("duplicate_x_vercel_id");
    }
    const observed = await nextLocalObservation(previousObservedMs);
    previousObservedMs = observed.milliseconds;
    captures.push({
      bytes,
      request: {
        sequence: index + 1,
        kind: CAPTURE_SEQUENCE[index],
        method: "GET",
        url: urls[index],
        status: response.status,
        xVercelId: requestId,
        observedAtUtc: observed.utc,
        rawBody: {
          path: CAPTURE_BODY_FILENAMES[index],
          sha256: sha256(bytes),
        },
      },
    });
  }
  return captures;
}

async function readProtectedInputFromStdin(input, phase) {
  const chunks = [];
  let size = 0;
  for await (const chunk of input) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > MAX_PROTECTED_INPUT_BYTES) {
      fail("protected_input_stdin_too_large");
    }
    chunks.push(bytes);
  }
  const raw = Buffer.concat(chunks);
  for (const chunk of chunks) chunk.fill(0);
  let value = null;
  try {
    value = JSON.parse(utf8.decode(raw));
  } catch {
    raw.fill(0);
    fail("invalid_protected_input_stdin");
  }
  raw.fill(0);
  if (
    !exactKeys(value, [
      "adminKey",
      "protectionBypass",
      "provenance",
      "schemaVersion",
    ]) ||
    value.schemaVersion !== PROTECTED_INPUT_SCHEMA_VERSION ||
    typeof value.adminKey !== "string" ||
    !/^[\x21-\x7e]{16,4096}$/.test(value.adminKey) ||
    (phase === "staged"
      ? typeof value.protectionBypass !== "string" ||
        !/^[\x21-\x7e]{16,4096}$/.test(value.protectionBypass)
      : value.protectionBypass !== null)
  ) {
    fail("invalid_protected_input_stdin");
  }
  return value;
}

function matchingDirectoryIdentity(left, right) {
  return (
    left.isDirectory() &&
    right.isDirectory() &&
    left.ino !== 0n &&
    right.ino !== 0n &&
    (left.dev === 0n || right.dev === 0n || left.dev === right.dev) &&
    left.ino === right.ino
  );
}

function matchingRequiredGuardIdentity(left, right) {
  return (
    matchingFileIdentity(left, right) &&
    typeof left.dev === "bigint" &&
    typeof right.dev === "bigint" &&
    left.dev !== 0n &&
    right.dev !== 0n &&
    left.ino !== 0n &&
    right.ino !== 0n
  );
}

function revalidateOutputDirectoryGuard(opened) {
  if (opened.guard === null) return;
  try {
    const link = fs.lstatSync(opened.guard.path, { bigint: true });
    const pathStat = fs.statSync(opened.guard.path, { bigint: true });
    const descriptorStat = fs.fstatSync(opened.guard.descriptor, {
      bigint: true,
    });
    const realPath = fs.realpathSync.native(opened.guard.path);
    if (
      link.isSymbolicLink() ||
      !matchingFileIdentity(link, opened.guard.stat) ||
      !matchingFileIdentity(pathStat, opened.guard.stat) ||
      !matchingRequiredGuardIdentity(descriptorStat, opened.guard.stat) ||
      realPath !== opened.guard.realPath ||
      path.dirname(realPath) !== opened.realPath
    ) {
      fail("prepared_output_directory_guard_identity_changed");
    }
  } catch (error) {
    if (
      String(error?.message || "") ===
      "prepared_output_directory_guard_identity_changed"
    ) {
      throw error;
    }
    fail("prepared_output_directory_guard_identity_changed");
  }
}

function revalidatePreparedOutputDirectory(opened) {
  const link = fs.lstatSync(opened.path, { bigint: true });
  const pathStat = fs.statSync(opened.path, { bigint: true });
  const descriptorStat = fs.fstatSync(opened.descriptor, { bigint: true });
  const realPath = fs.realpathSync.native(opened.path);
  if (
    link.isSymbolicLink() ||
    !matchingDirectoryIdentity(link, opened.stat) ||
    !matchingDirectoryIdentity(pathStat, opened.stat) ||
    !matchingDirectoryIdentity(descriptorStat, opened.stat) ||
    realPath !== opened.realPath
  ) {
    fail("prepared_output_directory_identity_changed");
  }
  revalidateOutputDirectoryGuard(opened);
}

function openOutputDirectoryGuard(opened, allowGuardless) {
  const guardPath = path.join(opened.path, OUTPUT_DIRECTORY_GUARD_FILENAME);
  if (allowGuardless && !fs.existsSync(guardPath)) return null;
  let descriptor;
  try {
    const link = fs.lstatSync(guardPath, { bigint: true });
    if (link.isSymbolicLink()) {
      fail("prepared_output_directory_guard_reparse_or_symlink");
    }
    const realPath = fs.realpathSync.native(guardPath);
    descriptor = fs.openSync(guardPath, "r");
    const stat = fs.fstatSync(descriptor, { bigint: true });
    const pathStat = fs.statSync(guardPath, { bigint: true });
    if (
      !stat.isFile() ||
      stat.size !== BigInt(OUTPUT_DIRECTORY_GUARD_BYTES.length) ||
      !matchingFileIdentity(link, stat) ||
      !matchingFileIdentity(pathStat, stat) ||
      !matchingRequiredGuardIdentity(stat, stat) ||
      realPath !== guardPath ||
      path.dirname(realPath) !== opened.realPath
    ) {
      fail("prepared_output_directory_guard_invalid");
    }
    const bytes = Buffer.alloc(Number(stat.size));
    let offset = 0;
    while (offset < bytes.length) {
      const count = fs.readSync(
        descriptor,
        bytes,
        offset,
        bytes.length - offset,
        offset,
      );
      if (count === 0) fail("prepared_output_directory_guard_short_read");
      offset += count;
    }
    if (!bytes.equals(OUTPUT_DIRECTORY_GUARD_BYTES)) {
      fail("prepared_output_directory_guard_malformed");
    }
    const guard = { descriptor, path: guardPath, realPath, stat };
    opened.guard = guard;
    revalidateOutputDirectoryGuard(opened);
    return guard;
  } catch (error) {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    if (
      String(error?.message || "").startsWith(
        "prepared_output_directory_guard_",
      )
    ) {
      throw error;
    }
    fail("prepared_output_directory_guard_missing_or_unreadable");
  }
}

function assertPreparedOutputDirectory(
  outputDirectory,
  phase,
  importedTestOnlyAllowGuardlessOutputDirectory,
) {
  const absolute = path.resolve(outputDirectory);
  let descriptor;
  let opened;
  try {
    const link = fs.lstatSync(absolute, { bigint: true });
    const real = fs.realpathSync.native(absolute);
    if (!link.isDirectory() || link.isSymbolicLink() || real !== absolute) {
      fail("prepared_output_directory_identity_invalid");
    }
    descriptor = fs.openSync(absolute, "r");
    const stat = fs.fstatSync(descriptor, { bigint: true });
    opened = {
      descriptor,
      path: absolute,
      realPath: real,
      stat,
      guard: null,
    };
    revalidatePreparedOutputDirectory(opened);
    const expectedEntries =
      phase === "staged" ? [PROVIDER_LOOKUP_FILENAME] : [];
    const entries = fs.readdirSync(absolute).sort();
    const guardedEntries = [...expectedEntries, OUTPUT_DIRECTORY_GUARD_FILENAME].sort();
    const exactEntries = importedTestOnlyAllowGuardlessOutputDirectory
      ? [expectedEntries, guardedEntries]
      : [guardedEntries];
    if (!exactEntries.some((value) => isDeepStrictEqual(entries, value))) {
      fail("prepared_output_directory_not_exact");
    }
    openOutputDirectoryGuard(
      opened,
      importedTestOnlyAllowGuardlessOutputDirectory,
    );
    revalidatePreparedOutputDirectory(opened);
    return opened;
  } catch (error) {
    if (opened?.guard !== null && opened?.guard !== undefined) {
      fs.closeSync(opened.guard.descriptor);
    }
    if (descriptor !== undefined) fs.closeSync(descriptor);
    if (String(error?.message || "").startsWith("prepared_output_directory_")) {
      throw error;
    }
    fail("prepared_output_directory_invalid");
  }
}

function writeExclusiveCaptureArtifact(
  directory,
  filename,
  bytes,
  code,
  afterFsync,
) {
  let descriptor;
  try {
    revalidatePreparedOutputDirectory(directory);
    const artifactPath = path.join(directory.path, filename);
    descriptor = fs.openSync(artifactPath, "wx", 0o600);
    const artifactStat = fs.fstatSync(descriptor, { bigint: true });
    const artifactLink = fs.lstatSync(artifactPath, { bigint: true });
    const artifactPathStat = fs.statSync(artifactPath, { bigint: true });
    const artifactRealPath = fs.realpathSync.native(artifactPath);
    if (
      !matchingFileIdentity(artifactLink, artifactStat) ||
      !matchingFileIdentity(artifactPathStat, artifactStat) ||
      path.dirname(artifactRealPath) !== directory.realPath
    ) {
      fail(`${code}_identity_changed`);
    }
    let offset = 0;
    while (offset < bytes.length) {
      const count = fs.writeSync(
        descriptor,
        bytes,
        offset,
        bytes.length - offset,
      );
      if (count === 0) fail(`${code}_short_write`);
      offset += count;
    }
    fs.fsyncSync(descriptor);
    const written = fs.fstatSync(descriptor, { bigint: true });
    if (written.size !== BigInt(bytes.length)) fail(`${code}_short_write`);
    afterFsync?.({ artifactPath, filename });
    const writtenLink = fs.lstatSync(artifactPath, { bigint: true });
    const writtenPathStat = fs.statSync(artifactPath, { bigint: true });
    if (
      writtenLink.isSymbolicLink() ||
      !matchingFileIdentity(writtenLink, written) ||
      !matchingFileIdentity(writtenPathStat, written) ||
      fs.realpathSync.native(artifactPath) !== artifactRealPath
    ) {
      fail(`${code}_identity_changed`);
    }
    revalidatePreparedOutputDirectory(directory);
  } catch (error) {
    if (String(error?.message || "").startsWith(code)) throw error;
    if (String(error?.message || "").startsWith("prepared_output_directory_")) {
      throw error;
    }
    fail(`${code}_write_failed`);
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
}

function writeCaptureDirectory(
  outputDirectory,
  captures,
  receiptBytes,
  stagedReceiptBytes,
  lifecycleHooks,
) {
  for (let index = 0; index < captures.length; index += 1) {
    writeExclusiveCaptureArtifact(
      outputDirectory,
      CAPTURE_BODY_FILENAMES[index],
      captures[index].bytes,
      `capture_body_${index + 1}`,
      index === 0 ? lifecycleHooks.afterFirstArtifactFsync : undefined,
    );
  }
  if (stagedReceiptBytes !== null) {
    writeExclusiveCaptureArtifact(
      outputDirectory,
      STAGED_RECEIPT_FILENAME,
      stagedReceiptBytes,
      "staged_deployment_receipt",
      undefined,
    );
  }
  const receiptPath = path.join(outputDirectory.path, CAPTURE_RECEIPT_FILENAME);
  writeExclusiveCaptureArtifact(
    outputDirectory,
    CAPTURE_RECEIPT_FILENAME,
    receiptBytes,
    "capture_receipt",
    undefined,
  );
  return { receiptPath, receiptBytes };
}

export async function main(
  argv,
  {
    input = process.stdin,
    fetchImpl = fetch,
    pathOverrides = {},
    emitSummary = true,
    lifecycleHooks = {},
    importedTestOnlyAllowGuardlessOutputDirectory = false,
  } = {},
) {
  if (argv.length !== 2) {
    fail(
      "usage: window002-baseline-capture-v2 <pre_rotation|staged> <whole-hour-start-utc>",
    );
  }
  const [phaseArgument, startUtc] = argv;
  const phase = canonicalPhase(phaseArgument);
  if (typeof importedTestOnlyAllowGuardlessOutputDirectory !== "boolean") {
    fail("invalid_imported_test_only_guardless_seam");
  }
  const initialPaths = phasePaths(phase, pathOverrides);
  const outputDirectory = assertPreparedOutputDirectory(
    initialPaths.outputDirectory,
    phase,
    importedTestOnlyAllowGuardlessOutputDirectory,
  );
  try {
    const phaseInputs = preparePhaseInputs(phase, pathOverrides);
    const {
      uniqueUrl,
      deploymentSource,
      stagedReceiptBytes,
      validatedStage,
      providerLookupBytes,
      serviceActiveRunId,
      wrapperPath,
    } = phaseInputs;
    const intent = windowIntent(startUtc);
    revalidatePreparedOutputDirectory(outputDirectory);
    const wrapperBytes = stableReadFile(
      wrapperPath,
      2 * 1024 * 1024,
      "protected_wrapper",
    );
    const wrapperSha256 = sha256(wrapperBytes);
    wrapperBytes.fill(0);
    const protectedInput = await readProtectedInputFromStdin(input, phase);
    let adminKey = protectedInput.adminKey;
    let protectionBypass = protectedInput.protectionBypass;
    const protectionFingerprint =
      protectionBypass === null
        ? null
        : sha256(Buffer.from(protectionBypass, "utf8"));
    if (
      protectedInput.provenance.deploymentProtectionFingerprintSha256 !==
      protectionFingerprint
    ) {
      fail("protection_bypass_fingerprint_mismatch");
    }
    validateProtectedProvenance(protectedInput.provenance, {
      phase,
      wrapperSha256,
      validatedStage,
      providerLookupBytes,
    });
    for (const evidenceBytes of [stagedReceiptBytes, providerLookupBytes]) {
      if (
        evidenceBytes !== null &&
        containsCredentialReflection(evidenceBytes, [
          adminKey,
          protectionBypass,
        ])
      ) {
        fail("protected_evidence_contains_capture_secret");
      }
    }
    let captures;
    let receipt;
    let receiptBytes;
    try {
      captures = await captureRequests({
        uniqueUrl,
        intent,
        serviceActiveRunId,
        adminKey,
        protectionBypass,
        fetchImpl,
      });
      const captureToolSha256 = sha256(
        fs.readFileSync(fileURLToPath(import.meta.url)),
      );
      receipt = buildCaptureReceipt({
        uniqueUrl,
        intent,
        serviceActiveRunId,
        deploymentSource,
        operatorProvenance: protectedInput.provenance,
        deploymentProtection: {
          header: "x-vercel-protection-bypass",
          source: "stdin_only_via_protected_wrapper",
          presented: phase === "staged",
          fingerprintSha256: protectionFingerprint,
          secretPersisted: false,
          secretLogged: false,
        },
        captureToolSha256,
        requests: captures.map((capture) => capture.request),
      });
      receiptBytes = Buffer.from(
        `${JSON.stringify(receipt, null, 2)}\n`,
        "utf8",
      );
      const captureSecrets = [adminKey, protectionBypass];
      for (const evidence of [
        ...captures.map((capture) => capture.bytes),
        stagedReceiptBytes,
        providerLookupBytes,
        receiptBytes,
      ]) {
        if (
          evidence !== null &&
          containsCredentialReflection(evidence, captureSecrets)
        ) {
          fail("prewrite_evidence_contains_capture_secret");
        }
      }
      for (const capture of captures) {
        if (
          containsCredentialReflection(
            capture.request.xVercelId,
            captureSecrets,
          )
        ) {
          fail("prewrite_provider_identity_contains_secret");
        }
      }
    } finally {
      adminKey = "";
      protectionBypass = null;
      protectedInput.adminKey = "";
      protectedInput.protectionBypass = null;
    }
    lifecycleHooks.beforeOutputWrites?.();
    revalidatePreparedOutputDirectory(outputDirectory);
    const { receiptPath, receiptBytes: writtenReceiptBytes } = writeCaptureDirectory(
      outputDirectory,
      captures,
      receiptBytes,
      stagedReceiptBytes,
      lifecycleHooks,
    );
    revalidatePreparedOutputDirectory(outputDirectory);
    const summary = {
      schemaVersion: receipt.schemaVersion,
      result: receipt.result,
      receiptPath,
      captureReceiptSha256: sha256(writtenReceiptBytes),
      requestCount: receipt.requests.length,
    };
    if (emitSummary) process.stdout.write(`${JSON.stringify(summary)}\n`);
    return summary;
  } finally {
    if (outputDirectory.guard !== null) {
      fs.closeSync(outputDirectory.guard.descriptor);
    }
    fs.closeSync(outputDirectory.descriptor);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error) => {
    const message =
      typeof error?.message === "string" &&
      /^[a-z0-9_:.-]+$/i.test(error.message)
        ? error.message
        : "window002_baseline_capture_failed";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
