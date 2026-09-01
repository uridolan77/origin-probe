import type { ConceptCatalogItem } from "./schema";
import type { PublishedConceptGenealogy } from "./schema";

function normalizeAliases(aliases: readonly string[]): string[] {
  return [...aliases].map((a) => a.trim()).sort();
}

export type CatalogIdentityMismatch = {
  field: string;
  catalog: unknown;
  dossier: unknown;
};

/**
 * Exact identity tuple between catalog row and published dossier.
 */
export function compareCatalogDossierIdentity(
  catalog: ConceptCatalogItem,
  dossier: PublishedConceptGenealogy,
): CatalogIdentityMismatch[] {
  const mismatches: CatalogIdentityMismatch[] = [];

  if (catalog.conceptId !== dossier.conceptId) {
    mismatches.push({
      field: "conceptId",
      catalog: catalog.conceptId,
      dossier: dossier.conceptId,
    });
  }
  if (catalog.slug !== dossier.slug) {
    mismatches.push({
      field: "slug",
      catalog: catalog.slug,
      dossier: dossier.slug,
    });
  }
  if (catalog.label !== dossier.label) {
    mismatches.push({
      field: "label",
      catalog: catalog.label,
      dossier: dossier.label,
    });
  }
  if (catalog.objectKind !== dossier.objectKind) {
    mismatches.push({
      field: "objectKind",
      catalog: catalog.objectKind,
      dossier: dossier.objectKind,
    });
  }
  const catAliases = normalizeAliases(catalog.aliases);
  const dosAliases = normalizeAliases(dossier.aliases);
  if (
    catAliases.length !== dosAliases.length ||
    catAliases.some((a, i) => a !== dosAliases[i])
  ) {
    mismatches.push({
      field: "aliases",
      catalog: catAliases,
      dossier: dosAliases,
    });
  }

  return mismatches;
}
