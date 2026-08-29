import type { Assertion, Source } from "@/lib/schema";

type Props = {
  assertions: Assertion[];
  sources: Source[];
};

function dateForAssertion(assertion: Assertion, sources: Source[]): string {
  const related = sources.filter(
    (s) =>
      assertion.evidenceIds.includes(s.sourceId) ||
      s.supportsAssertionIds.includes(assertion.assertionId),
  );
  if (related.length === 0) return "Undated";
  return [...related].map((s) => s.publicationDate).sort()[0];
}

export function GenealogyTimeline({ assertions, sources }: Props) {
  const items = [...assertions].sort((a, b) =>
    dateForAssertion(a, sources).localeCompare(dateForAssertion(b, sources)),
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
