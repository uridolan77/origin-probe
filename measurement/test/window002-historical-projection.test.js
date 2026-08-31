import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  fstatSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  ACTIVE_RUN_ID,
  PRE_ROTATION_SERVICE_RUN_ID,
  assertDistinctProjectionInputs,
  assertMatchingReads,
  canonicalEventRecordSha256,
  isUsableProjectionInputIdentity,
  main,
  parseAndProject,
} from "../scripts/window002-historical-projection.mjs";

const script = fileURLToPath(
  new URL("../scripts/window002-historical-projection.mjs", import.meta.url),
);
const originalRun = "ORIGIN-G2R-ACCEPTANCE";
const reacceptanceRun = "ORIGIN-G2R-UI-REACCEPTANCE-001";

function exportFixture(activeRunId = ACTIVE_RUN_ID) {
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
    activeRunId,
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

function reordered(value) {
  if (Array.isArray(value)) return value.map(reordered);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .reverse()
      .map(([key, child]) => [key, reordered(child)]),
  );
}

function recordFor(projection, eventId) {
  return projection.projectionBytes
    .toString("utf8")
    .trimEnd()
    .split("\n")
    .map((line) => JSON.parse(line))
    .find((record) => record.eventId === eventId);
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
  assert.match(text, /"eventRecordSha256":"[a-f0-9]{64}"/);
  const ids = text
    .trimEnd()
    .split("\n")
    .map((line) => JSON.parse(line).eventId);
  assert.deepEqual(ids, [...ids].sort());
});

test("whole-event digests are key-order invariant and bind omitted private fields", () => {
  const baselineValue = exportFixture();
  baselineValue.events[0].slug = "culture-eats-strategy-for-breakfast";
  baselineValue.events[0].clientHash = "private-client-hash";
  baselineValue.events[0].payload = {
    privateNested: { z: true, a: [null, "value", 7.25] },
    source: "operator",
  };
  const baseline = parseAndProject(bytes(baselineValue));
  const reorderedProjection = parseAndProject(bytes(reordered(baselineValue)));
  assert.equal(baseline.projectionDigest, reorderedProjection.projectionDigest);
  assert.equal(
    recordFor(baseline, baselineValue.events[0].id).eventRecordSha256,
    recordFor(reorderedProjection, baselineValue.events[0].id).eventRecordSha256,
  );

  for (const mutate of [
    (event) => { event.slug = "different-slug"; },
    (event) => { event.clientHash = "different-private-client-hash"; },
    (event) => { event.payload.privateNested.a[1] = "different"; },
    (event) => { event.payload.added = false; },
    (event) => { delete event.payload.source; },
  ]) {
    const changedValue = structuredClone(baselineValue);
    mutate(changedValue.events[0]);
    const changed = parseAndProject(bytes(changedValue));
    assert.notEqual(changed.projectionDigest, baseline.projectionDigest);
    assert.notEqual(
      recordFor(changed, baselineValue.events[0].id).eventRecordSha256,
      recordFor(baseline, baselineValue.events[0].id).eventRecordSha256,
    );
    assert.throws(
      () => assertMatchingReads(baseline, changed),
      /mismatched_export_reads/,
    );
  }

  const publicRecord = recordFor(baseline, baselineValue.events[0].id);
  assert.deepEqual(Object.keys(publicRecord).sort(), [
    "databaseEventTime",
    "eventId",
    "eventRecordSha256",
    "eventType",
    "qualificationClassification",
    "runId",
    "seedClassification",
    "windowId",
  ]);
  const publicText = JSON.stringify(publicRecord);
  assert.equal(publicText.includes("private-client-hash"), false);
  assert.equal(publicText.includes("privateNested"), false);
  assert.equal(publicText.includes("operator"), false);
});

test("whole-event canonicalization preserves JSON types and Unicode exactly", () => {
  const base = {
    id: "event",
    runId: originalRun,
    type: "result_view",
    at: "2026-08-30T16:00:00.000Z",
  };
  const left = {
    ...base,
    payload: { "é": "composed", "😀": "astral", a: [true, null, 0] },
  };
  const right = {
    payload: { a: [true, null, 0], "😀": "astral", "é": "composed" },
    at: base.at,
    type: base.type,
    runId: base.runId,
    id: base.id,
  };
  assert.equal(
    canonicalEventRecordSha256(left),
    canonicalEventRecordSha256(right),
  );
  const decomposed = structuredClone(left);
  decomposed.payload["e\u0301"] = decomposed.payload["é"];
  delete decomposed.payload["é"];
  assert.notEqual(
    canonicalEventRecordSha256(left),
    canonicalEventRecordSha256(decomposed),
  );

  const typeDigests = [null, false, 0, "0", [], {}].map((value) =>
    canonicalEventRecordSha256({ ...base, payload: value }),
  );
  assert.equal(new Set(typeDigests).size, typeDigests.length);
});

test("whole-event canonicalization rejects ambiguous numbers, invalid Unicode, and non-JSON shapes", async (t) => {
  const base = {
    id: "event",
    runId: originalRun,
    type: "result_view",
    at: "2026-08-30T16:00:00.000Z",
  };
  assert.doesNotThrow(() =>
    canonicalEventRecordSha256({
      ...base,
      payload: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, 7.25],
    }),
  );
  for (const [name, value, expected] of [
    ["unsafe positive integer", Number.MAX_SAFE_INTEGER + 1, "ambiguous_json_number"],
    ["unsafe negative integer", Number.MIN_SAFE_INTEGER - 1, "ambiguous_json_number"],
    ["negative zero", -0, "ambiguous_json_number"],
    ["NaN", Number.NaN, "ambiguous_json_number"],
    ["positive infinity", Number.POSITIVE_INFINITY, "ambiguous_json_number"],
    ["undefined", undefined, "unsupported_json_value"],
    ["bigint", 1n, "unsupported_json_value"],
    ["lone high surrogate", "\ud800", "invalid_json_unicode"],
    ["lone low surrogate", "\udc00", "invalid_json_unicode"],
  ]) {
    await t.test(name, () => {
      assert.throws(
        () => canonicalEventRecordSha256({ ...base, payload: value }),
        new RegExp(expected),
      );
    });
  }

  await t.test("invalid Unicode object key", () => {
    assert.throws(
      () => canonicalEventRecordSha256({ ...base, ["\ud800"]: true }),
      /invalid_json_unicode/,
    );
  });
  await t.test("custom prototype", () => {
    const value = Object.assign(Object.create({ inherited: true }), base);
    assert.throws(
      () => canonicalEventRecordSha256(value),
      /unsupported_json_prototype/,
    );
  });
  await t.test("accessor", () => {
    const value = { ...base };
    Object.defineProperty(value, "payload", {
      enumerable: true,
      get() {
        throw new Error("getter_must_not_run");
      },
    });
    assert.throws(
      () => canonicalEventRecordSha256(value),
      /unsupported_json_object_shape/,
    );
  });
  await t.test("sparse array", () => {
    const payload = [];
    payload.length = 1;
    assert.throws(
      () => canonicalEventRecordSha256({ ...base, payload }),
      /unsupported_json_array_shape/,
    );
  });
  await t.test("cyclic object", () => {
    const value = { ...base };
    value.payload = value;
    assert.throws(
      () => canonicalEventRecordSha256(value),
      /cyclic_json_value/,
    );
  });

  const unsafeFixture = exportFixture();
  unsafeFixture.events[0].payload = { unsafe: Number.MAX_SAFE_INTEGER + 1 };
  assert.throws(
    () => parseAndProject(bytes(unsafeFixture)),
    /ambiguous_json_number/,
  );
});

test("projects identical history under the explicit pre-rotation service run", () => {
  const active = parseAndProject(bytes(exportFixture()));
  const preRotation = parseAndProject(
    bytes(exportFixture(PRE_ROTATION_SERVICE_RUN_ID)),
    { expectedServiceRunId: PRE_ROTATION_SERVICE_RUN_ID },
  );
  assert.equal(preRotation.eventCount, 37);
  assert.equal(preRotation.activeRunEventCount, 0);
  assert.equal(preRotation.wrongRunCount, 37);
  assert.equal(preRotation.projectionDigest, active.projectionDigest);
  assert.notEqual(preRotation.rawSha256, active.rawSha256);
  assert.throws(
    () =>
      parseAndProject(bytes(exportFixture(PRE_ROTATION_SERVICE_RUN_ID)), {
        expectedServiceRunId: ACTIVE_RUN_ID,
      }),
    /invalid_export_envelope/,
  );
  assert.throws(
    () =>
      parseAndProject(bytes(exportFixture()), {
        expectedServiceRunId: "UNRECOGNIZED-SERVICE-RUN",
      }),
    /invalid_expected_service_run_id/,
  );
  assert.throws(
    () => parseAndProject(bytes(exportFixture()), { extra: true }),
    /invalid_projection_options/,
  );
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
    assert.equal(repeatedRead.stdout, "");
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
      "serviceActiveRunId",
      "wrongRunCount",
    ]);
    assert.equal(summary.serviceActiveRunId, ACTIVE_RUN_ID);
    assert.equal(readFileSync(output).toString("utf8"), first.projectionBytes.toString("utf8"));
    const replay = spawnSync(process.execPath, [script, read1, read2, output], {
      encoding: "utf8",
    });
    assert.notEqual(replay.status, 0, "existing projection must not be overwritten");
    assert.equal(replay.stdout, "");

    const preRead1 = path.join(temporary, "pre-read-1.json");
    const preRead2 = path.join(temporary, "pre-read-2.json");
    const preOutput = path.join(temporary, "pre-history.ndjson");
    writeFileSync(preRead1, bytes(exportFixture(PRE_ROTATION_SERVICE_RUN_ID)));
    writeFileSync(preRead2, bytes(exportFixture(PRE_ROTATION_SERVICE_RUN_ID)));
    const preRotation = spawnSync(
      process.execPath,
      [
        script,
        PRE_ROTATION_SERVICE_RUN_ID,
        preRead1,
        preRead2,
        preOutput,
      ],
      { encoding: "utf8" },
    );
    assert.equal(preRotation.status, 0, preRotation.stderr);
    assert.equal(
      JSON.parse(preRotation.stdout).serviceActiveRunId,
      PRE_ROTATION_SERVICE_RUN_ID,
    );
    assert.equal(
      readFileSync(preOutput).toString("utf8"),
      first.projectionBytes.toString("utf8"),
    );
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});

test("descriptor custody rejects hardlinks, unavailable IDs, and pathname swaps", async (t) => {
  await t.test("hardlink inputs", () => {
    const temporary = mkdtempSync(path.join(os.tmpdir(), "window002-hardlink-"));
    try {
      const read1 = path.join(temporary, "read-1.json");
      const read2 = path.join(temporary, "read-2.json");
      const output = path.join(temporary, "history.ndjson");
      writeFileSync(read1, bytes(exportFixture()));
      linkSync(read1, read2);
      const result = spawnSync(process.execPath, [script, read1, read2, output], {
        encoding: "utf8",
      });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /baseline_reads_must_be_distinct_files/);
      assert.equal(result.stdout, "");
      assert.equal(existsSync(output), false);
    } finally {
      rmSync(temporary, { recursive: true, force: true });
    }
  });

  await t.test("zero or unavailable identity", () => {
    assert.equal(
      isUsableProjectionInputIdentity({ dev: 0n, ino: 1n }),
      false,
    );
    assert.equal(
      isUsableProjectionInputIdentity({ dev: 1n, ino: 0n }),
      false,
    );
    assert.equal(
      isUsableProjectionInputIdentity({ dev: undefined, ino: 1n }),
      false,
    );
    assert.throws(
      () =>
        assertDistinctProjectionInputs([
          { comparablePath: "one", dev: 0n, ino: 1n },
          { comparablePath: "two", dev: 1n, ino: 2n },
        ]),
      /projection_input_file_identity_unavailable/,
    );
  });

  await t.test("input pathname replacement before output", () => {
    const temporary = mkdtempSync(path.join(os.tmpdir(), "window002-swap-"));
    try {
      const read1 = path.join(temporary, "read-1.json");
      const read2 = path.join(temporary, "read-2.json");
      const moved = path.join(temporary, "read-1-original.json");
      const output = path.join(temporary, "history.ndjson");
      writeFileSync(read1, bytes(exportFixture()));
      writeFileSync(read2, bytes(exportFixture()));
      assert.throws(
        () =>
          main([read1, read2, output], {
            emitSummary: false,
            lifecycleHooks: {
              beforeOutputWrite() {
                renameSync(read1, moved);
                writeFileSync(read1, bytes(exportFixture()), { flag: "wx" });
              },
            },
          }),
        /baseline_read_1_identity_changed/,
      );
      assert.equal(existsSync(output), false);
    } finally {
      rmSync(temporary, { recursive: true, force: true });
    }
  });

  await t.test("input pathname replacement after exclusive output emits no summary", () => {
    const temporary = mkdtempSync(path.join(os.tmpdir(), "window002-post-swap-"));
    const originalWrite = process.stdout.write;
    let emitted = "";
    try {
      const read1 = path.join(temporary, "read-1.json");
      const read2 = path.join(temporary, "read-2.json");
      const moved = path.join(temporary, "read-2-original.json");
      const output = path.join(temporary, "history.ndjson");
      writeFileSync(read1, bytes(exportFixture()));
      writeFileSync(read2, bytes(exportFixture()));
      process.stdout.write = (chunk) => {
        emitted += String(chunk);
        return true;
      };
      assert.throws(
        () =>
          main([read1, read2, output], {
            lifecycleHooks: {
              afterOutputWrite() {
                renameSync(read2, moved);
                writeFileSync(read2, bytes(exportFixture()), { flag: "wx" });
              },
            },
          }),
        /baseline_read_2_identity_changed/,
      );
      assert.equal(existsSync(output), true);
      assert.equal(emitted, "");
    } finally {
      process.stdout.write = originalWrite;
      rmSync(temporary, { recursive: true, force: true });
    }
  });

  await t.test("output parent replacement before exclusive create emits no summary", () => {
    const temporary = mkdtempSync(path.join(os.tmpdir(), "window002-parent-pre-"));
    const originalWrite = process.stdout.write;
    let emitted = "";
    try {
      const read1 = path.join(temporary, "read-1.json");
      const read2 = path.join(temporary, "read-2.json");
      const outputParent = path.join(temporary, "output");
      const movedParent = path.join(temporary, "output-original");
      const output = path.join(outputParent, "history.ndjson");
      writeFileSync(read1, bytes(exportFixture()));
      writeFileSync(read2, bytes(exportFixture()));
      mkdirSync(outputParent);
      process.stdout.write = (chunk) => {
        emitted += String(chunk);
        return true;
      };
      assert.throws(
        () =>
          main([read1, read2, output], {
            lifecycleHooks: {
              beforeOutputCreate({ outputParent: heldParent }) {
                assert.equal(fstatSync(heldParent.descriptor).isDirectory(), true);
                renameSync(outputParent, movedParent);
                mkdirSync(outputParent);
              },
            },
          }),
        /projection_output_parent_identity_changed/,
      );
      assert.equal(emitted, "");
      assert.equal(existsSync(output), false);
      assert.equal(existsSync(path.join(movedParent, "history.ndjson")), false);
    } finally {
      process.stdout.write = originalWrite;
      rmSync(temporary, { recursive: true, force: true });
    }
  });

  await t.test("output parent reparse replacement before create fails closed", () => {
    const temporary = mkdtempSync(path.join(os.tmpdir(), "window002-parent-link-"));
    try {
      const read1 = path.join(temporary, "read-1.json");
      const read2 = path.join(temporary, "read-2.json");
      const outputParent = path.join(temporary, "output");
      const movedParent = path.join(temporary, "output-original");
      const output = path.join(outputParent, "history.ndjson");
      writeFileSync(read1, bytes(exportFixture()));
      writeFileSync(read2, bytes(exportFixture()));
      mkdirSync(outputParent);
      assert.throws(
        () =>
          main([read1, read2, output], {
            emitSummary: false,
            lifecycleHooks: {
              beforeOutputCreate() {
                renameSync(outputParent, movedParent);
                symlinkSync(
                  movedParent,
                  outputParent,
                  process.platform === "win32" ? "junction" : "dir",
                );
              },
            },
          }),
        /projection_output_parent_identity_changed/,
      );
      assert.equal(existsSync(output), false);
    } finally {
      rmSync(temporary, { recursive: true, force: true });
    }
  });

  await t.test("output parent replacement after fsync emits no summary", () => {
    const temporary = mkdtempSync(path.join(os.tmpdir(), "window002-parent-post-"));
    const originalWrite = process.stdout.write;
    let emitted = "";
    try {
      const read1 = path.join(temporary, "read-1.json");
      const read2 = path.join(temporary, "read-2.json");
      const outputParent = path.join(temporary, "output");
      const movedParent = path.join(temporary, "output-original");
      const output = path.join(outputParent, "history.ndjson");
      const expected = parseAndProject(bytes(exportFixture())).projectionBytes;
      writeFileSync(read1, bytes(exportFixture()));
      writeFileSync(read2, bytes(exportFixture()));
      mkdirSync(outputParent);
      process.stdout.write = (chunk) => {
        emitted += String(chunk);
        return true;
      };
      assert.throws(
        () =>
          main([read1, read2, output], {
            lifecycleHooks: {
              afterOutputFsync({ outputDescriptor, outputParent: heldParent }) {
                assert.equal(fstatSync(outputDescriptor).size, expected.length);
                assert.equal(fstatSync(heldParent.descriptor).isDirectory(), true);
                renameSync(outputParent, movedParent);
                mkdirSync(outputParent);
              },
            },
          }),
        process.platform === "win32"
          ? /EPERM|EACCES/
          : /projection_output_parent_identity_changed/,
      );
      assert.equal(emitted, "");
      if (process.platform === "win32") {
        assert.deepEqual(readFileSync(output), expected);
        assert.equal(existsSync(movedParent), false);
      } else {
        assert.equal(existsSync(output), false);
        assert.deepEqual(
          readFileSync(path.join(movedParent, "history.ndjson")),
          expected,
        );
      }
    } finally {
      process.stdout.write = originalWrite;
      rmSync(temporary, { recursive: true, force: true });
    }
  });

  await t.test("output pathname replacement after fsync emits no summary", () => {
    const temporary = mkdtempSync(path.join(os.tmpdir(), "window002-output-post-"));
    const originalWrite = process.stdout.write;
    let emitted = "";
    try {
      const read1 = path.join(temporary, "read-1.json");
      const read2 = path.join(temporary, "read-2.json");
      const outputParent = path.join(temporary, "output");
      const output = path.join(outputParent, "history.ndjson");
      const movedOutput = path.join(outputParent, "history-original.ndjson");
      writeFileSync(read1, bytes(exportFixture()));
      writeFileSync(read2, bytes(exportFixture()));
      mkdirSync(outputParent);
      process.stdout.write = (chunk) => {
        emitted += String(chunk);
        return true;
      };
      assert.throws(
        () =>
          main([read1, read2, output], {
            lifecycleHooks: {
              afterOutputFsync({ outputDescriptor }) {
                assert.equal(fstatSync(outputDescriptor).isFile(), true);
                renameSync(output, movedOutput);
                writeFileSync(output, "replacement", { flag: "wx" });
              },
            },
          }),
        /projection_output_identity_changed/,
      );
      assert.equal(emitted, "");
    } finally {
      process.stdout.write = originalWrite;
      rmSync(temporary, { recursive: true, force: true });
    }
  });
});
