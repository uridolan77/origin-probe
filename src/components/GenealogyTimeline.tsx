import type { Assertion, Source } from "@/lib/schema";
import { formatOccurrenceLabel } from "@/lib/earliest-label";

type Props = {
  assertions: Assertion[];
  sources: Source[];
};

const OCCURRENCE_ROLES = new Set([
  "EARLIEST_VERIFIED_OCCURRENCE",
  "EARLIEST_REPORTED_OCCURRENCE",
]);

function relatedPublicationDate(assertion: Assertion, sources: Source[]): string {
  const related = sources.filter(
    (s) =>
      assertion.evidenceIds.includes(s.sourceId) ||
      s.supportsAssertionIds.includes(assertion.assertionId),
  );
  if (related.length === 0) return "Undated";
  return [...related].map((s) => s.publicationDate).sort()[0];
}

function dateForAssertion(assertion: Assertion, sources: Source[]): string {
  if (OCCURRENCE_ROLES.has(assertion.evidenceRole) && assertion.occurrenceDate) {
    return formatOccurrenceLabel(assertion);
  }
  return relatedPublicationDate(assertion, sources);
}

function sortKeyForAssertion(assertion: Assertion, sources: Source[]): string {
  if (OCCURRENCE_ROLES.has(assertion.evidenceRole) && assertion.occurrenceDate) {
    const y = String(assertion.occurrenceDate.startYear).padStart(4, "0");
    return `${y}\0${assertion.occurrenceDate.display}`;
  }
  return relatedPublicationDate(assertion, sources);
}

export function GenealogyTimeline({ assertions, sources }: Props) {
  const items = [...assertions].sort((a, b) =>
    sortKeyForAssertion(a, sources).localeCompare(sortKeyForAssertion(b, sources)),
  );

  return (
    <ol className="timeline">
      {items.map((a) => (
        <li key={a.assertionId}>
          <div className="timeline-date">{dateForAssertion(a, sources)}</div>
          <div>
            <strong>{a.evidenceRole.replaceAll("_", " ").toLowerCase()}</strong>
            {": "}
            {a.subject}
          </div>
          <p>{a.publicStatement}</p>
        </li>
      ))}
    </ol>
  );
}
