import type {
  Assertion,
  EarlierUseStatus,
  EvidenceRole,
  Source,
  SourceType,
  SupportKind,
  Verdict,
} from "./schema";

export type StatusTone = "verified" | "reported" | "contested" | "neutral";
export type Confidence = "verified" | "reported" | "contested";

export type DisplayEntry = {
  label: string;
  shortLabel: string;
  glyph: string;
  tone: StatusTone;
};

export const VERDICT_DISPLAY: Record<Verdict, DisplayEntry> = {
  direct_coinage: {
    label: "Direct coinage",
    shortLabel: "Direct",
    glyph: "●",
    tone: "verified",
  },
  claimed_coinage: {
    label: "Claimed coinage",
    shortLabel: "Claimed",
    glyph: "◐",
    tone: "reported",
  },
  popularized: {
    label: "Popularized",
    shortLabel: "Popularized",
    glyph: "◇",
    tone: "reported",
  },
  misattributed: {
    label: "Misattributed",
    shortLabel: "Misattr.",
    glyph: "✕",
    tone: "contested",
  },
};

export const ROLE_DISPLAY: Record<
  EvidenceRole,
  DisplayEntry & { mark: "diamond" | "circle" | "square" | "triangle" | "dash" }
> = {
  EARLIEST_VERIFIED_OCCURRENCE: {
    label: "Earliest verified occurrence",
    shortLabel: "Verified occurrence",
    glyph: "◆",
    tone: "verified",
    mark: "diamond",
  },
  EARLIEST_REPORTED_OCCURRENCE: {
    label: "Earliest reported occurrence",
    shortLabel: "Reported occurrence",
    glyph: "◇",
    tone: "reported",
    mark: "diamond",
  },
  CLAIMED_COINAGE: {
    label: "Claimed coinage",
    shortLabel: "Claimed coinage",
    glyph: "●",
    tone: "reported",
    mark: "circle",
  },
  POPULARIZED_BY: {
    label: "Popularized by",
    shortLabel: "Popularized",
    glyph: "▲",
    tone: "neutral",
    mark: "triangle",
  },
  MISATTRIBUTED_TO: {
    label: "Misattributed to",
    shortLabel: "Misattributed",
    glyph: "✕",
    tone: "contested",
    mark: "square",
  },
  ANTECEDENT: {
    label: "Antecedent",
    shortLabel: "Antecedent",
    glyph: "–",
    tone: "neutral",
    mark: "dash",
  },
  CONTESTED_INCOMPLETE: {
    label: "Contested or incomplete",
    shortLabel: "Contested",
    glyph: "?",
    tone: "contested",
    mark: "square",
  },
};

export const SUPPORT_DISPLAY: Record<
  SupportKind,
  { label: string; steps: 1 | 2 | 3 | 4; glyph: string }
> = {
  direct: { label: "direct", steps: 4, glyph: "████" },
  supporting: { label: "supporting", steps: 3, glyph: "███░" },
  contested: { label: "contested", steps: 2, glyph: "██░░" },
  incomplete: { label: "incomplete", steps: 1, glyph: "█░░░" },
};

export const EARLIER_USE_DISPLAY: Record<EarlierUseStatus, DisplayEntry> = {
  none_located_within_scope: {
    label: "No earlier use located within scope",
    shortLabel: "None located",
    glyph: "✓",
    tone: "verified",
  },
  reported_unverified: {
    label: "Earlier use reported, unverified",
    shortLabel: "Earlier reported",
    glyph: "~",
    tone: "reported",
  },
  contested: {
    label: "Earlier use contested",
    shortLabel: "Earlier contested",
    glyph: "!",
    tone: "contested",
  },
};

export const SOURCE_TYPE_DISPLAY: Record<SourceType, DisplayEntry> = {
  primary: {
    label: "Primary",
    shortLabel: "Primary",
    glyph: "●",
    tone: "verified",
  },
  secondary: {
    label: "Secondary",
    shortLabel: "Secondary",
    glyph: "○",
    tone: "reported",
  },
};

export const CONFIDENCE_DISPLAY: Record<Confidence, DisplayEntry> = {
  verified: {
    label: "Verified",
    shortLabel: "Verified",
    glyph: "●",
    tone: "verified",
  },
  reported: {
    label: "Reported",
    shortLabel: "Reported",
    glyph: "◇",
    tone: "reported",
  },
  contested: {
    label: "Contested",
    shortLabel: "Contested",
    glyph: "✕",
    tone: "contested",
  },
};

export const VERDICT_LABELS: Record<Verdict, string> = {
  direct_coinage: VERDICT_DISPLAY.direct_coinage.label,
  claimed_coinage: VERDICT_DISPLAY.claimed_coinage.label,
  popularized: VERDICT_DISPLAY.popularized.label,
  misattributed: VERDICT_DISPLAY.misattributed.label,
};

export function verdictClassName(verdict: Verdict): string {
  if (verdict === "misattributed") {
    return "phrase-index-verdict phrase-index-verdict--misattributed";
  }
  if (verdict === "popularized") {
    return "phrase-index-verdict phrase-index-verdict--popularized";
  }
  return "phrase-index-verdict phrase-index-verdict--coinage";
}

export function confidenceOf(
  assertion: Pick<Assertion, "evidenceRole" | "supportKind" | "earlierUseStatus">,
  sources?: readonly Pick<Source, "sourceId" | "sourceType">[],
  evidenceIds?: readonly string[],
): Confidence {
  if (
    assertion.evidenceRole === "CONTESTED_INCOMPLETE" ||
    assertion.supportKind === "contested" ||
    assertion.earlierUseStatus === "contested"
  ) {
    return "contested";
  }
  if (assertion.evidenceRole === "EARLIEST_REPORTED_OCCURRENCE") {
    return "reported";
  }
  if (assertion.evidenceRole === "EARLIEST_VERIFIED_OCCURRENCE") {
    if (assertion.earlierUseStatus === "reported_unverified") return "reported";
    const ids = evidenceIds ?? [];
    if (sources && ids.length > 0) {
      const hasPrimary = ids.some((id) =>
        sources.some((s) => s.sourceId === id && s.sourceType === "primary"),
      );
      return hasPrimary ? "verified" : "reported";
    }
    return "verified";
  }
  if (
    assertion.supportKind === "incomplete" ||
    assertion.earlierUseStatus === "reported_unverified"
  ) {
    return "reported";
  }
  return "reported";
}

/** Confidence of the index-bound earliest assertion for a genealogy. */
export function indexConfidence(
  assertions: readonly Assertion[],
  sources: readonly Source[],
  earliestAssertionId: string,
): Confidence {
  const a = assertions.find((x) => x.assertionId === earliestAssertionId);
  if (!a) return "reported";
  return confidenceOf(a, sources, a.evidenceIds);
}

export const EVIDENCE_ROLE_ORDER: EvidenceRole[] = [
  "EARLIEST_VERIFIED_OCCURRENCE",
  "EARLIEST_REPORTED_OCCURRENCE",
  "CLAIMED_COINAGE",
  "POPULARIZED_BY",
  "MISATTRIBUTED_TO",
  "ANTECEDENT",
  "CONTESTED_INCOMPLETE",
];

/** Brand palette shared with OG cards (teal, not the old green). */
export const BRAND_PALETTE = {
  ink: "#14181d",
  paper: "#f4f1eb",
  accent: "#1a5a74",
  muted: "#4a5560",
  rule: "#d4cdc0",
} as const;
