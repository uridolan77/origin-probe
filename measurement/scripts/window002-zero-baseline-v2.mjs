#!/usr/bin/env node

import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { TextDecoder } from "node:util";

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

function inputFileIdentity(inputPath) {
  const realPath = fs.realpathSync.native(inputPath);
  const stat = fs.statSync(realPath, { bigint: true });
  return {
    readPath: realPath,
    comparablePath:
      process.platform === "win32" ? realPath.toLowerCase() : realPath,
    dev: stat.dev,
    ino: stat.ino,
  };
}

function assertFourDistinctInputs(identities) {
  for (let left = 0; left < identities.length; left += 1) {
    for (let right = left + 1; right < identities.length; right += 1) {
      const first = identities[left];
      const second = identities[right];
      const samePath = first.comparablePath === second.comparablePath;
      const meaningfulIds = first.ino !== 0n && second.ino !== 0n;
      const sameFile =
        meaningfulIds && first.dev === second.dev && first.ino === second.ino;
      if (samePath || sameFile) {
        fail("baseline_inputs_must_be_four_distinct_files");
      }
    }
  }
}

function safeArtifactPath(realInputPath, outputPath) {
  const outputDirectory = fs.realpathSync.native(
    path.dirname(path.resolve(outputPath)),
  );
  const relative = path
    .relative(outputDirectory, realInputPath)
    .split(path.sep)
    .join("/");
  const parts = relative.split("/");
  if (
    relative.length === 0 ||
    path.isAbsolute(relative) ||
    parts.some((part) => part === "" || part === "." || part === "..") ||
    !/^[A-Za-z0-9._/-]+$/.test(relative)
  ) {
    fail("input_artifact_path_must_be_safe_and_relative_to_output");
  }
  return relative;
}

function artifactPin(identity, outputPath, rawSha256) {
  return {
    path: safeArtifactPath(identity.readPath, outputPath),
    sha256: rawSha256,
  };
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
  exportRead1,
  reductionRead1,
  read1ObservedAtUtc,
  exportRead2,
  reductionRead2,
  read2ObservedAtUtc,
  startUtc,
  endUtc,
  artifactPins,
}) {
  validateTimes({ read1ObservedAtUtc, read2ObservedAtUtc, startUtc, endUtc });

  const projection1 = parseAndProject(exportRead1.bytes);
  const projection2 = parseAndProject(exportRead2.bytes);
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

  const reductionOptions = { runId: ACTIVE_RUN_ID, startUtc, endUtc };
  const local1 = reduceWindowEvents(exportEvents(exportRead1.bytes), reductionOptions);
  const local2 = reduceWindowEvents(exportEvents(exportRead2.bytes), reductionOptions);
  if (!isDeepStrictEqual(local1, hosted1)) fail("hosted_reduction_mismatch_read1");
  if (!isDeepStrictEqual(local2, hosted2)) fail("hosted_reduction_mismatch_read2");
  if (!isDeepStrictEqual(local1, local2)) fail("local_reductions_mismatch");

  assertZeroReduction(local1);
  if (
    projection1.eventCount !== TOTAL_EVENT_COUNT ||
    projection1.activeRunEventCount !== 0 ||
    projection1.wrongRunCount !== TOTAL_EVENT_COUNT
  ) {
    fail("invalid_retained_historical_ledger");
  }
  const wrongRunDelta =
    local1.windowExclusionCounts.wrongRun - projection1.wrongRunCount;
  if (wrongRunDelta !== 0) fail("wrong_run_delta_nonzero");

  const localReductionSha256 = canonicalJsonSha256(local1);
  const runDistribution = Object.entries(HISTORICAL_RUN_COUNTS).map(
    ([runId, eventCount]) => ({ runId, eventCount }),
  );
  const readEvidence = (observedAtUtc, exportBody, reductionBody, pins) => ({
    observedAtUtc,
    rawExport: pins.rawExport,
    boundedReduction: pins.boundedReduction,
    rawExportSha256: exportBody.sha256,
    canonicalEventProjectionSha256: projection1.projectionDigest,
    boundedReductionRawSha256: reductionBody.sha256,
    locallyRecomputedReductionCanonicalSha256: localReductionSha256,
  });

  return {
    schemaVersion: "origin.window002.zero-baseline.v2",
    result: "PASS",
    runId: ACTIVE_RUN_ID,
    observedAtUtc: read2ObservedAtUtc,
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
        artifactPins.read1,
      ),
      read2: readEvidence(
        read2ObservedAtUtc,
        exportRead2,
        reductionRead2,
        artifactPins.read2,
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

function readAndHash(inputPath) {
  const bytes = fs.readFileSync(inputPath);
  return { bytes, sha256: sha256(bytes) };
}

export function main(argv) {
  if (argv.length !== 9) {
    fail(
      "usage: window002-zero-baseline-v2 <export-1.json> <reduce-1.json> <observed-1-utc> <export-2.json> <reduce-2.json> <observed-2-utc> <start-utc> <end-utc> <output.json>",
    );
  }
  const [
    exportPath1,
    reductionPath1,
    read1ObservedAtUtc,
    exportPath2,
    reductionPath2,
    read2ObservedAtUtc,
    startUtc,
    endUtc,
    outputPath,
  ] = argv;

  const identities = [
    inputFileIdentity(exportPath1),
    inputFileIdentity(reductionPath1),
    inputFileIdentity(exportPath2),
    inputFileIdentity(reductionPath2),
  ];
  assertFourDistinctInputs(identities);

  // Hash all four exact HTTP bodies before any JSON parsing or reduction.
  const bodies = identities.map((identity) => readAndHash(identity.readPath));
  const artifactPins = {
    read1: {
      rawExport: artifactPin(identities[0], outputPath, bodies[0].sha256),
      boundedReduction: artifactPin(
        identities[1],
        outputPath,
        bodies[1].sha256,
      ),
    },
    read2: {
      rawExport: artifactPin(identities[2], outputPath, bodies[2].sha256),
      boundedReduction: artifactPin(
        identities[3],
        outputPath,
        bodies[3].sha256,
      ),
    },
  };
  const evidence = assembleZeroBaselineV2({
    exportRead1: bodies[0],
    reductionRead1: bodies[1],
    read1ObservedAtUtc,
    exportRead2: bodies[2],
    reductionRead2: bodies[3],
    read2ObservedAtUtc,
    startUtc,
    endUtc,
    artifactPins,
  });
  const outputBytes = Buffer.from(`${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  fs.writeFileSync(outputPath, outputBytes, { flag: "wx", mode: 0o600 });
  process.stdout.write(
    `${JSON.stringify({
      schemaVersion: evidence.schemaVersion,
      result: evidence.result,
      evidenceSha256: sha256(outputBytes),
      initialActiveRunEventCount: evidence.initialActiveRunEventCount,
      initialLedgerEventCount: evidence.initialLedgerEventCount,
    })}\n`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2));
}
