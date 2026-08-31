import type { Genealogy } from "./schema";

/**
 * Public earliest label for index/OG surfaces.
 * Reported (secondary-only) occurrences are visually distinct from verified ones.
 */
export function formatEarliestLabel(
  g: Pick<Genealogy, "assertions" | "index">,
): string {
  const index = g.index;
  if (!index) return "";
  const assertion = g.assertions.find((a) => a.assertionId === index.earliest.assertionId);
  const display = index.earliest.date.display;
  if (assertion?.evidenceRole === "EARLIEST_REPORTED_OCCURRENCE") {
    return display.toLowerCase().startsWith("reported") ? display : `Reported ${display}`;
  }
  return display;
}
