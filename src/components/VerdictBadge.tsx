import type { Verdict } from "@/lib/schema";
import { VERDICT_DISPLAY, verdictClassName } from "@/lib/display";

type Props = {
  verdict: Verdict;
  /** Keep accessible name = label only (for table cells). */
  decorativeGlyph?: boolean;
};

export function VerdictBadge({ verdict, decorativeGlyph = true }: Props) {
  const d = VERDICT_DISPLAY[verdict];
  return (
    <span className={verdictClassName(verdict)}>
      {decorativeGlyph ? (
        <span className="badge__glyph" aria-hidden="true">
          {d.glyph}{" "}
        </span>
      ) : null}
      {d.label}
    </span>
  );
}
