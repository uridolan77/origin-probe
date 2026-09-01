import fs from "node:fs";
import path from "node:path";
import {
  loadVerifiedPublications,
  resolveMembraneOptionsForRepo,
  type LoadedPublications,
} from "./publication-membrane";
import type { PublishedConceptGenealogy } from "./schema";

let cache: LoadedPublications | null = null;

function loadAll(repoRoot: string = process.cwd()): LoadedPublications {
  if (cache && repoRoot === process.cwd()) return cache;
  if (!fs.existsSync(path.join(repoRoot, "data", "concepts"))) {
    const empty: LoadedPublications = {
      bundles: [],
      dossiers: [],
      authorizedAssertionIds: [],
    };
    if (repoRoot === process.cwd()) cache = empty;
    return empty;
  }
  const loaded = loadVerifiedPublications(
    repoRoot,
    resolveMembraneOptionsForRepo(repoRoot),
  );
  if (repoRoot === process.cwd()) cache = loaded;
  return loaded;
}

export function clearConceptPublicationCache(): void {
  cache = null;
}

export function listPublishedConcepts(): readonly PublishedConceptGenealogy[] {
  return loadAll().dossiers.filter((d) => d.status === "published");
}

export function getPublishedConceptBySlug(
  slug: string,
): PublishedConceptGenealogy | undefined {
  return loadAll().dossiers.find(
    (d) => d.slug === slug && d.status === "published",
  );
}

export function countAcceptedAssertionsInPublications(): number {
  return loadAll()
    .dossiers.filter((d) => d.status === "published")
    .reduce((n, d) => n + d.assertions.length, 0);
}

export function listAuthorizedAssertionIds(): readonly string[] {
  return loadAll().authorizedAssertionIds;
}
