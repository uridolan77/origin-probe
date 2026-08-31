import type { Assertion, EvidenceRole } from "@/lib/schema";

const ROLE_LABELS: Record<EvidenceRole, string> = {
  EARLIEST_VERIFIED_OCCURRENCE: "Earliest verified occurrence",
  EARLIEST_REPORTED_OCCURRENCE: "Earliest reported occurrence",
  CLAIMED_COINAGE: "Claimed coinage",
  POPULARIZED_BY: "Popularized by",
  MISATTRIBUTED_TO: "Misattributed to",
  ANTECEDENT: "Antecedent",
  CONTESTED_INCOMPLETE: "Contested or incomplete",
};

type Props = {
  role: EvidenceRole;
  assertions: Assertion[];
};

export function EvidenceRoleSection({ role, assertions }: Props) {
  const items = assertions.filter((a) => a.evidenceRole === role);
  if (items.length === 0) return null;

  return (
    <section className="role-section" aria-labelledby={`role-${role}`}>
      <span className="role-label" id={`role-${role}`}>
        {ROLE_LABELS[role]}
      </span>
      <div className="stack-sm">
        {items.map((a) => (
          <div key={a.assertionId}>
            <p>
              <strong>{a.subject}</strong> — {a.publicStatement}
            </p>
            <p className="source-meta">
              Support: {a.supportKind}
              {a.caveat ? ` · ${a.caveat}` : ""}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
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
