import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
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

import { reduceWindowEvents } from "../lib/reducer.js";
import { ACTIVE_RUN_ID } from "../scripts/window002-historical-projection.mjs";

const script = fileURLToPath(
  new URL("../scripts/window002-zero-baseline-v2.mjs", import.meta.url),
);
const originalRun = "ORIGIN-G2R-ACCEPTANCE";
const reacceptanceRun = "ORIGIN-G2R-UI-REACCEPTANCE-001";
const read1ObservedAtUtc = "2026-09-01T11:56:00.000Z";
const read2ObservedAtUtc = "2026-09-01T11:59:00.000Z";
const startUtc = "2026-09-01T12:00:00.000Z";
const endUtc = "2026-09-15T12:00:00.000Z";

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function exportFixture() {
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
    activeRunId: ACTIVE_RUN_ID,
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

function boundedResponse(envelope, mutateReduction) {
  const response = {
    ok: true,
    reduction: reduceWindowEvents(envelope.events.map(reducerEvent), {
      runId: ACTIVE_RUN_ID,
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

function prepareFixture({ mutateExport, mutateReduction } = {}) {
  const directory = mkdtempSync(path.join(os.tmpdir(), "window002-baseline-v2-"));
  const envelope = exportFixture();
  mutateExport?.(envelope);
  const reduction = boundedResponse(envelope, mutateReduction);
  const exportBody = jsonBytes(envelope);
  const reductionBody = jsonBytes(reduction);
  const files = {
    export1: path.join(directory, "read-1-export.json"),
    reduction1: path.join(directory, "read-1-reduction.json"),
    export2: path.join(directory, "read-2-export.json"),
    reduction2: path.join(directory, "read-2-reduction.json"),
    output: path.join(directory, "zero-baseline-v2.json"),
  };
  writeFileSync(files.export1, exportBody);
  writeFileSync(files.reduction1, reductionBody);
  writeFileSync(files.export2, exportBody);
  writeFileSync(files.reduction2, reductionBody);
  return { directory, files, exportBody, reductionBody };
}

function invoke(
  fixture,
  {
    export1 = fixture.files.export1,
    reduction1 = fixture.files.reduction1,
    observed1 = read1ObservedAtUtc,
    export2 = fixture.files.export2,
    reduction2 = fixture.files.reduction2,
    observed2 = read2ObservedAtUtc,
    start = startUtc,
    end = endUtc,
    output = fixture.files.output,
  } = {},
) {
  return spawnSync(
    process.execPath,
    [
      script,
      export1,
      reduction1,
      observed1,
      export2,
      reduction2,
      observed2,
      start,
      end,
      output,
    ],
    { encoding: "utf8" },
  );
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
    assert.equal(evidence.observedAtUtc, read2ObservedAtUtc);
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
    assert.equal(evidence.reads.read1.observedAtUtc, read1ObservedAtUtc);
    assert.equal(evidence.reads.read2.observedAtUtc, read2ObservedAtUtc);
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
        invoke(fixture, { reduction1: fixture.files.export1 }),
        "baseline_inputs_must_be_four_distinct_files",
      );
    } finally {
      rmSync(fixture.directory, { recursive: true, force: true });
    }
  });

  await t.test("semantically equal but byte-different export", () => {
    const fixture = prepareFixture();
    try {
      writeFileSync(fixture.files.export2, Buffer.concat([fixture.exportBody, Buffer.from(" ")]));
      assertFailed(invoke(fixture), "mismatched_export_reads");
    } finally {
      rmSync(fixture.directory, { recursive: true, force: true });
    }
  });

  await t.test("semantically equal but byte-different reduction", () => {
    const fixture = prepareFixture();
    try {
      writeFileSync(
        fixture.files.reduction2,
        Buffer.concat([fixture.reductionBody, Buffer.from(" ")]),
      );
      assertFailed(invoke(fixture), "mismatched_bounded_reduction_reads");
    } finally {
      rmSync(fixture.directory, { recursive: true, force: true });
    }
  });

  for (const [name, overrides, expected] of [
    [
      "noncanonical observation",
      { observed1: "2026-09-01T11:56:00Z" },
      "noncanonical_read1_observed_at_utc",
    ],
    [
      "non-increasing observations",
      { observed1: read2ObservedAtUtc },
      "baseline_observations_not_strictly_increasing",
    ],
    [
      "observation at start",
      { observed2: startUtc },
      "baseline_observations_must_precede_start",
    ],
    [
      "stale observations",
      { observed1: "2026-09-01T11:54:59.999Z" },
      "baseline_observations_not_recent",
    ],
    [
      "non-whole-hour start",
      {
        start: "2026-09-01T12:00:01.000Z",
        end: "2026-09-15T12:00:01.000Z",
      },
      "window_start_must_be_whole_hour_utc",
    ],
    [
      "non-14-day window",
      { end: "2026-09-15T11:59:59.999Z" },
      "window_must_be_exactly_14_days",
    ],
  ]) {
    await t.test(name, () => {
      const fixture = prepareFixture();
      try {
        assertFailed(invoke(fixture, overrides), expected);
      } finally {
        rmSync(fixture.directory, { recursive: true, force: true });
      }
    });
  }
});
