import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ConceptPublishedView,
  ConceptUnpublishedView,
} from "@/components/ConceptDetail";
import { getConceptBySlug, listConceptCatalog } from "@/lib/concepts/catalog";
import { getPublishedConceptBySlug } from "@/lib/concepts/publications";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return listConceptCatalog().map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const item = getConceptBySlug(slug);
  if (!item) return { title: "Not found" };
  const published = getPublishedConceptBySlug(slug);

  if (published) {
    return {
      title: published.label,
      description: published.finding.slice(0, 160),
      alternates: { canonical: `/concepts/${slug}/` },
      robots: { index: true, follow: true },
    };
  }

  return {
    title: item.label,
    description: `${item.label} is in Origin’s research catalog. No public genealogy yet.`,
    alternates: { canonical: `/concepts/${slug}/` },
    robots: { index: false, follow: true },
  };
}

export default async function ConceptDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const item = getConceptBySlug(slug);
  if (!item) notFound();

  const published = getPublishedConceptBySlug(slug);
  if (published) {
    return <ConceptPublishedView dossier={published} />;
  }
  return <ConceptUnpublishedView item={item} />;
}
