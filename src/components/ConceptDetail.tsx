import Link from "next/link";
import {
  MATURITY_DISPLAY,
  OBJECT_KIND_DISPLAY,
  PUBLIC_ROLE_DISPLAY,
} from "@/lib/concepts/display";
import type { ConceptCatalogItem } from "@/lib/concepts/schema";
import type { PublishedConceptGenealogy } from "@/lib/concepts/schema";
import { MaturityChip } from "@/components/MaturityChip";

type UnpublishedProps = {
  item: ConceptCatalogItem;
};

export function ConceptUnpublishedView({ item }: UnpublishedProps) {
  return (
    <article className="detail-layout">
      <div className="detail-main stack">
        <header className="stack-sm">
          <p className="source-meta">
            <Link href="/concepts/">Concepts</Link> / research catalog
          </p>
          <h1 className="display display-lg">{item.label}</h1>
          <p className="source-meta">
            {item.conceptId} · {OBJECT_KIND_DISPLAY[item.objectKind]} ·{" "}
            {item.domains.join("; ")}
          </p>
          <MaturityChip maturity={item.researchMaturity} />
        </header>

        <section className="prose stack-sm" aria-labelledby="boundary-heading">
          <h2 id="boundary-heading" className="display display-sm">
            No public genealogy yet
          </h2>
          <p>
            This dossier has not passed Origin&apos;s claim-level publication gate.
            Candidate assertions are not shown as findings.
          </p>
          <p>
            Research status:{" "}
            <strong>{MATURITY_DISPLAY[item.researchMaturity].label}</strong>.
            {item.researchMaturity === "partially_verified"
              ? " Source material has been inspected; no assertion is yet publicly accepted, and the dossier remains under review."
              : null}
          </p>
        </section>

        <section className="stack-sm" aria-labelledby="progress-heading">
          <h2 id="progress-heading" className="display display-sm">
            Research progress
          </h2>
          <ul className="plain-list">
            <li>Open research tasks: {item.openTaskCount}</li>
            <li>Source leads: {item.sourceLeadCount}</li>
            <li>Evidence leads: {item.evidenceLeadCount}</li>
            <li>Accepted public assertions: {item.acceptedAssertionCount}</li>
          </ul>
        </section>

        <section className="prose stack-sm">
          <p>
            <Link href="/method/">How concept publication works</Link>
            {" · "}
            <Link href={`/corrections/?kind=concept&subject=${item.slug}`}>
              Suggest a source or correction
            </Link>
          </p>
        </section>
      </div>
    </article>
  );
}

type PublishedProps = {
  dossier: PublishedConceptGenealogy;
};

export function ConceptPublishedView({ dossier }: PublishedProps) {
  const slots = [...dossier.projectionSlots].sort(
    (a, b) =>
      (PUBLIC_ROLE_DISPLAY[a.slot]?.order ?? 99) -
      (PUBLIC_ROLE_DISPLAY[b.slot]?.order ?? 99),
  );
  const byId = new Map(dossier.assertions.map((a) => [a.assertionId, a]));

  return (
    <article className="detail-layout">
      <div className="detail-main stack">
        <header className="stack-sm">
          <p className="source-meta">
            <Link href="/concepts/">Concepts</Link> / published genealogy
          </p>
          <h1 className="display display-lg">{dossier.label}</h1>
          <p className="finding">{dossier.finding}</p>
          <p className="source-meta">
            Revision {dossier.revision} · Reviewed {dossier.reviewedAt.slice(0, 10)} ·{" "}
            {OBJECT_KIND_DISPLAY[dossier.objectKind]}
          </p>
          {dossier.status !== "published" ? (
            <p role="status">Status: {dossier.status}</p>
          ) : null}
        </header>

        <section className="prose stack-sm" aria-labelledby="finding-heading">
          <h2 id="finding-heading" className="display display-sm">
            Finding
          </h2>
          <p>{dossier.finding}</p>
        </section>

        {slots.map((slot) => {
          const heading =
            PUBLIC_ROLE_DISPLAY[slot.slot]?.heading ?? slot.slot;
          const assertions = slot.assertionIds
            .map((id) => byId.get(id))
            .filter(Boolean);
          if (assertions.length === 0) return null;
          return (
            <section
              key={slot.slot}
              className="stack-sm"
              aria-labelledby={`slot-${slot.slot}`}
            >
              <h2 id={`slot-${slot.slot}`} className="display display-sm">
                {heading}
              </h2>
              <ul className="plain-list">
                {assertions.map((a) =>
                  a ? (
                    <li key={a.assertionId}>
                      <p>{a.claim}</p>
                      {a.temporal ? (
                        <p className="source-meta">{a.temporal.display}</p>
                      ) : null}
                      {a.caveat ? <p className="source-meta">{a.caveat}</p> : null}
                    </li>
                  ) : null,
                )}
              </ul>
            </section>
          );
        })}

        <section className="stack-sm" aria-labelledby="sources-heading">
          <h2 id="sources-heading" className="display display-sm">
            Sources and review scope
          </h2>
          <ul className="plain-list">
            {dossier.sources.map((s) => (
              <li key={s.sourceId}>
                {s.url ? (
                  <a href={s.url} rel="noopener noreferrer">
                    {s.citation}
                  </a>
                ) : (
                  s.citation
                )}
              </li>
            ))}
          </ul>
          <p className="prose">
            <strong>Search scope.</strong> {dossier.searchScope}
          </p>
          {dossier.limitations.length > 0 ? (
            <ul className="plain-list">
              {dossier.limitations.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className="prose stack-sm" aria-labelledby="receipt-heading">
          <h2 id="receipt-heading" className="display display-sm">
            Publication receipt
          </h2>
          <p>
            Authorization {dossier.publicationReceipt.authorizationId} by{" "}
            {dossier.publicationReceipt.authorizedBy} at{" "}
            {dossier.publicationReceipt.authorizedAt}.
          </p>
          <p>
            <Link href={`/corrections/?kind=concept&subject=${dossier.slug}`}>
              Correct this published dossier
            </Link>
          </p>
        </section>
      </div>
    </article>
  );
}
