import type { Metadata } from "next";
import Link from "next/link";
import { ConceptIndex } from "@/components/ConceptIndex";
import { listConceptCatalog } from "@/lib/concepts/catalog";

export const metadata: Metadata = {
  title: "Concepts",
  description:
    "100 philosophical concepts in Origin’s research catalog. Public findings appear only after claim-level evidence and review.",
  alternates: { canonical: "/concepts/" },
  robots: { index: true, follow: true },
};

export default function ConceptsIndexPage() {
  const items = listConceptCatalog();

  return (
    <div className="stack">
      <header className="collection-hero">
        <div className="collection-hero-copy">
          <h1>
            How philosophical ideas acquired their words, formulations, and canonical
            names
          </h1>
          <p className="collection-lead">
            {items.length} philosophical concepts in Origin&apos;s research catalog. A
            concept can have a word history, conceptual antecedents, textual formulations,
            translations, later systematizations, and popular reception. Public findings
            appear only after claim-level evidence and review.
          </p>
        </div>
      </header>

      <ConceptIndex items={items} />

      <p className="collection-footnote">
        A catalog entry is not a public historical finding.{" "}
        <Link href="/method/">How concept genealogies are published</Link>.
      </p>
    </div>
  );
}
