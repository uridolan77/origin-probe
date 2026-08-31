import type { Assertion, Source } from "@/lib/schema";
import { formatOccurrenceLabel } from "@/lib/earliest-label";
import { ROLE_DISPLAY } from "@/lib/display";
import {
  buildTimeScale,
  compareYears,
  unitStyle,
} from "@/lib/time-scale";

type Props = {
  assertions: Assertion[];
  sources: Source[];
};

const OCCURRENCE_ROLES = new Set([
  "EARLIEST_VERIFIED_OCCURRENCE",
  "EARLIEST_REPORTED_OCCURRENCE",
]);

type Track = "event" | "documented";

type TimelineItem = {
  assertion: Assertion;
  track: Track;
  label: string;
  sortYear: number;
  startYear: number;
  endYear?: number;
  precision?: string;
};

function relatedSources(assertion: Assertion, sources: Source[]): Source[] {
  return sources.filter(
    (s) =>
      assertion.evidenceIds.includes(s.sourceId) ||
      s.supportsAssertionIds.includes(assertion.assertionId),
  );
}

function earliestPublicationYear(sources: Source[]): number | null {
  if (sources.length === 0) return null;
  const dates = sources.map((s) => s.publicationDate).sort();
  const y = Number.parseInt(dates[0]!.slice(0, 4), 10);
  return Number.isFinite(y) ? y : null;
}

function earliestPublicationLabel(sources: Source[]): string {
  if (sources.length === 0) return "Undated";
  return [...sources].map((s) => s.publicationDate).sort()[0]!;
}

function buildItems(assertions: Assertion[], sources: Source[]): TimelineItem[] {
  return assertions.map((assertion) => {
    if (OCCURRENCE_ROLES.has(assertion.evidenceRole) && assertion.occurrenceDate) {
      const d = assertion.occurrenceDate;
      return {
        assertion,
        track: "event" as const,
        label: formatOccurrenceLabel(assertion),
        sortYear: d.startYear,
        startYear: d.startYear,
        endYear: d.endYear,
        precision: d.precision,
      };
    }
    const related = relatedSources(assertion, sources);
    const year = earliestPublicationYear(related);
    const pubLabel = earliestPublicationLabel(related);
    return {
      assertion,
      track: "documented" as const,
      label: year != null ? `documented ${pubLabel}` : "Undated",
      sortYear: year ?? Number.POSITIVE_INFINITY,
      startYear: year ?? 0,
      precision: "year",
    };
  });
}

export function GenealogyTimeline({ assertions, sources }: Props) {
  const items = buildItems(assertions, sources).sort(
    (a, b) =>
      compareYears(a.sortYear, b.sortYear) ||
      a.label.localeCompare(b.label) ||
      a.assertion.assertionId.localeCompare(b.assertion.assertionId),
  );

  const years = items
    .filter((i) => Number.isFinite(i.sortYear) && i.sortYear < 1e6)
    .flatMap((i) => [i.startYear, i.endYear ?? i.startYear]);
  const scale = buildTimeScale(years.length ? years : [1960, 2020]);

  return (
    <div>
      <div className="timeline-axis" aria-hidden="true">
        {scale.ticks.map((t) => (
          <span
            key={`${t.year}-${t.unit}`}
            className="timeline-axis__tick"
            style={unitStyle(t.unit)}
          >
            {t.label}
          </span>
        ))}
      </div>
      <ol className="timeline timeline--ledger">
        {items.map((item) => {
          const role = ROLE_DISPLAY[item.assertion.evidenceRole];
          const end = item.endYear ?? item.startYear;
          const startU = scale.toUnit(item.startYear);
          const endU = scale.toUnit(end);
          const isBand =
            item.precision === "decade" ||
            item.precision === "range" ||
            item.precision === "century" ||
            (item.endYear != null && item.endYear !== item.startYear);
          const isSoft = item.precision === "circa";
          const markClass = [
            "timeline-mark",
            item.track === "event" ? "timeline-mark--event" : "timeline-mark--documented",
            `timeline-mark--${role.mark}`,
            isBand ? "timeline-mark--band" : "",
            isSoft ? "timeline-mark--soft" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <li key={item.assertion.assertionId}>
              <div className="timeline-track" aria-hidden="true" />
              <div
                className={markClass}
                style={unitStyle(startU, isBand ? endU : undefined)}
                aria-hidden="true"
              />
              <div
                className={`timeline-date${item.track === "documented" ? " timeline-date--documented" : ""}`}
              >
                {item.label}
              </div>
              <div className="timeline-body">
                <div>
                  <strong>{role.label.toLowerCase()}</strong>
                  {": "}
                  {item.assertion.subject}
                </div>
                <p>{item.assertion.publicStatement}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
