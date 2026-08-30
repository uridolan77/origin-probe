/**
 * Deterministic reducer over accepted events for a run.
 */
export function reduceEvents(events, runId) {
  const scoped = runId ? events.filter((e) => e.runId === runId) : events;

  const qualifiedResultViews = scoped.filter(
    (e) => e.type === "qualified_result_view",
  ).length;
  const qualifiedPropagations = scoped.filter(
    (e) => e.type === "qualified_propagation",
  );
  const distinctSharerSessions = new Set(
    qualifiedPropagations.map((e) => e.creatorHash),
  ).size;

  const exclusions = [];
  for (const e of scoped) {
    if (Array.isArray(e.exclusions) && e.exclusions.length) {
      for (const reason of e.exclusions) {
        exclusions.push({
          eventId: e.id,
          type: e.type,
          reason,
          at: e.at,
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
      result_view: scoped.filter((e) => e.type === "result_view").length,
      share_created: scoped.filter((e) => e.type === "share_created").length,
      propagated_visit: scoped.filter((e) => e.type === "propagated_visit")
        .length,
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
