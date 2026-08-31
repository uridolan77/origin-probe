#!/usr/bin/env node

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { TextDecoder } from "node:util";

export const ACTIVE_RUN_ID = "ORIGIN-G2-PUBLIC-PROBE-AUTH-002";
export const PRE_ROTATION_SERVICE_RUN_ID =
  "ORIGIN-G2R-UI-REACCEPTANCE-001";
export const ALLOWED_SERVICE_RUN_IDS = Object.freeze([
  ACTIVE_RUN_ID,
  PRE_ROTATION_SERVICE_RUN_ID,
]);
export const HISTORICAL_RUN_COUNTS = Object.freeze({
  "ORIGIN-G2R-ACCEPTANCE": 16,
  "ORIGIN-G2R-UI-REACCEPTANCE-001": 21,
});
export const TOTAL_EVENT_COUNT = 37;

const MAX_EXPORT_BYTES = 5 * 1024 * 1024;

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

function assertUnicodeScalarString(value) {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        fail("invalid_json_unicode");
      }
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      fail("invalid_json_unicode");
    }
  }
}

function compareOrdinal(left, right) {
  const limit = Math.min(left.length, right.length);
  for (let index = 0; index < limit; index += 1) {
    const difference = left.charCodeAt(index) - right.charCodeAt(index);
    if (difference !== 0) return difference;
  }
  return left.length - right.length;
}

function canonicalJsonText(value, ancestors = new Set()) {
  if (value === null) return "null";
  if (typeof value === "string") {
    assertUnicodeScalarString(value);
    return JSON.stringify(value);
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (
      !Number.isFinite(value) ||
      Object.is(value, -0) ||
      (Number.isInteger(value) && !Number.isSafeInteger(value))
    ) {
      fail("ambiguous_json_number");
    }
    return JSON.stringify(value);
  }
  if (typeof value !== "object") fail("unsupported_json_value");
  if (ancestors.has(value)) fail("cyclic_json_value");
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype) {
        fail("unsupported_json_prototype");
      }
      const ownKeys = Reflect.ownKeys(value);
      if (
        ownKeys.some((key) => typeof key !== "string") ||
        ownKeys.length !== value.length + 1 ||
        !ownKeys.includes("length")
      ) {
        fail("unsupported_json_array_shape");
      }
      const items = [];
      for (let index = 0; index < value.length; index += 1) {
        const key = String(index);
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (
          !descriptor ||
          descriptor.enumerable !== true ||
          !("value" in descriptor)
        ) {
          fail("unsupported_json_array_shape");
        }
        items.push(canonicalJsonText(descriptor.value, ancestors));
      }
      return `[${items.join(",")}]`;
    }
    if (Object.getPrototypeOf(value) !== Object.prototype) {
      fail("unsupported_json_prototype");
    }
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.some((key) => typeof key !== "string")) {
      fail("unsupported_json_object_shape");
    }
    const entries = [];
    for (const key of ownKeys.sort(compareOrdinal)) {
      assertUnicodeScalarString(key);
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        descriptor.enumerable !== true ||
        !("value" in descriptor)
      ) {
        fail("unsupported_json_object_shape");
      }
      entries.push(
        `${JSON.stringify(key)}:${canonicalJsonText(descriptor.value, ancestors)}`,
      );
    }
    return `{${entries.join(",")}}`;
  } finally {
    ancestors.delete(value);
  }
}

export function canonicalEventRecordSha256(event) {
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    fail("invalid_event");
  }
  return sha256(Buffer.from(canonicalJsonText(event), "utf8"));
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
    eventRecordSha256: record.eventRecordSha256,
  });
}

export function parseAndProject(rawBytes, options = {}) {
  if (!Buffer.isBuffer(rawBytes)) fail("export_must_be_raw_bytes");
  if (
    !options ||
    typeof options !== "object" ||
    Array.isArray(options) ||
    Object.keys(options).some((key) => key !== "expectedServiceRunId")
  ) {
    fail("invalid_projection_options");
  }
  const expectedServiceRunId =
    options.expectedServiceRunId ?? ACTIVE_RUN_ID;
  if (!ALLOWED_SERVICE_RUN_IDS.includes(expectedServiceRunId)) {
    fail("invalid_expected_service_run_id");
  }
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
    envelope.activeRunId !== expectedServiceRunId ||
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
      eventRecordSha256: canonicalEventRecordSha256(event),
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

function comparablePath(value) {
  return process.platform === "win32" ? value.toLowerCase() : value;
}

function effectiveDeviceId(stat, realPath) {
  void realPath;
  return typeof stat.dev === "bigint" ? stat.dev : 0n;
}

function identityFromStat(stat, realPath) {
  return {
    dev: effectiveDeviceId(stat, realPath),
    ino: stat.ino,
  };
}

export function isUsableProjectionInputIdentity(identity) {
  return (
    identity !== null &&
    typeof identity === "object" &&
    typeof identity.dev === "bigint" &&
    typeof identity.ino === "bigint" &&
    identity.dev !== 0n &&
    identity.ino !== 0n
  );
}

function matchingInputStat(left, right) {
  return (
    left.isFile() &&
    right.isFile() &&
    typeof left.dev === "bigint" &&
    typeof right.dev === "bigint" &&
    typeof left.ino === "bigint" &&
    typeof right.ino === "bigint" &&
    (left.dev === 0n || right.dev === 0n || left.dev === right.dev) &&
    left.ino !== 0n &&
    right.ino !== 0n &&
    left.ino === right.ino &&
    left.size === right.size &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs
  );
}

function matchingProjectionDirectoryStat(left, right) {
  return (
    left.isDirectory() &&
    right.isDirectory() &&
    typeof left.dev === "bigint" &&
    typeof right.dev === "bigint" &&
    typeof left.ino === "bigint" &&
    typeof right.ino === "bigint" &&
    left.ino !== 0n &&
    right.ino !== 0n &&
    (left.dev === 0n || right.dev === 0n || left.dev === right.dev) &&
    left.ino === right.ino
  );
}

function matchingProjectionOutputStat(left, right, expectedSize) {
  return (
    left.isFile() &&
    right.isFile() &&
    typeof left.dev === "bigint" &&
    typeof right.dev === "bigint" &&
    typeof left.ino === "bigint" &&
    typeof right.ino === "bigint" &&
    left.ino !== 0n &&
    right.ino !== 0n &&
    (left.dev === 0n || right.dev === 0n || left.dev === right.dev) &&
    left.ino === right.ino &&
    left.size === expectedSize
  );
}

export function revalidateProjectionOutputParent(opened) {
  try {
    const link = fs.lstatSync(opened.requestedPath, { bigint: true });
    const pathStat = fs.statSync(opened.requestedPath, { bigint: true });
    const descriptorStat = fs.fstatSync(opened.descriptor, { bigint: true });
    const realPath = fs.realpathSync.native(opened.requestedPath);
    const descriptorIdentity = identityFromStat(descriptorStat, realPath);
    if (
      link.isSymbolicLink() ||
      !isUsableProjectionInputIdentity(descriptorIdentity) ||
      !matchingProjectionDirectoryStat(link, opened.stat) ||
      !matchingProjectionDirectoryStat(pathStat, opened.stat) ||
      !matchingProjectionDirectoryStat(descriptorStat, opened.stat) ||
      realPath !== opened.realPath
    ) {
      fail("projection_output_parent_identity_changed");
    }
  } catch (error) {
    if (
      String(error?.message || "") ===
      "projection_output_parent_identity_changed"
    ) {
      throw error;
    }
    fail("projection_output_parent_identity_changed");
  }
}

export function openProjectionOutputParent(outputPath) {
  let descriptor;
  try {
    const resolvedOutputPath = path.resolve(outputPath);
    const requestedPath = path.dirname(resolvedOutputPath);
    const outputName = path.basename(resolvedOutputPath);
    if (outputName.length === 0 || outputName === "." || outputName === "..") {
      fail("projection_output_path_invalid");
    }
    const link = fs.lstatSync(requestedPath, { bigint: true });
    if (link.isSymbolicLink()) {
      fail("projection_output_parent_reparse_or_symlink");
    }
    const realPath = fs.realpathSync.native(requestedPath);
    if (comparablePath(realPath) !== comparablePath(requestedPath)) {
      fail("projection_output_parent_reparse_or_symlink");
    }
    descriptor = fs.openSync(requestedPath, "r");
    const stat = fs.fstatSync(descriptor, { bigint: true });
    const pathStat = fs.statSync(requestedPath, { bigint: true });
    const identity = identityFromStat(stat, realPath);
    if (
      !isUsableProjectionInputIdentity(identity) ||
      !matchingProjectionDirectoryStat(link, stat) ||
      !matchingProjectionDirectoryStat(pathStat, stat)
    ) {
      fail("projection_output_parent_identity_unavailable");
    }
    const opened = {
      descriptor,
      requestedPath,
      realPath,
      stat,
      dev: stat.dev,
      ino: stat.ino,
      outputPath: path.join(realPath, outputName),
    };
    revalidateProjectionOutputParent(opened);
    return opened;
  } catch (error) {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    if (
      String(error?.message || "").startsWith("projection_output_parent_") ||
      String(error?.message || "") === "projection_output_path_invalid"
    ) {
      throw error;
    }
    fail("projection_output_parent_open_failed");
  }
}

function revalidateProjectionOutput(opened, expectedSize) {
  try {
    const link = fs.lstatSync(opened.path, { bigint: true });
    const pathStat = fs.statSync(opened.path, { bigint: true });
    const descriptorStat = fs.fstatSync(opened.descriptor, { bigint: true });
    const realPath = fs.realpathSync.native(opened.path);
    const descriptorIdentity = identityFromStat(descriptorStat, realPath);
    if (
      link.isSymbolicLink() ||
      !isUsableProjectionInputIdentity(descriptorIdentity) ||
      !matchingProjectionOutputStat(link, opened.stat, expectedSize) ||
      !matchingProjectionOutputStat(pathStat, opened.stat, expectedSize) ||
      !matchingProjectionOutputStat(descriptorStat, opened.stat, expectedSize) ||
      comparablePath(realPath) !== comparablePath(opened.realPath)
    ) {
      fail("projection_output_identity_changed");
    }
  } catch (error) {
    if (String(error?.message || "") === "projection_output_identity_changed") {
      throw error;
    }
    fail("projection_output_identity_changed");
  }
}

function writeProjectionWithHeldParent(
  outputParent,
  projectionBytes,
  { lifecycleHooks = {}, hookContext = {}, inputIdentities = [] } = {},
) {
  let descriptor;
  try {
    revalidateProjectionOutputParent(outputParent);
    descriptor = fs.openSync(outputParent.outputPath, "wx", 0o600);
    const stat = fs.fstatSync(descriptor, { bigint: true });
    const realPath = fs.realpathSync.native(outputParent.outputPath);
    const identity = identityFromStat(stat, realPath);
    if (!isUsableProjectionInputIdentity(identity)) {
      fail("projection_output_identity_unavailable");
    }
    const opened = {
      descriptor,
      path: outputParent.outputPath,
      realPath,
      stat,
    };
    revalidateProjectionOutput(opened, 0n);
    for (const input of inputIdentities) {
      if (
        comparablePath(realPath) === input.comparablePath ||
        (stat.dev === input.dev && stat.ino === input.ino)
      ) {
        fail("projection_output_must_be_distinct");
      }
    }
    let offset = 0;
    while (offset < projectionBytes.length) {
      const written = fs.writeSync(
        descriptor,
        projectionBytes,
        offset,
        projectionBytes.length - offset,
        offset,
      );
      if (written <= 0) fail("projection_output_short_write");
      offset += written;
    }
    lifecycleHooks.afterOutputWrite?.({
      ...hookContext,
      outputDescriptor: descriptor,
      outputParent,
      outputPath: outputParent.outputPath,
    });
    fs.fsyncSync(descriptor);
    lifecycleHooks.afterOutputFsync?.({
      ...hookContext,
      outputDescriptor: descriptor,
      outputParent,
      outputPath: outputParent.outputPath,
    });
    revalidateProjectionOutputParent(outputParent);
    revalidateProjectionOutput(opened, BigInt(projectionBytes.length));
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
}

export function writeProjectionExclusive(outputPath, projectionBytes) {
  const outputParent = openProjectionOutputParent(outputPath);
  try {
    writeProjectionWithHeldParent(outputParent, projectionBytes);
  } finally {
    fs.closeSync(outputParent.descriptor);
  }
}

export function revalidateProjectionInput(opened, code) {
  try {
    const link = fs.lstatSync(opened.requestedPath, { bigint: true });
    const pathStat = fs.statSync(opened.requestedPath, { bigint: true });
    const descriptorStat = fs.fstatSync(opened.descriptor, { bigint: true });
    const realPath = fs.realpathSync.native(opened.requestedPath);
    const identity = identityFromStat(descriptorStat, realPath);
    if (
      link.isSymbolicLink() ||
      !matchingInputStat(link, opened.stat) ||
      !matchingInputStat(pathStat, opened.stat) ||
      !matchingInputStat(descriptorStat, opened.stat) ||
      realPath !== opened.realPath ||
      !isUsableProjectionInputIdentity(identity) ||
      identity.dev !== opened.dev ||
      identity.ino !== opened.ino
    ) {
      fail(`${code}_identity_changed`);
    }
  } catch (error) {
    if (String(error?.message || "") === `${code}_identity_changed`) throw error;
    fail(`${code}_identity_changed`);
  }
}

export function openProjectionInput(inputPath, maximumBytes, code) {
  let descriptor;
  try {
    const requestedPath = path.resolve(inputPath);
    const link = fs.lstatSync(requestedPath, { bigint: true });
    if (link.isSymbolicLink()) fail(`${code}_reparse_or_symlink`);
    const realPath = fs.realpathSync.native(requestedPath);
    descriptor = fs.openSync(requestedPath, "r");
    const stat = fs.fstatSync(descriptor, { bigint: true });
    const pathStat = fs.statSync(requestedPath, { bigint: true });
    const identity = identityFromStat(stat, realPath);
    if (
      !stat.isFile() ||
      stat.size <= 0n ||
      stat.size > BigInt(maximumBytes)
    ) {
      fail(`${code}_size_invalid`);
    }
    if (!isUsableProjectionInputIdentity(identity)) {
      fail(`${code}_identity_unavailable`);
    }
    if (
      !matchingInputStat(link, stat) ||
      !matchingInputStat(pathStat, stat)
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
      dev: identity.dev,
      ino: identity.ino,
      bytes,
    };
    revalidateProjectionInput(opened, code);
    return opened;
  } catch (error) {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    if (String(error?.message || "").startsWith(code)) throw error;
    fail(`${code}_open_failed`);
  }
}

export function assertDistinctProjectionInputs(inputs) {
  if (!inputs.every(isUsableProjectionInputIdentity)) {
    fail("projection_input_file_identity_unavailable");
  }
  for (let left = 0; left < inputs.length; left += 1) {
    for (let right = left + 1; right < inputs.length; right += 1) {
      const first = inputs[left];
      const second = inputs[right];
      if (
        first.comparablePath === second.comparablePath ||
        (first.dev === second.dev && first.ino === second.ino)
      ) {
        fail("baseline_reads_must_be_distinct_files");
      }
    }
  }
}

function closeProjectionInputs(inputs) {
  for (const input of inputs) {
    try {
      fs.closeSync(input.descriptor);
    } catch {}
  }
}

export function main(
  argv,
  { emitSummary = true, lifecycleHooks = {} } = {},
) {
  if (argv.length !== 3 && argv.length !== 4) {
    fail(
      "usage: window002-historical-projection [expected-service-run-id] <read-1.json> <read-2.json> <output.ndjson>",
    );
  }
  const expectedServiceRunId = argv.length === 4 ? argv[0] : ACTIVE_RUN_ID;
  if (!ALLOWED_SERVICE_RUN_IDS.includes(expectedServiceRunId)) {
    fail("invalid_expected_service_run_id");
  }
  const [firstPath, secondPath, outputPath] = argv.slice(-3);
  const openedInputs = [];
  let outputParent;
  try {
    const firstInput = openProjectionInput(
      firstPath,
      MAX_EXPORT_BYTES,
      "baseline_read_1",
    );
    openedInputs.push(firstInput);
    const secondInput = openProjectionInput(
      secondPath,
      MAX_EXPORT_BYTES,
      "baseline_read_2",
    );
    openedInputs.push(secondInput);
    assertDistinctProjectionInputs(openedInputs);
    const first = parseAndProject(firstInput.bytes, { expectedServiceRunId });
    const second = parseAndProject(secondInput.bytes, { expectedServiceRunId });
    assertMatchingReads(first, second);
    for (const opened of openedInputs) {
      revalidateProjectionInput(opened, "baseline_read");
    }
    outputParent = openProjectionOutputParent(outputPath);
    for (const opened of openedInputs) {
      if (comparablePath(outputParent.outputPath) === opened.comparablePath) {
        fail("projection_output_must_be_distinct");
      }
    }
    const hookContext = {
      firstInput,
      secondInput,
      outputParent,
      outputPath: outputParent.outputPath,
    };
    lifecycleHooks.beforeOutputWrite?.(hookContext);
    lifecycleHooks.beforeOutputCreate?.(hookContext);
    for (const [index, opened] of openedInputs.entries()) {
      revalidateProjectionInput(opened, `baseline_read_${index + 1}`);
    }
    revalidateProjectionOutputParent(outputParent);
    writeProjectionWithHeldParent(outputParent, first.projectionBytes, {
      lifecycleHooks,
      hookContext,
      inputIdentities: openedInputs,
    });
    for (const [index, opened] of openedInputs.entries()) {
      revalidateProjectionInput(opened, `baseline_read_${index + 1}`);
    }
    revalidateProjectionOutputParent(outputParent);
    const summary = {
      rawExportSha256: first.rawSha256,
      canonicalEventProjectionSha256: first.projectionDigest,
      eventCount: first.eventCount,
      activeRunEventCount: first.activeRunEventCount,
      wrongRunCount: first.wrongRunCount,
      runDistribution: first.runDistribution,
      serviceActiveRunId: expectedServiceRunId,
    };
    if (emitSummary) process.stdout.write(`${JSON.stringify(summary)}\n`);
    return summary;
  } finally {
    if (outputParent !== undefined) {
      try {
        fs.closeSync(outputParent.descriptor);
      } catch {}
    }
    closeProjectionInputs(openedInputs);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2));
}
