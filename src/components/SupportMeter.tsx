import type { SupportKind } from "@/lib/schema";
import { SUPPORT_DISPLAY } from "@/lib/display";

type Props = {
  supportKind: SupportKind;
};

export function SupportMeter({ supportKind }: Props) {
  const d = SUPPORT_DISPLAY[supportKind];
  return (
    <span className="support-meter" title={`Support: ${d.label}`}>
      <span className="support-meter__bars" aria-hidden="true">
        {[1, 2, 3, 4].map((n) => (
          <span
            key={n}
            className={`support-meter__bar${n <= d.steps ? " is-on" : ""}`}
          />
        ))}
      </span>
      <span>
        Support: {d.label}
      </span>
    </span>
  );
}
