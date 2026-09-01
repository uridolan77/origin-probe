import type { MetadataRoute } from "next";
import { listPublished } from "@/lib/genealogies";
import { listPublishedConcepts } from "@/lib/concepts/publications";

const siteUrl = (process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, "");

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = ["/", "/concepts/", "/method/", "/corrections/", "/privacy/"].map(
    (path) => ({
      url: `${siteUrl}${path}`,
      changeFrequency: "weekly" as const,
      priority: path === "/" ? 1 : 0.7,
    }),
  );

  const phrases = listPublished().map((g) => ({
    url: `${siteUrl}/g/${g.slug}/`,
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  // Unpublished concept pages are intentionally excluded (noindex).
  const concepts = listPublishedConcepts().map((d) => ({
    url: `${siteUrl}/concepts/${d.slug}/`,
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  return [...staticRoutes, ...phrases, ...concepts];
}
