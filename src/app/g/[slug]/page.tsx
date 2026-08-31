import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AttributionGlance } from "@/components/AttributionGlance";
import { CopyField } from "@/components/CopyField";
import {
  EvidenceRoleSection,
  EVIDENCE_ROLE_ORDER,
} from "@/components/EvidenceRoleSection";
import { GenealogyTimeline } from "@/components/GenealogyTimeline";
import { ShareActions } from "@/components/ShareActions";
import { ResultViewBeacon } from "@/components/ResultViewBeacon";
import { SourceList } from "@/components/SourceList";
import { getPublishedBySlug, listPublished } from "@/lib/genealogies";

type PageProps = {
  params: Promise<{ slug: string }>;
};

/** Static export requires ≥1 path; sentinel used only when the collection is empty. */
const EMPTY_COLLECTION_SLUG = "_empty";

export function generateStaticParams() {
  const all = listPublished();
  if (all.length === 0) return [{ slug: EMPTY_COLLECTION_SLUG }];
  return all.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  if (slug === EMPTY_COLLECTION_SLUG) return { title: "Not found" };
  const g = getPublishedBySlug(slug);
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
  const g = getPublishedBySlug(slug);
  if (!g) notFound();

  const hashShort =
    g.sourceSetHash.length > 20
      ? `${g.sourceSetHash.slice(0, 12)}…${g.sourceSetHash.slice(-4)}`
      : g.sourceSetHash;

  return (
    <article className="detail-layout">
      <div className="detail-main">
        <header className="stack-sm">
          <p className="source-meta">
            <Link href="/">Origin</Link> / genealogy
          </p>
          <h1 className="display display-lg">{g.phrase}</h1>
          <p className="finding">{g.finding}</p>
        </header>

        <ResultViewBeacon slug={g.slug} />
        <AttributionGlance genealogy={g} />

        <section className="stack" aria-labelledby="roles-heading">
          <h2 id="roles-heading" className="display display-sm">
            Evidence roles
          </h2>
          {EVIDENCE_ROLE_ORDER.map((role) => (
            <EvidenceRoleSection
              key={role}
              role={role}
              assertions={g.assertions}
              sources={g.sources}
            />
          ))}
        </section>

        <section className="stack-sm" aria-labelledby="timeline-heading">
          <h2 id="timeline-heading" className="display display-sm">
            Timeline
          </h2>
          <GenealogyTimeline assertions={g.assertions} sources={g.sources} />
        </section>

        <section className="stack-sm" aria-labelledby="sources-heading">
          <h2 id="sources-heading" className="display display-sm">
            Sources
          </h2>
          <SourceList sources={g.sources} assertions={g.assertions} />
        </section>

        <section className="prose stack-sm" aria-labelledby="scope-heading">
          <h2 id="scope-heading" className="display display-sm">
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
      </div>

      <aside className="detail-rail" aria-label="Record metadata">
        <div className="card">
          <div className="stat-rail">
            <div className="stat-rail__item">
              <span className="stat-rail__label">Status</span>
              <span className="stat-rail__value">{g.status}</span>
            </div>
            <div className="stat-rail__item">
              <span className="stat-rail__label">Revision</span>
              <span className="stat-rail__value">Revision: {g.revision}</span>
            </div>
            <div className="stat-rail__item">
              <span className="stat-rail__label">Reviewed</span>
              <span className="stat-rail__value">{g.reviewedAt}</span>
            </div>
            <div className="stat-rail__item">
              <span className="stat-rail__label">Source set</span>
              <span className="stat-rail__value">
                <CopyField value={g.sourceSetHash} display={hashShort} />
              </span>
            </div>
          </div>
        </div>
        <div className="card">
          <ShareActions slug={g.slug} phrase={g.phrase} />
        </div>
      </aside>
    </article>
  );
}
