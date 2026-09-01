import type {
  NormalizedInterval,
  PublicationProjectionPlan,
  PublishedConceptAssertion,
} from "./schema";

export class TemporalNormalizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TemporalNormalizationError";
  }
}

function fail(msg: string): never {
  throw new TemporalNormalizationError(msg);
}

/**
 * Derive normalized priority intervals from authenticated assertion temporal facts.
 */
export function deriveNormalizedIntervals(
  assertions: readonly PublishedConceptAssertion[],
  eligibleAssertionIds: readonly string[],
  slot: PublicationProjectionPlan["slot"],
): NormalizedInterval[] {
  const byId = new Map(assertions.map((a) => [a.assertionId, a]));
  const derived: NormalizedInterval[] = [];

  for (const id of [...eligibleAssertionIds].sort()) {
    const assertion = byId.get(id);
    if (!assertion) fail(`Eligible assertion ${id} missing from dossier`);
    if (assertion.role !== slot) {
      fail(`Assertion ${id} role ${assertion.role} incompatible with slot ${slot}`);
    }
    if (assertion.temporal?.startYear === undefined) {
      fail(`Assertion ${id} missing temporal.startYear required for priority slot`);
    }
    derived.push({
      assertionId: id,
      startYear: assertion.temporal.startYear,
      endYear: assertion.temporal.endYear,
      precision: assertion.temporal.precision,
    });
  }

  return derived;
}

export function intervalsEqual(
  supplied: readonly NormalizedInterval[],
  derived: readonly NormalizedInterval[],
): boolean {
  if (supplied.length !== derived.length) return false;
  const sortKey = (i: NormalizedInterval) =>
    `${i.assertionId}:${i.startYear}:${i.endYear ?? ""}:${i.precision ?? ""}`;
  const a = [...supplied].map(sortKey).sort();
  const b = [...derived].map(sortKey).sort();
  return a.every((v, i) => v === b[i]);
}
