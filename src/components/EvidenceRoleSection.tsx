import type { Assertion, EvidenceRole, Source } from "@/lib/schema";
import { EARLIER_USE_DISPLAY, ROLE_DISPLAY } from "@/lib/display";
import { SupportMeter } from "@/components/SupportMeter";
import { EVIDENCE_ROLE_ORDER } from "@/lib/display";

type Props = {
  role: EvidenceRole;
  assertions: Assertion[];
  sources: Source[];
};

export function EvidenceRoleSection({ role, assertions, sources }: Props) {
  const items = assertions.filter((a) => a.evidenceRole === role);
  if (items.length === 0) return null;
  const display = ROLE_DISPLAY[role];

  return (
    <section className="role-section" aria-labelledby={`role-${role}`}>
      <span className="role-label" id={`role-${role}`}>
        {display.label}
      </span>
      <div className="stack-sm">
        {items.map((a) => {
          const linked = sources.filter((s) => a.evidenceIds.includes(s.sourceId));
          const earlier = a.earlierUseStatus
            ? EARLIER_USE_DISPLAY[a.earlierUseStatus]
            : null;
          return (
            <div
              key={a.assertionId}
              className="evidence-card"
              id={`assertion-${a.assertionId}`}
            >
              <p>
                <strong>{a.subject}</strong> — {a.publicStatement}
              </p>
              <div className="evidence-card__meta">
                <SupportMeter supportKind={a.supportKind} />
                {earlier ? (
                  <span className={`chip chip--${earlier.tone}`}>
                    <span className="chip__glyph" aria-hidden="true">
                      {earlier.glyph}
                    </span>
                    {earlier.shortLabel}
                  </span>
                ) : null}
              </div>
              {a.caveat ? <p className="caveat-note">{a.caveat}</p> : null}
              {linked.length > 0 ? (
                <p className="evidence-card__sources">
                  Sources:{" "}
                  {linked.map((s) => (
                    <a key={s.sourceId} href={`#source-${s.sourceId}`}>
                      {s.title}
                    </a>
                  ))}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export { EVIDENCE_ROLE_ORDER };
