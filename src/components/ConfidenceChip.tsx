import type { Confidence, StatusTone } from "@/lib/display";
import { CONFIDENCE_DISPLAY } from "@/lib/display";

type Props = {
  confidence: Confidence;
  /** When true, decorative glyph is aria-hidden (cell accessible-name purity). */
  decorative?: boolean;
};

export function ConfidenceChip({ confidence, decorative = false }: Props) {
  const d = CONFIDENCE_DISPLAY[confidence];
  return (
    <span className={`chip chip--${d.tone as StatusTone}`}>
      <span className="chip__glyph" aria-hidden={decorative || undefined}>
        {d.glyph}
      </span>
      {d.label}
    </span>
  );
}
