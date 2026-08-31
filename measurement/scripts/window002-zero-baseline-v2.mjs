#!/usr/bin/env node

import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { TextDecoder } from "node:util";

import {
  CAPTURE_BODY_FILENAMES,
  CAPTURE_RECEIPT_FILENAME,
  PROVIDER_LOOKUP_FILENAME,
  PROTECTED_WRAPPER_PATH,
  STAGED_RECEIPT_FILENAME,
  validateProtectedProvenance,
  validateStagedDeploymentReceiptBytes,
  validateCaptureReceipt,
} from "./window002-baseline-capture-v2.mjs";
import {
  ACTIVE_RUN_ID,
  HISTORICAL_RUN_COUNTS,
  TOTAL_EVENT_COUNT,
  assertMatchingReads,
  parseAndProject,
} from "./window002-historical-projection.mjs";
import { reduceWindowEvents } from "../lib/reducer.js";

const MAX_PRESTART_AGE_MS = 5 * 60 * 1000;
const WINDOW_DURATION_MS = 14 * 24 * 60 * 60 * 1000;
const utf8 = new TextDecoder("utf-8", { fatal: true });

function fail(code) {
  throw new Error(code);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function exactKeys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  return (
    keys.length === expected.length &&
    keys.every((key, index) => key === expected[index])
  );
}

function parseJsonBody(rawBytes, code) {
  if (!Buffer.isBuffer(rawBytes)) fail(`${code}_must_be_raw_bytes`);
  try {
    return JSON.parse(utf8.decode(rawBytes));
  } catch {
    fail(`invalid_${code}_json`);
  }
}

function canonicalUtc(value, code) {
  if (typeof value !== "string") fail(code);
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) fail(code);
  if (new Date(milliseconds).toISOString() !== value) fail(code);
  return milliseconds;
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

function canonicalJsonSha256(value) {
  return sha256(Buffer.from(JSON.stringify(canonicalize(value)), "utf8"));
}

function reductionResponse(rawBytes) {
  const response = parseJsonBody(rawBytes, "bounded_reduction_response");
  if (
    !exactKeys(response, ["ok", "reduction"]) ||
    response.ok !== true ||
    !response.reduction ||
    typeof response.reduction !== "object" ||
    Array.isArray(response.reduction)
  ) {
    fail("invalid_bounded_reduction_response");
  }
  return response.reduction;
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

function exportEvents(rawBytes) {
  const envelope = parseJsonBody(rawBytes, "export");
  if (!Array.isArray(envelope?.events)) fail("invalid_export_envelope");
  return envelope.events.map(reducerEvent);
}

function projectHistoricalExport(rawBytes, expectedServiceRunId) {
  return parseAndProject(rawBytes, { expectedServiceRunId });
}

function assertZeroReduction(reduction) {
  const zeroRawCounts = {
    result_view: 0,
    share_created: 0,
    propagated_visit: 0,
    qualified_result_view: 0,
    qualified_propagation: 0,
  };
  if (
    reduction.runId !== ACTIVE_RUN_ID ||
    !isDeepStrictEqual(reduction.rawCounts, zeroRawCounts) ||
    reduction.qualifiedResultViews !== 0 ||
    reduction.qualifiedPropagations !== 0 ||
    reduction.distinctSharerSessions !== 0 ||
    !Array.isArray(reduction.exclusions) ||
    reduction.exclusions.length !== 0 ||
    reduction.disposition !== "HOLD_ONCE" ||
    reduction.window?.semantics !== "[startUtc,endUtc)" ||
    reduction.windowExclusionCounts?.wrongRun !== TOTAL_EVENT_COUNT ||
    reduction.windowExclusionCounts?.beforeStart !== 0 ||
    reduction.windowExclusionCounts?.atOrAfterEnd !== 0 ||
    !Array.isArray(reduction.windowExclusions?.wrongRun) ||
    reduction.windowExclusions.wrongRun.length !== TOTAL_EVENT_COUNT ||
    !Array.isArray(reduction.windowExclusions?.beforeStart) ||
    reduction.windowExclusions.beforeStart.length !== 0 ||
    !Array.isArray(reduction.windowExclusions?.atOrAfterEnd) ||
    reduction.windowExclusions.atOrAfterEnd.length !== 0
  ) {
    fail("nonzero_or_invalid_active_run_baseline");
  }
}

function comparablePath(value) {
  return process.platform === "win32" ? value.toLowerCase() : value;
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

export function openStableInput(inputPath, maximumBytes, code) {
  let descriptor;
  try {
    const requestedPath = path.resolve(inputPath);
    const link = fs.lstatSync(requestedPath, { bigint: true });
    if (link.isSymbolicLink()) fail(`${code}_reparse_or_symlink`);
    const realPath = fs.realpathSync.native(requestedPath);
    descriptor = fs.openSync(requestedPath, "r");
    const stat = fs.fstatSync(descriptor, { bigint: true });
    if (
      !stat.isFile() ||
      stat.size <= 0n ||
      stat.size > BigInt(maximumBytes)
    ) {
      fail(`${code}_size_invalid`);
    }
    const pathStat = fs.statSync(requestedPath, { bigint: true });
    if (
      !matchingFileIdentity(link, stat) ||
      !matchingFileIdentity(pathStat, stat)
    ) {
      fail(`${code}_identity_changed`);
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
      if (count === 0) fail(`${code}_short_read`);
      offset += count;
    }
    const opened = {
      descriptor,
      requestedPath,
      realPath,
      comparablePath: comparablePath(realPath),
      stat,
      dev: stat.dev,
      ino: stat.ino,
      bytes,
      sha256: sha256(bytes),
    };
    revalidateOpenInput(opened, code);
    return opened;
  } catch (error) {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    if (String(error?.message || "").startsWith(code)) throw error;
    fail(`${code}_open_failed`);
  }
}

export function revalidateOpenInput(opened, code) {
  const current = fs.fstatSync(opened.descriptor, { bigint: true });
  const currentLink = fs.lstatSync(opened.requestedPath, { bigint: true });
  const currentPathStat = fs.statSync(opened.requestedPath, { bigint: true });
  const currentRealPath = fs.realpathSync.native(opened.requestedPath);
  if (
    currentLink.isSymbolicLink() ||
    !matchingFileIdentity(current, opened.stat) ||
    !matchingFileIdentity(currentLink, opened.stat) ||
    !matchingFileIdentity(currentPathStat, opened.stat) ||
    currentRealPath !== opened.realPath
  ) {
    fail(`${code}_identity_changed`);
  }
}

function closeInputs(inputs) {
  for (const input of inputs) {
    try { fs.closeSync(input.descriptor); } catch {}
  }
}

export function assertDistinctInputs(identities) {
  if (identities.some((identity) => identity.ino === 0n)) {
    fail("capture_input_file_identity_unavailable");
  }
  for (let left = 0; left < identities.length; left += 1) {
    for (let right = left + 1; right < identities.length; right += 1) {
      const first = identities[left];
      const second = identities[right];
      const samePath = first.comparablePath === second.comparablePath;
      const sameFile = first.dev === second.dev && first.ino === second.ino;
      if (samePath || sameFile) {
        fail("capture_inputs_must_be_distinct_files");
      }
    }
  }
}

function validateTimes({ read1ObservedAtUtc, read2ObservedAtUtc, startUtc, endUtc }) {
  const read1Ms = canonicalUtc(
    read1ObservedAtUtc,
    "noncanonical_read1_observed_at_utc",
  );
  const read2Ms = canonicalUtc(
    read2ObservedAtUtc,
    "noncanonical_read2_observed_at_utc",
  );
  const startMs = canonicalUtc(startUtc, "noncanonical_start_utc");
  const endMs = canonicalUtc(endUtc, "noncanonical_end_utc");
  if (read1Ms >= read2Ms) fail("baseline_observations_not_strictly_increasing");
  if (read2Ms >= startMs) fail("baseline_observations_must_precede_start");
  if (startMs - read1Ms > MAX_PRESTART_AGE_MS) {
    fail("baseline_observations_not_recent");
  }
  const start = new Date(startMs);
  if (
    start.getUTCMinutes() !== 0 ||
    start.getUTCSeconds() !== 0 ||
    start.getUTCMilliseconds() !== 0
  ) {
    fail("window_start_must_be_whole_hour_utc");
  }
  if (endMs - startMs !== WINDOW_DURATION_MS) fail("window_must_be_exactly_14_days");
}

export function assembleZeroBaselineV2({
  captureReceipt,
  captureReceiptPin,
  exportRead1,
  reductionRead1,
  exportRead2,
  reductionRead2,
}) {
  const [exportRequest1, reductionRequest1, exportRequest2, reductionRequest2] =
    captureReceipt.requests;
  const read1ObservedAtUtc = reductionRequest1.observedAtUtc;
  const read2ObservedAtUtc = reductionRequest2.observedAtUtc;
  const { startUtc, endUtc } = captureReceipt.windowIntent;
  validateTimes({ read1ObservedAtUtc, read2ObservedAtUtc, startUtc, endUtc });

  const projection1 = projectHistoricalExport(
    exportRead1.bytes,
    captureReceipt.serviceActiveRunId,
  );
  const projection2 = projectHistoricalExport(
    exportRead2.bytes,
    captureReceipt.serviceActiveRunId,
  );
  if (
    projection1.rawSha256 !== exportRead1.sha256 ||
    projection2.rawSha256 !== exportRead2.sha256
  ) {
    fail("raw_export_hash_mismatch");
  }
  assertMatchingReads(projection1, projection2);

  const hosted1 = reductionResponse(reductionRead1.bytes);
  const hosted2 = reductionResponse(reductionRead2.bytes);
  if (reductionRead1.sha256 !== reductionRead2.sha256) {
    fail("mismatched_bounded_reduction_reads");
  }

  const events1 = exportEvents(exportRead1.bytes);
  const events2 = exportEvents(exportRead2.bytes);
  const serviceReductionOptions = {
    runId: captureReceipt.serviceActiveRunId,
    startUtc,
    endUtc,
  };
  const localService1 = reduceWindowEvents(events1, serviceReductionOptions);
  const localService2 = reduceWindowEvents(events2, serviceReductionOptions);
  if (!isDeepStrictEqual(localService1, hosted1)) {
    fail("hosted_reduction_mismatch_read1");
  }
  if (!isDeepStrictEqual(localService2, hosted2)) {
    fail("hosted_reduction_mismatch_read2");
  }
  if (!isDeepStrictEqual(localService1, localService2)) {
    fail("local_service_reductions_mismatch");
  }

  const targetReductionOptions = { runId: ACTIVE_RUN_ID, startUtc, endUtc };
  const localTarget1 = reduceWindowEvents(events1, targetReductionOptions);
  const localTarget2 = reduceWindowEvents(events2, targetReductionOptions);
  if (!isDeepStrictEqual(localTarget1, localTarget2)) {
    fail("local_target_reductions_mismatch");
  }
  assertZeroReduction(localTarget1);
  if (
    projection1.eventCount !== TOTAL_EVENT_COUNT ||
    projection1.activeRunEventCount !== 0 ||
    projection1.wrongRunCount !== TOTAL_EVENT_COUNT
  ) {
    fail("invalid_retained_historical_ledger");
  }
  const wrongRunDelta =
    localTarget1.windowExclusionCounts.wrongRun - projection1.wrongRunCount;
  if (wrongRunDelta !== 0) fail("wrong_run_delta_nonzero");

  const localServiceReductionSha256 = canonicalJsonSha256(localService1);
  const localTargetReductionSha256 = canonicalJsonSha256(localTarget1);
  const runDistribution = Object.entries(HISTORICAL_RUN_COUNTS).map(
    ([runId, eventCount]) => ({ runId, eventCount }),
  );
  const readEvidence = (
    observedAtUtc,
    exportBody,
    reductionBody,
    exportRequest,
    reductionRequest,
  ) => ({
    observedAtUtc,
    rawExport: exportRequest.rawBody,
    boundedReduction: reductionRequest.rawBody,
    rawExportSha256: exportBody.sha256,
    canonicalEventProjectionSha256: projection1.projectionDigest,
    boundedReductionRawSha256: reductionBody.sha256,
    locallyRecomputedServiceReductionCanonicalSha256:
      localServiceReductionSha256,
    locallyRecomputedTargetReductionCanonicalSha256:
      localTargetReductionSha256,
  });

  return {
    schemaVersion: "origin.window002.zero-baseline.v2",
    result: "PASS",
    runId: ACTIVE_RUN_ID,
    observedAtUtc: read2ObservedAtUtc,
    captureReceipt: captureReceiptPin,
    captureProvenance: {
      captureBindingSha256: captureReceipt.captureBindingSha256,
      captureToolSha256: captureReceipt.captureTool.sha256,
      uniqueUrl: captureReceipt.uniqueUrl,
      targetRunId: captureReceipt.targetRunId,
      serviceActiveRunId: captureReceipt.serviceActiveRunId,
      deploymentSource: captureReceipt.deploymentSource,
      operatorProvenance: captureReceipt.operatorProvenance,
      deploymentProtection: captureReceipt.deploymentProtection,
    },
    window: {
      startUtc,
      endUtc,
      days: 14,
      intervalSemantics: "[startUtc,endUtc)",
      eventTimeAuthority: "database_event_time",
    },
    reads: {
      read1: readEvidence(
        read1ObservedAtUtc,
        exportRead1,
        reductionRead1,
        exportRequest1,
        reductionRequest1,
      ),
      read2: readEvidence(
        read2ObservedAtUtc,
        exportRead2,
        reductionRead2,
        exportRequest2,
        reductionRequest2,
      ),
    },
    activeRunBaseline: {
      runId: ACTIVE_RUN_ID,
      rawEventCount: 0,
      qualifiedEventCount: 0,
      rawCounts: {
        result_view: 0,
        share_created: 0,
        propagated_visit: 0,
        qualified_result_view: 0,
        qualified_propagation: 0,
      },
      qualifiedResultViews: 0,
      qualifiedPropagations: 0,
      distinctSharerSessions: 0,
      allMetricsZero: true,
      disposition: "HOLD_ONCE",
      targetReductionCanonicalSha256: localTargetReductionSha256,
    },
    retainedHistoricalLedger: {
      totalEventCount: TOTAL_EVENT_COUNT,
      activeRunEventCount: 0,
      wrongRunCount: TOTAL_EVENT_COUNT,
      runDistribution,
      unknownHistoricalRunIdCount: 0,
      allRunIdsRecognized: true,
      historyPreserved: true,
      rawExportSha256: projection1.rawSha256,
      canonicalEventProjectionSha256: projection1.projectionDigest,
    },
    unexpectedBoundaryExclusions: {
      wrongRunDelta,
      unrecognizedRun: 0,
      beforeStart: 0,
      atOrAfterEnd: 0,
    },
    ledgerMutation: {
      detected: false,
      rawExportsByteIdentical: true,
      boundedReductionsByteIdentical: true,
      canonicalProjectionsEqual: true,
      deletedEvents: 0,
      updatedEvents: 0,
    },
    initialActiveRunEventCount: 0,
    initialLedgerEventCount: TOTAL_EVENT_COUNT,
  };
}

function samePath(left, right) {
  return comparablePath(left) === comparablePath(right);
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

export function openStableDirectory(directoryPath, code) {
  let descriptor;
  try {
    const requestedPath = path.resolve(directoryPath);
    const link = fs.lstatSync(requestedPath, { bigint: true });
    if (link.isSymbolicLink()) fail(`${code}_reparse_or_symlink`);
    const realPath = fs.realpathSync.native(requestedPath);
    descriptor = fs.openSync(requestedPath, "r");
    const stat = fs.fstatSync(descriptor, { bigint: true });
    const opened = { descriptor, requestedPath, realPath, stat };
    revalidateOpenDirectory(opened, code);
    return opened;
  } catch (error) {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    if (String(error?.message || "").startsWith(code)) throw error;
    fail(`${code}_open_failed`);
  }
}

export function revalidateOpenDirectory(opened, code) {
  const link = fs.lstatSync(opened.requestedPath, { bigint: true });
  const pathStat = fs.statSync(opened.requestedPath, { bigint: true });
  const descriptorStat = fs.fstatSync(opened.descriptor, { bigint: true });
  const realPath = fs.realpathSync.native(opened.requestedPath);
  if (
    link.isSymbolicLink() ||
    !matchingDirectoryIdentity(link, opened.stat) ||
    !matchingDirectoryIdentity(pathStat, opened.stat) ||
    !matchingDirectoryIdentity(descriptorStat, opened.stat) ||
    realPath !== opened.realPath
  ) {
    fail(`${code}_identity_changed`);
  }
}

function captureDirectory(receiptPath, outputPath) {
  const absoluteReceiptPath = path.resolve(receiptPath);
  if (path.basename(absoluteReceiptPath) !== CAPTURE_RECEIPT_FILENAME) {
    fail("capture_receipt_filename_mismatch");
  }
  const requestedDirectory = path.dirname(absoluteReceiptPath);
  const requestedOutputDirectory = path.dirname(path.resolve(outputPath));
  if (!samePath(requestedDirectory, requestedOutputDirectory)) {
    fail("output_must_share_capture_directory");
  }
  const directory = openStableDirectory(requestedDirectory, "capture_directory");
  if (!samePath(directory.realPath, requestedOutputDirectory)) {
    fs.closeSync(directory.descriptor);
    fail("output_must_share_capture_directory");
  }
  return { directory, absoluteReceiptPath };
}

function reopenCaptureBody(
  directory,
  pin,
  expectedPath,
  { allowByteLength = false, code = "capture_raw_body" } = {},
) {
  const expectedKeys = allowByteLength
    ? ["byteLength", "path", "sha256"]
    : ["path", "sha256"];
  if (
    !pin ||
    typeof pin !== "object" ||
    Array.isArray(pin) ||
    !exactKeys(pin, expectedKeys.sort()) ||
    pin.path !== expectedPath ||
    !/^[0-9a-f]{64}$/.test(pin.sha256 || "")
  ) {
    fail(`invalid_${code}_pin`);
  }
  const opened = openStableInput(
    path.join(directory, expectedPath),
    5 * 1024 * 1024,
    code,
  );
  if (!samePath(path.dirname(opened.realPath), directory)) {
    fail(`${code}_escapes_directory`);
  }
  if (
    opened.sha256 !== pin.sha256 ||
    (allowByteLength && opened.bytes.length !== pin.byteLength)
  ) {
    fail(`${code}_sha256_mismatch`);
  }
  return opened;
}

function reopenProtectedProvenance(directory, captureReceipt) {
  const source = captureReceipt.deploymentSource;
  if (source.kind === "pre_rotation_public_alias") {
    return {
      stage: null,
      providerLookup: null,
      validatedStage: null,
    };
  }
  const stage = reopenCaptureBody(
    directory,
    source.stageReceipt,
    STAGED_RECEIPT_FILENAME,
    { code: "staged_deployment_receipt" },
  );
  const validated = validateStagedDeploymentReceiptBytes(stage.bytes);
  if (
    validated.receiptSha256 !== source.stageReceipt.sha256 ||
    validated.deploymentId !== source.deploymentId ||
    validated.uniqueUrl !== source.uniqueUrl ||
    validated.uniqueUrl !== captureReceipt.uniqueUrl
  ) {
    fail("staged_deployment_receipt_binding_mismatch");
  }
  const providerLookup = reopenCaptureBody(
    directory,
    captureReceipt.operatorProvenance?.providerLookup?.rawBody,
    PROVIDER_LOOKUP_FILENAME,
    { allowByteLength: true, code: "provider_lookup" },
  );
  return { stage, providerLookup, validatedStage: validated };
}

export function main(argv, { lifecycleHooks = {} } = {}) {
  if (argv.length !== 2) {
    fail(
      "usage: window002-zero-baseline-v2 <capture-receipt.json> <output.json>",
    );
  }
  const [captureReceiptPath, outputPath] = argv;
  const { directory: directoryState, absoluteReceiptPath } = captureDirectory(
    captureReceiptPath,
    outputPath,
  );
  const directory = directoryState.realPath;
  const openedInputs = [];
  let outputDescriptor;
  try {
    revalidateOpenDirectory(directoryState, "capture_directory");
    const captureReceiptInput = openStableInput(
      absoluteReceiptPath,
      2 * 1024 * 1024,
      "capture_receipt",
    );
    openedInputs.push(captureReceiptInput);
    const captureReceipt = parseJsonBody(
      captureReceiptInput.bytes,
      "capture_receipt",
    );
    const captureToolInput = openStableInput(
      fileURLToPath(
        new URL("./window002-baseline-capture-v2.mjs", import.meta.url),
      ),
      2 * 1024 * 1024,
      "capture_tool",
    );
    openedInputs.push(captureToolInput);
    const captureToolSha256 = captureToolInput.sha256;
    const wrapperInput = openStableInput(
      fileURLToPath(
        new URL("./window002-baseline-capture-protected-v2.ps1", import.meta.url),
      ),
      2 * 1024 * 1024,
      "protected_wrapper",
    );
    openedInputs.push(wrapperInput);
    const wrapperSha256 = wrapperInput.sha256;
    validateCaptureReceipt(captureReceipt, {
      expectedToolSha256: captureToolSha256,
    });

    const protectedInputs = reopenProtectedProvenance(
      directory,
      captureReceipt,
    );
    if (protectedInputs.stage) openedInputs.push(protectedInputs.stage);
    if (protectedInputs.providerLookup) {
      openedInputs.push(protectedInputs.providerLookup);
    }
    validateProtectedProvenance(captureReceipt.operatorProvenance, {
      phase: captureReceipt.operatorProvenance.phase,
      wrapperSha256,
      validatedStage: protectedInputs.validatedStage,
      providerLookupBytes: protectedInputs.providerLookup?.bytes ?? null,
    });
    if (captureReceipt.operatorProvenance.wrapper.path !== PROTECTED_WRAPPER_PATH) {
      fail("protected_wrapper_path_mismatch");
    }

    // Every body is opened once, pinned to its descriptor identity, and kept
    // open until after the exclusive output is durably written.
    const reopenedBodies = captureReceipt.requests.map((request, index) =>
      reopenCaptureBody(
        directory,
        request.rawBody,
        CAPTURE_BODY_FILENAMES[index],
      ),
    );
    openedInputs.push(...reopenedBodies);
    assertDistinctInputs(openedInputs);
    const bodies = reopenedBodies.map((opened) => ({
      bytes: opened.bytes,
      sha256: opened.sha256,
    }));
    const evidence = assembleZeroBaselineV2({
      captureReceipt,
      captureReceiptPin: {
        path: CAPTURE_RECEIPT_FILENAME,
        sha256: captureReceiptInput.sha256,
      },
      exportRead1: bodies[0],
      reductionRead1: bodies[1],
      exportRead2: bodies[2],
      reductionRead2: bodies[3],
    });
    for (const opened of openedInputs) {
      revalidateOpenInput(opened, "baseline_input");
    }
    const outputBytes = Buffer.from(
      `${JSON.stringify(evidence, null, 2)}\n`,
      "utf8",
    );
    lifecycleHooks.beforeOutputOpen?.();
    revalidateOpenDirectory(directoryState, "capture_directory");
    const absoluteOutputPath = path.resolve(outputPath);
    outputDescriptor = fs.openSync(absoluteOutputPath, "wx", 0o600);
    const outputInitialStat = fs.fstatSync(outputDescriptor, { bigint: true });
    const outputInitialLink = fs.lstatSync(absoluteOutputPath, { bigint: true });
    const outputInitialPathStat = fs.statSync(absoluteOutputPath, { bigint: true });
    if (
      !matchingFileIdentity(outputInitialLink, outputInitialStat) ||
      !matchingFileIdentity(outputInitialPathStat, outputInitialStat) ||
      !samePath(path.dirname(fs.realpathSync.native(absoluteOutputPath)), directory)
    ) {
      fail("zero_baseline_output_identity_changed");
    }
    revalidateOpenDirectory(directoryState, "capture_directory");
    let offset = 0;
    while (offset < outputBytes.length) {
      const count = fs.writeSync(
        outputDescriptor,
        outputBytes,
        offset,
        outputBytes.length - offset,
      );
      if (count === 0) fail("zero_baseline_output_short_write");
      offset += count;
    }
    fs.fsyncSync(outputDescriptor);
    const outputStat = fs.fstatSync(outputDescriptor, { bigint: true });
    if (outputStat.size !== BigInt(outputBytes.length)) {
      fail("zero_baseline_output_short_write");
    }
    const outputLink = fs.lstatSync(absoluteOutputPath, { bigint: true });
    const outputPathStat = fs.statSync(absoluteOutputPath, { bigint: true });
    if (
      outputLink.isSymbolicLink() ||
      !matchingFileIdentity(outputLink, outputStat) ||
      !matchingFileIdentity(outputPathStat, outputStat)
    ) {
      fail("zero_baseline_output_identity_changed");
    }
    revalidateOpenDirectory(directoryState, "capture_directory");
    for (const opened of openedInputs) {
      revalidateOpenInput(opened, "baseline_input");
    }
    process.stdout.write(
      `${JSON.stringify({
        schemaVersion: evidence.schemaVersion,
        result: evidence.result,
        evidenceSha256: sha256(outputBytes),
        initialActiveRunEventCount: evidence.initialActiveRunEventCount,
        initialLedgerEventCount: evidence.initialLedgerEventCount,
      })}\n`,
    );
  } finally {
    if (outputDescriptor !== undefined) fs.closeSync(outputDescriptor);
    closeInputs(openedInputs);
    fs.closeSync(directoryState.descriptor);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2));
}
