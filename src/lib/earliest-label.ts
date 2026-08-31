import type { Assertion, Genealogy, HistoricalDate } from "./schema";

/**
 * Public label for an occurrence assertion (EVO/ERO).
 * Reported (secondary-only) occurrences are visually distinct from verified ones.
 */
export function formatOccurrenceLabel(
  assertion: Pick<Assertion, "evidenceRole" | "occurrenceDate"> | undefined,
  fallbackDate?: HistoricalDate,
): string {
  const display = assertion?.occurrenceDate?.display ?? fallbackDate?.display;
  if (!display) return "";
  if (assertion?.evidenceRole === "EARLIEST_REPORTED_OCCURRENCE") {
    return display.toLowerCase().startsWith("reported") ? display : `Reported ${display}`;
  }
  return display;
}

/**
 * Public earliest label for index/OG surfaces — derived from the bound assertion's occurrenceDate.
 */
export function formatEarliestLabel(
  g: Pick<Genealogy, "assertions" | "index">,
): string {
  const index = g.index;
  if (!index) return "";
  const assertion = g.assertions.find((a) => a.assertionId === index.earliest.assertionId);
  return formatOccurrenceLabel(assertion, index.earliest.date);
}
