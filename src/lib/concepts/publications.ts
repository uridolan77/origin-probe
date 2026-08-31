import fs from "node:fs";
import path from "node:path";
import {
  PublishedConceptGenealogySchema,
  type PublishedConceptGenealogy,
} from "./schema";

const PUB_DIR = path.join(process.cwd(), "data", "concepts", "publications");

let cache: readonly PublishedConceptGenealogy[] | null = null;

function loadAll(): readonly PublishedConceptGenealogy[] {
  if (cache) return cache;
  if (!fs.existsSync(PUB_DIR)) {
    cache = Object.freeze([]);
    return cache;
  }
  const files = fs
    .readdirSync(PUB_DIR)
    .filter((name) => name.endsWith(".json"))
    .sort();
  const items: PublishedConceptGenealogy[] = [];
  for (const file of files) {
    const raw: unknown = JSON.parse(
      fs.readFileSync(path.join(PUB_DIR, file), "utf8"),
    );
    const parsed = PublishedConceptGenealogySchema.safeParse(raw);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      throw new Error(`Invalid published concept in ${file}: ${issues}`);
    }
    if (file !== `${parsed.data.slug}.json`) {
      throw new Error(
        `Published concept filename must match slug: ${file} vs ${parsed.data.slug}.json`,
      );
    }
    items.push(parsed.data);
  }
  cache = Object.freeze(items);
  return cache;
}

export function clearConceptPublicationCache(): void {
  cache = null;
}

export function listPublishedConcepts(): readonly PublishedConceptGenealogy[] {
  return loadAll().filter((d) => d.status === "published");
}

export function getPublishedConceptBySlug(
  slug: string,
): PublishedConceptGenealogy | undefined {
  return loadAll().find((d) => d.slug === slug && d.status === "published");
}

export function countAcceptedAssertionsInPublications(): number {
  return loadAll()
    .filter((d) => d.status === "published")
    .reduce((n, d) => n + d.assertions.length, 0);
}
