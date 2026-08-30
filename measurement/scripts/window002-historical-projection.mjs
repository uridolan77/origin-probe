#!/usr/bin/env node

import { createHash } from "node:crypto";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { TextDecoder } from "node:util";

export const ACTIVE_RUN_ID = "ORIGIN-G2-PUBLIC-PROBE-AUTH-002";
export const HISTORICAL_RUN_COUNTS = Object.freeze({
  "ORIGIN-G2R-ACCEPTANCE": 16,
  "ORIGIN-G2R-UI-REACCEPTANCE-001": 21,
});
export const TOTAL_EVENT_COUNT = 37;

const ENVELOPE_KEYS = [
  "activeRunId",
  "events",
  "ledgerSchemaVersion",
  "ok",
  "scope",
];
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

function requiredString(value, code) {
  if (typeof value !== "string" || value.length === 0) fail(code);
  return value;
}

function canonicalDatabaseEventTime(value) {
  const source = requiredString(value, "invalid_event_timestamp");
  const milliseconds = Date.parse(source);
  if (!Number.isFinite(milliseconds)) fail("invalid_event_timestamp");
  const canonical = new Date(milliseconds).toISOString();
  if (source !== canonical) fail("noncanonical_event_timestamp");
  return canonical;
}

function seedClassification(event) {
  if (!("seed" in event) || event.seed === null) return null;
  if (event.seed === true) return "seed";
  if (event.seed === false) return "non_seed";
  fail("invalid_event_seed");
}

function qualificationClassification(event) {
  const exclusions = event.exclusions;
  if (exclusions !== undefined && exclusions !== null) {
    if (
      !Array.isArray(exclusions) ||
      !exclusions.every(
        (reason) => typeof reason === "string" && reason.length > 0,
      )
    ) {
      fail("invalid_event_exclusions");
    }
    if (exclusions.length > 0) {
      return `excluded:${[...exclusions].sort().join(",")}`;
    }
  }
  if (
    event.type === "qualified_result_view" ||
    event.type === "qualified_propagation"
  ) {
    return "qualified";
  }
  return "not_qualified";
}

function optionalWindowId(event) {
  const topLevel = event.windowId;
  const payload =
    event.payload && typeof event.payload === "object" && !Array.isArray(event.payload)
      ? event.payload.windowId
      : undefined;
  if (
    topLevel !== undefined &&
    topLevel !== null &&
    payload !== undefined &&
    payload !== null &&
    topLevel !== payload
  ) {
    fail("conflicting_event_window_id");
  }
  const selected = topLevel ?? payload;
  return selected === undefined || selected === null
    ? null
    : requiredString(selected, "invalid_event_window_id");
}

function canonicalRecord(record) {
  return JSON.stringify({
    eventId: record.eventId,
    runId: record.runId,
    eventType: record.eventType,
    databaseEventTime: record.databaseEventTime,
    windowId: record.windowId,
    seedClassification: record.seedClassification,
    qualificationClassification: record.qualificationClassification,
  });
}

export function parseAndProject(rawBytes) {
  if (!Buffer.isBuffer(rawBytes)) fail("export_must_be_raw_bytes");
  const rawSha256 = sha256(rawBytes);
  let envelope;
  try {
    envelope = JSON.parse(utf8.decode(rawBytes));
  } catch {
    fail("invalid_export_json");
  }
  if (!exactKeys(envelope, ENVELOPE_KEYS)) fail("invalid_export_envelope");
  if (
    envelope.ok !== true ||
    envelope.scope !== "all" ||
    envelope.activeRunId !== ACTIVE_RUN_ID ||
    envelope.ledgerSchemaVersion !== "v1" ||
    !Array.isArray(envelope.events)
  ) {
    fail("invalid_export_envelope");
  }

  const ids = new Set();
  const distribution = Object.fromEntries(
    Object.keys(HISTORICAL_RUN_COUNTS).map((runId) => [runId, 0]),
  );
  let activeRunEventCount = 0;
  const records = envelope.events.map((event) => {
    if (!event || typeof event !== "object" || Array.isArray(event)) {
      fail("invalid_event");
    }
    const eventId = requiredString(event.id, "invalid_event_id");
    if (ids.has(eventId)) fail("duplicate_event_id");
    ids.add(eventId);
    const runId = requiredString(event.runId, "invalid_event_run_id");
    if (runId === ACTIVE_RUN_ID) activeRunEventCount += 1;
    else if (Object.hasOwn(HISTORICAL_RUN_COUNTS, runId)) {
      distribution[runId] += 1;
    } else fail("unknown_event_run_id");
    return {
      eventId,
      runId,
      eventType: requiredString(event.type, "invalid_event_type"),
      databaseEventTime: canonicalDatabaseEventTime(event.at),
      windowId: optionalWindowId(event),
      seedClassification: seedClassification(event),
      qualificationClassification: qualificationClassification(event),
    };
  });

  if (activeRunEventCount !== 0) fail("active_run_events_nonzero");
  if (records.length !== TOTAL_EVENT_COUNT) fail("unexpected_total_event_count");
  for (const [runId, expectedCount] of Object.entries(HISTORICAL_RUN_COUNTS)) {
    if (distribution[runId] !== expectedCount) {
      fail("unexpected_historical_run_count");
    }
  }
  records.sort((left, right) =>
    left.eventId < right.eventId ? -1 : left.eventId > right.eventId ? 1 : 0,
  );
  const projectionBytes = Buffer.from(
    `${records.map(canonicalRecord).join("\n")}\n`,
    "utf8",
  );
  return {
    rawSha256,
    eventCount: records.length,
    activeRunEventCount,
    wrongRunCount: records.length,
    runDistribution: distribution,
    projectionBytes,
    projectionDigest: sha256(projectionBytes),
  };
}

export function assertMatchingReads(left, right) {
  if (
    left.rawSha256 !== right.rawSha256 ||
    left.eventCount !== right.eventCount ||
    left.activeRunEventCount !== right.activeRunEventCount ||
    left.wrongRunCount !== right.wrongRunCount ||
    JSON.stringify(left.runDistribution) !== JSON.stringify(right.runDistribution) ||
    left.projectionDigest !== right.projectionDigest
  ) {
    fail("mismatched_export_reads");
  }
}

export function writeProjectionExclusive(outputPath, projectionBytes) {
  fs.writeFileSync(outputPath, projectionBytes, { flag: "wx", mode: 0o600 });
}

function inputFileIdentity(inputPath) {
  const realPath = fs.realpathSync.native(inputPath);
  const stat = fs.statSync(realPath);
  return {
    realPath:
      process.platform === "win32" ? realPath.toLowerCase() : realPath,
    dev: stat.dev,
    ino: stat.ino,
  };
}

function assertDistinctInputFiles(firstPath, secondPath) {
  const first = inputFileIdentity(firstPath);
  const second = inputFileIdentity(secondPath);
  const sameRealPath = first.realPath === second.realPath;
  const hasMeaningfulFileIds =
    Number.isSafeInteger(first.dev) &&
    Number.isSafeInteger(first.ino) &&
    Number.isSafeInteger(second.dev) &&
    Number.isSafeInteger(second.ino) &&
    first.ino !== 0 &&
    second.ino !== 0;
  const sameFileId =
    hasMeaningfulFileIds &&
    first.dev === second.dev &&
    first.ino === second.ino;
  if (sameRealPath || sameFileId) fail("baseline_reads_must_be_distinct_files");
}

function main(argv) {
  if (argv.length !== 3) {
    fail(
      "usage: window002-historical-projection <read-1.json> <read-2.json> <output.ndjson>",
    );
  }
  const [firstPath, secondPath, outputPath] = argv;
  assertDistinctInputFiles(firstPath, secondPath);
  const first = parseAndProject(fs.readFileSync(firstPath));
  const second = parseAndProject(fs.readFileSync(secondPath));
  assertMatchingReads(first, second);
  writeProjectionExclusive(outputPath, first.projectionBytes);
  process.stdout.write(
    `${JSON.stringify({
      rawExportSha256: first.rawSha256,
      canonicalEventProjectionSha256: first.projectionDigest,
      eventCount: first.eventCount,
      activeRunEventCount: first.activeRunEventCount,
      wrongRunCount: first.wrongRunCount,
      runDistribution: first.runDistribution,
    })}\n`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2));
}
