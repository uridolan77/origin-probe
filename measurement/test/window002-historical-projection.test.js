import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  ACTIVE_RUN_ID,
  assertMatchingReads,
  parseAndProject,
} from "../scripts/window002-historical-projection.mjs";

const script = fileURLToPath(
  new URL("../scripts/window002-historical-projection.mjs", import.meta.url),
);
const originalRun = "ORIGIN-G2R-ACCEPTANCE";
const reacceptanceRun = "ORIGIN-G2R-UI-REACCEPTANCE-001";

function exportFixture() {
  const events = [];
  for (const [runId, count] of [
    [originalRun, 16],
    [reacceptanceRun, 21],
  ]) {
    for (let index = 0; index < count; index += 1) {
      const type = [
        "result_view",
        "qualified_result_view",
        "share_created",
        "propagated_visit",
        "qualified_propagation",
      ][index % 5];
      const event = {
        id: `${runId}-${String(index).padStart(2, "0")}`,
        runId,
        type,
        at: `2026-08-30T16:${String(index).padStart(2, "0")}:00.000Z`,
        exclusions: index === 3 ? ["seed_token_excluded"] : [],
      };
      if (index === 0) event.seed = true;
      if (index === 1) event.seed = false;
      if (index === 2) event.payload = { windowId: "ORIGIN_G2_WINDOW_001" };
      events.push(event);
    }
  }
  return {
    ok: true,
    scope: "all",
    activeRunId: ACTIVE_RUN_ID,
    events,
    ledgerSchemaVersion: "v1",
  };
}

function bytes(value, suffix = "") {
  return Buffer.from(`${JSON.stringify(value)}${suffix}`, "utf8");
}

function rejects(mutator, expected) {
  const value = exportFixture();
  mutator(value);
  assert.throws(() => parseAndProject(bytes(value)), new RegExp(expected));
}

test("projects the exact recognized 16/21 history deterministically", () => {
  const projection = parseAndProject(bytes(exportFixture()));
  assert.equal(projection.eventCount, 37);
  assert.equal(projection.activeRunEventCount, 0);
  assert.equal(projection.wrongRunCount, 37);
  assert.deepEqual(projection.runDistribution, {
    [originalRun]: 16,
    [reacceptanceRun]: 21,
  });
  const text = projection.projectionBytes.toString("utf8");
  assert.match(text, /"seedClassification":"seed"/);
  assert.match(text, /"seedClassification":"non_seed"/);
  assert.match(text, /"seedClassification":null/);
  assert.match(text, /"qualificationClassification":"qualified"/);
  assert.match(
    text,
    /"qualificationClassification":"excluded:seed_token_excluded"/,
  );
  assert.match(text, /"windowId":"ORIGIN_G2_WINDOW_001"/);
  const ids = text
    .trimEnd()
    .split("\n")
    .map((line) => JSON.parse(line).eventId);
  assert.deepEqual(ids, [...ids].sort());
});

test("rejects malformed, active-run, unknown, duplicate, and drifting history", () => {
  rejects((value) => {
    value.extra = true;
  }, "invalid_export_envelope");
  rejects((value) => {
    value.activeRunId = "LEGACY";
  }, "invalid_export_envelope");
  rejects((value) => {
    value.events[1].id = value.events[0].id;
  }, "duplicate_event_id");
  rejects((value) => {
    value.events[0].runId = "UNKNOWN";
  }, "unknown_event_run_id");
  rejects((value) => {
    value.events[0].runId = ACTIVE_RUN_ID;
  }, "active_run_events_nonzero");
  rejects((value) => {
    value.events.push({ ...value.events[0], id: "thirty-eighth" });
  }, "unexpected_total_event_count");
  rejects((value) => {
    value.events[0].runId = reacceptanceRun;
  }, "unexpected_historical_run_count");
  rejects((value) => {
    value.events[0].at = "2026-08-30T16:00:00Z";
  }, "noncanonical_event_timestamp");
  rejects((value) => {
    value.events[0].seed = "true";
  }, "invalid_event_seed");
  rejects((value) => {
    value.events[0].exclusions = [""];
  }, "invalid_event_exclusions");
  rejects((value) => {
    value.events[2].windowId = "OTHER_WINDOW";
  }, "conflicting_event_window_id");
  assert.throws(
    () => parseAndProject(Buffer.from([0xff, 0xfe, 0xfd])),
    /invalid_export_json/,
  );
});

test("requires byte-identical consecutive reads and exclusive output", () => {
  const first = parseAndProject(bytes(exportFixture()));
  const second = parseAndProject(bytes(exportFixture()));
  assertMatchingReads(first, second);
  const whitespaceVariant = parseAndProject(bytes(exportFixture(), " "));
  assert.equal(first.projectionDigest, whitespaceVariant.projectionDigest);
  assert.throws(
    () => assertMatchingReads(first, whitespaceVariant),
    /mismatched_export_reads/,
  );

  const temporary = mkdtempSync(path.join(os.tmpdir(), "window002-projection-"));
  try {
    const read1 = path.join(temporary, "read-1.json");
    const read2 = path.join(temporary, "read-2.json");
    const output = path.join(temporary, "history.ndjson");
    writeFileSync(read1, bytes(exportFixture()));
    writeFileSync(read2, bytes(exportFixture()));
    const repeatedRead = spawnSync(
      process.execPath,
      [script, read1, read1, path.join(temporary, "same-read.ndjson")],
      { encoding: "utf8" },
    );
    assert.notEqual(repeatedRead.status, 0);
    assert.match(
      repeatedRead.stderr,
      /baseline_reads_must_be_distinct_files/,
    );
    const result = spawnSync(process.execPath, [script, read1, read2, output], {
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    const summary = JSON.parse(result.stdout);
    assert.deepEqual(Object.keys(summary).sort(), [
      "activeRunEventCount",
      "canonicalEventProjectionSha256",
      "eventCount",
      "rawExportSha256",
      "runDistribution",
      "wrongRunCount",
    ]);
    assert.equal(readFileSync(output).toString("utf8"), first.projectionBytes.toString("utf8"));
    const replay = spawnSync(process.execPath, [script, read1, read2, output], {
      encoding: "utf8",
    });
    assert.notEqual(replay.status, 0, "existing projection must not be overwritten");
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});
