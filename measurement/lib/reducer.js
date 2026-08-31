/**
 * Deterministic reducers over accepted measurement events.
 *
 * This module intentionally has no runtime or storage dependencies so its exact
 * bytes can be pinned as the Window 002 reducer artifact.
 */

const UTC_TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

function timestampMs(value) {
  if (typeof value !== "string" || !UTC_TIMESTAMP.test(value)) return null;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return null;
  const expanded = value.endsWith("Z") && !value.includes(".")
    ? `${value.slice(0, -1)}.000Z`
    : value;
  return new Date(ms).toISOString() === expanded ? ms : null;
}

function requireBoundary(value, name) {
  const ms = timestampMs(value);
  if (ms === null) throw new TypeError(`invalid_${name}`);
  return ms;
}

function requireNonemptyString(value, reason) {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(reason);
  }
}

function requireLineageMatch(qualified, raw, field) {
  if (qualified[field] !== raw[field]) {
    throw new TypeError(
      `qualified_lineage_mismatch:${qualified.id}:${field}`,
    );
  }
}

function validateQualifiedLineage(validated) {
  const byId = new Map(
    validated.map(({ event, atMs }) => [event.id, { event, atMs }]),
  );
  const derivedRawIds = new Set();
  for (const { event: qualified, atMs } of validated) {
    if (
      qualified.type !== "qualified_result_view" &&
      qualified.type !== "qualified_propagation"
    ) {
      continue;
    }
    const rawEntry = byId.get(qualified.derivedFrom);
    if (!rawEntry) {
      throw new TypeError(`qualified_lineage_missing:${qualified.id}`);
    }
    if (derivedRawIds.has(qualified.derivedFrom)) {
      throw new TypeError(
        `qualified_lineage_duplicate:${qualified.derivedFrom}`,
      );
    }
    derivedRawIds.add(qualified.derivedFrom);
    const { event: raw, atMs: rawAtMs } = rawEntry;
    const expectedRawType =
      qualified.type === "qualified_result_view"
        ? "result_view"
        : "propagated_visit";
    if (raw.type !== expectedRawType) {
      throw new TypeError(`qualified_lineage_type:${qualified.id}`);
    }
    if (rawAtMs > atMs) {
      throw new TypeError(`qualified_lineage_time:${qualified.id}`);
    }
    requireLineageMatch(qualified, raw, "runId");
    requireLineageMatch(qualified, raw, "slug");
    requireLineageMatch(qualified, raw, "clientHash");
    if (Array.isArray(raw.exclusions) && raw.exclusions.length > 0) {
      throw new TypeError(`qualified_lineage_excluded_raw:${qualified.id}`);
    }
    if (qualified.type === "qualified_propagation") {
      requireLineageMatch(qualified, raw, "creatorHash");
      requireLineageMatch(qualified, raw, "shareTokenFingerprint");
      if (raw.seed !== false) {
        throw new TypeError(`qualified_lineage_seed:${qualified.id}`);
      }
    }
  }
}

function validateAndSortEvents(events) {
  if (!Array.isArray(events)) throw new TypeError("events_must_be_an_array");
  const ids = new Set();
  const validated = events.map((event) => {
    if (!event || typeof event !== "object") {
      throw new TypeError("malformed_event");
    }
    requireNonemptyString(event.id, "missing_event_id");
    if (ids.has(event.id)) throw new TypeError(`duplicate_event_id:${event.id}`);
    ids.add(event.id);
    requireNonemptyString(event.runId, `missing_run_id:${event.id}`);
    requireNonemptyString(event.type, `missing_event_type:${event.id}`);
    const atMs = timestampMs(event.at);
    if (atMs === null) {
      throw new TypeError(`invalid_event_timestamp:${event.id}`);
    }
    if (
      event.exclusions !== undefined &&
      (!Array.isArray(event.exclusions) ||
        event.exclusions.some(
          (reason) => typeof reason !== "string" || reason.length === 0,
        ))
    ) {
      throw new TypeError(`invalid_event_exclusions:${event.id}`);
    }
    if (event.type === "qualified_result_view") {
      requireNonemptyString(
        event.slug,
        `malformed_qualified_result_view:${event.id}`,
      );
      requireNonemptyString(
        event.clientHash,
        `malformed_qualified_result_view:${event.id}`,
      );
      requireNonemptyString(
        event.derivedFrom,
        `malformed_qualified_result_view:${event.id}`,
      );
    }
    if (event.type === "qualified_propagation") {
      requireNonemptyString(
        event.slug,
        `malformed_qualified_propagation:${event.id}`,
      );
      requireNonemptyString(
        event.clientHash,
        `malformed_qualified_propagation:${event.id}`,
      );
      requireNonemptyString(
        event.creatorHash,
        `malformed_qualified_propagation:${event.id}`,
      );
      requireNonemptyString(
        event.shareTokenFingerprint,
        `malformed_qualified_propagation:${event.id}`,
      );
      requireNonemptyString(
        event.derivedFrom,
        `malformed_qualified_propagation:${event.id}`,
      );
    }
    return { event, atMs };
  });
  validateQualifiedLineage(validated);
  validated.sort(
    (a, b) =>
      a.atMs - b.atMs ||
      a.event.id.localeCompare(b.event.id) ||
      a.event.runId.localeCompare(b.event.runId) ||
      a.event.type.localeCompare(b.event.type),
  );
  return validated;
}

function exclusionDetail(event, reason) {
  return {
    eventId: event?.id ?? null,
    type: event?.type ?? null,
    runId: event?.runId ?? null,
    at: event?.at ?? null,
    reason,
  };
}

function reduceScopedEvents(scoped, runId) {
  const qualifiedResultViews = scoped.filter(
    (event) => event.type === "qualified_result_view",
  ).length;
  const qualifiedPropagations = scoped.filter(
    (event) => event.type === "qualified_propagation",
  );
  const distinctSharerSessions = new Set(
    qualifiedPropagations.map((event) => event.creatorHash),
  ).size;

  const exclusions = [];
  for (const event of scoped) {
    if (Array.isArray(event.exclusions)) {
      for (const reason of event.exclusions) {
        exclusions.push({
          eventId: event.id,
          type: event.type,
          reason,
          at: event.at,
        });
      }
    }
  }

  const pass =
    qualifiedPropagations.length >= 5 && distinctSharerSessions >= 3;
  let disposition = "HOLD_ONCE";
  if (pass) disposition = "PASS";
  else if (qualifiedResultViews >= 200) disposition = "KILL";

  return {
    runId: runId || null,
    rawCounts: {
      result_view: scoped.filter((event) => event.type === "result_view").length,
      share_created: scoped.filter((event) => event.type === "share_created")
        .length,
      propagated_visit: scoped.filter(
        (event) => event.type === "propagated_visit",
      ).length,
      qualified_result_view: qualifiedResultViews,
      qualified_propagation: qualifiedPropagations.length,
    },
    qualifiedResultViews,
    qualifiedPropagations: qualifiedPropagations.length,
    distinctSharerSessions,
    exclusions,
    disposition,
  };
}

/**
 * Backward-compatible run-only reduction used by acceptance and zero-baseline
 * checks that do not yet have an authorized window boundary.
 */
export function reduceEvents(events, runId) {
  const validated = validateAndSortEvents(events);
  const scoped = validated
    .map(({ event }) => event)
    .filter((event) => !runId || event.runId === runId);
  return reduceScopedEvents(scoped, runId);
}

/**
 * Reduce exactly one authorized run within the half-open interval
 * [startUtc, endUtc). Excluded inputs are classified into mutually exclusive
 * buckets and are never included in metrics.
 */
export function reduceWindowEvents(events, { runId, startUtc, endUtc } = {}) {
  if (typeof runId !== "string" || runId.length === 0) {
    throw new TypeError("missing_run_id");
  }
  const startMs = requireBoundary(startUtc, "start_utc");
  const endMs = requireBoundary(endUtc, "end_utc");
  if (endMs <= startMs) throw new RangeError("invalid_window_order");
  const validated = validateAndSortEvents(events);

  const scoped = [];
  const windowExclusions = {
    wrongRun: [],
    beforeStart: [],
    atOrAfterEnd: [],
  };

  for (const { event, atMs } of validated) {
    if (event?.runId !== runId) {
      windowExclusions.wrongRun.push(exclusionDetail(event, "wrong_run"));
      continue;
    }
    if (atMs < startMs) {
      windowExclusions.beforeStart.push(
        exclusionDetail(event, "before_start"),
      );
      continue;
    }
    if (atMs >= endMs) {
      windowExclusions.atOrAfterEnd.push(
        exclusionDetail(event, "at_or_after_end"),
      );
      continue;
    }
    scoped.push(event);
  }

  return {
    ...reduceScopedEvents(scoped, runId),
    window: {
      startUtc: new Date(startMs).toISOString(),
      endUtc: new Date(endMs).toISOString(),
      semantics: "[startUtc,endUtc)",
    },
    windowExclusionCounts: {
      wrongRun: windowExclusions.wrongRun.length,
      beforeStart: windowExclusions.beforeStart.length,
      atOrAfterEnd: windowExclusions.atOrAfterEnd.length,
    },
    windowExclusions,
  };
}
