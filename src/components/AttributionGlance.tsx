import type { Genealogy } from "@/lib/schema";
import { ConfidenceChip } from "@/components/ConfidenceChip";
import { VerdictBadge } from "@/components/VerdictBadge";
import { confidenceOf, ROLE_DISPLAY } from "@/lib/display";

type Props = {
  genealogy: Genealogy;
};

type GlanceRow = {
  roleKey: string;
  label: string;
  subject: string;
  confidence: ReturnType<typeof confidenceOf>;
};

export function AttributionGlance({ genealogy: g }: Props) {
  if (!g.index) return null;

  const rows: GlanceRow[] = [];
  const coinage = g.assertions.find((a) => a.evidenceRole === "CLAIMED_COINAGE");
  const misattr = g.assertions.find((a) => a.evidenceRole === "MISATTRIBUTED_TO");
  const earliest = g.assertions.find(
    (a) => a.assertionId === g.index!.earliest.assertionId,
  );
  const popularized = g.assertions.find((a) => a.evidenceRole === "POPULARIZED_BY");

  if (misattr) {
    rows.push({
      roleKey: "misattr",
      label: "Often credited to",
      subject: misattr.subject,
      confidence: confidenceOf(misattr, g.sources, misattr.evidenceIds),
    });
  } else if (coinage) {
    rows.push({
      roleKey: "coinage",
      label: "Credited to",
      subject: coinage.subject,
      confidence: confidenceOf(coinage, g.sources, coinage.evidenceIds),
    });
  }

  if (earliest) {
    rows.push({
      roleKey: "earliest",
      label: ROLE_DISPLAY[earliest.evidenceRole].shortLabel,
      subject: earliest.subject,
      confidence: confidenceOf(earliest, g.sources, earliest.evidenceIds),
    });
  }

  if (popularized) {
    rows.push({
      roleKey: "pop",
      label: "Popularized by",
      subject: popularized.subject,
      confidence: confidenceOf(popularized, g.sources, popularized.evidenceIds),
    });
  }

  if (rows.length === 0) return null;

  return (
    <div className="attribution-card">
      <div className="attribution-card__row">
        <span className="attribution-card__role">Verdict</span>
        <span className="attribution-card__subject">
          <VerdictBadge verdict={g.index.verdict} decorativeGlyph={false} />
        </span>
        <span />
      </div>
      {rows.map((r) => (
        <div key={r.roleKey} className="attribution-card__row">
          <span className="attribution-card__role">{r.label}</span>
          <span className="attribution-card__subject">{r.subject}</span>
          <ConfidenceChip confidence={r.confidence} />
        </div>
      ))}
    </div>
  );
}
