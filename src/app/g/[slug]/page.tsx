import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  EvidenceRoleSection,
  EVIDENCE_ROLE_ORDER,
} from "@/components/EvidenceRoleSection";
import { GenealogyTimeline } from "@/components/GenealogyTimeline";
import { ShareActions } from "@/components/ShareActions";
import { SourceList } from "@/components/SourceList";
import { getAll, getBySlug } from "@/lib/genealogies";

type PageProps = {
  params: Promise<{ slug: string }>;
};

/** Static export requires ≥1 path; sentinel used only when the collection is empty. */
const EMPTY_COLLECTION_SLUG = "_empty";

export function generateStaticParams() {
  const all = getAll();
  if (all.length === 0) return [{ slug: EMPTY_COLLECTION_SLUG }];
  return all.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  if (slug === EMPTY_COLLECTION_SLUG) return { title: "Not found" };
  const g = getBySlug(slug);
  if (!g) return { title: "Not found" };
  return {
    title: g.phrase,
    description: g.finding.slice(0, 160),
    openGraph: {
      title: g.phrase,
      description: g.finding.slice(0, 160),
      images: [{ url: `/og/${g.slug}.png`, width: 1200, height: 630 }],
    },
  };
}

export default async function GenealogyPage({ params }: PageProps) {
  const { slug } = await params;
  if (slug === EMPTY_COLLECTION_SLUG) notFound();
  const g = getBySlug(slug);
  if (!g) notFound();

  return (
    <article className="stack">
      <header className="stack-sm">
        <p className="source-meta">
          <Link href="/">Origin</Link> / genealogy
        </p>
        <h1 className="display" style={{ fontSize: "2rem", margin: 0 }}>
          {g.phrase}
        </h1>
        <p className="finding">{g.finding}</p>
        <div className="meta-row">
          <span>Status: {g.status}</span>
          <span>Revision: {g.revision}</span>
          <span>Reviewed: {g.reviewedAt}</span>
          <span>Hash: {g.sourceSetHash}</span>
        </div>
      </header>

      <ShareActions slug={g.slug} phrase={g.phrase} />

      <section className="stack" aria-labelledby="roles-heading">
        <h2 id="roles-heading" className="display" style={{ fontSize: "1.3rem" }}>
          Evidence roles
        </h2>
        {EVIDENCE_ROLE_ORDER.map((role) => (
          <EvidenceRoleSection key={role} role={role} assertions={g.assertions} />
        ))}
      </section>

      <section className="stack-sm" aria-labelledby="timeline-heading">
        <h2 id="timeline-heading" className="display" style={{ fontSize: "1.3rem" }}>
          Timeline
        </h2>
        <GenealogyTimeline assertions={g.assertions} sources={g.sources} />
      </section>

      <section className="stack-sm" aria-labelledby="sources-heading">
        <h2 id="sources-heading" className="display" style={{ fontSize: "1.3rem" }}>
          Sources
        </h2>
        <SourceList sources={g.sources} />
      </section>

      <section className="prose stack-sm" aria-labelledby="scope-heading">
        <h2 id="scope-heading" className="display" style={{ fontSize: "1.3rem" }}>
          Scope and review
        </h2>
        <p>
          <strong>Search scope.</strong> {g.searchScope}
        </p>
        <p>
          <strong>Evidence reviewed.</strong> {g.evidenceReviewed}
        </p>
        {g.supersedesRevision != null ? (
          <p>This revision supersedes revision {g.supersedesRevision}.</p>
        ) : null}
        {g.correctionHistory.length > 0 ? (
          <ul>
            {g.correctionHistory.map((c) => (
              <li key={`${c.at}-${c.summary}`}>
                {c.at}: {c.summary}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <p>
        See a better source? <Link href="/corrections/">Submit a correction</Link>.
      </p>
    </article>
  );
}
