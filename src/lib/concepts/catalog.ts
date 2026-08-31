import fs from "node:fs";
import path from "node:path";
import {
  ConceptCatalogFileSchema,
  type ConceptCatalogFile,
  type ConceptCatalogItem,
} from "./schema";

const CATALOG_PATH = path.join(process.cwd(), "data", "concepts", "catalog.json");

let cache: ConceptCatalogFile | null = null;

function loadCatalog(): ConceptCatalogFile {
  if (cache) return cache;
  if (!fs.existsSync(CATALOG_PATH)) {
    throw new Error("Missing data/concepts/catalog.json");
  }
  const raw: unknown = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8"));
  const parsed = ConceptCatalogFileSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid concept catalog: ${issues}`);
  }
  cache = parsed.data;
  return cache;
}

export function clearConceptCatalogCache(): void {
  cache = null;
}

export function getConceptCatalog(): ConceptCatalogFile {
  return loadCatalog();
}

export function listConceptCatalog(): readonly ConceptCatalogItem[] {
  return loadCatalog().items;
}

export function getConceptBySlug(slug: string): ConceptCatalogItem | undefined {
  return loadCatalog().items.find((item) => item.slug === slug);
}

export function getConceptById(conceptId: string): ConceptCatalogItem | undefined {
  return loadCatalog().items.find((item) => item.conceptId === conceptId);
}

export type ConceptSearchItem = {
  type: "Concept";
  slug: string;
  label: string;
  aliases: string[];
  objectKind: ConceptCatalogItem["objectKind"];
  researchMaturity: ConceptCatalogItem["researchMaturity"];
};

export function listConceptSearchItems(): ConceptSearchItem[] {
  return listConceptCatalog().map((item) => ({
    type: "Concept" as const,
    slug: item.slug,
    label: item.label,
    aliases: item.aliases,
    objectKind: item.objectKind,
    researchMaturity: item.researchMaturity,
  }));
}
