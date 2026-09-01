"use client";

import { MATURITY_DISPLAY } from "@/lib/concepts/display";
import type { ResearchMaturity } from "@/lib/concepts/schema";

type Props = {
  maturity: ResearchMaturity;
};

export function MaturityChip({ maturity }: Props) {
  const d = MATURITY_DISPLAY[maturity];
  return (
    <span className={`chip chip--${d.tone}`} title={d.label}>
      <span className="chip__glyph" aria-hidden="true">
        {maturity === "published"
          ? "●"
          : maturity === "partially_verified"
            ? "◐"
            : maturity === "source_leads_mapped"
              ? "◔"
              : "○"}
      </span>
      <span className="sr-only">Research status: </span>
      {d.shortLabel}
    </span>
  );
}
