import fs from "node:fs";
import path from "node:path";
import {
  GenealogySchema,
  PUBLISHED_STATUSES,
  UNPUBLISHED_STATUSES,
  type Genealogy,
} from "./schema";

const DATA_DIR = path.join(process.cwd(), "data", "genealogies");

let cache: readonly Genealogy[] | null = null;

export function isPublished(g: Pick<Genealogy, "status">): boolean {
  return PUBLISHED_STATUSES.has(g.status);
}

function loadAll(): readonly Genealogy[] {
  if (cache) return cache;
  if (!fs.existsSync(DATA_DIR)) {
    cache = Object.freeze([]);
    return cache;
  }
  const files = fs
    .readdirSync(DATA_DIR)
    .filter((name) => name.endsWith(".json"))
    .sort();
  const items: Genealogy[] = [];
  for (const file of files) {
    const raw = fs.readFileSync(path.join(DATA_DIR, file), "utf8");
    const parsed: unknown = JSON.parse(raw);
    const result = GenealogySchema.safeParse(parsed);
    if (!result.success) {
      const issues = result.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      throw new Error(`Invalid genealogy in ${file}: ${issues}`);
    }
    const record = result.data;
    if (isPublished(record) && !record.index) {
      throw new Error(`Invalid genealogy in ${file}: published record missing index projection`);
    }
    if (UNPUBLISHED_STATUSES.has(record.status) && record.index) {
      throw new Error(
        `Invalid genealogy in ${file}: unpublished status "${record.status}" must not carry index projection`,
      );
    }
    items.push(record);
  }
  cache = Object.freeze(items);
  return cache;
}

export function clearGenealogyCache(): void {
  cache = null;
}

export function getAll(): readonly Genealogy[] {
  return loadAll();
}

export function listPublished(): readonly Genealogy[] {
  return loadAll().filter(isPublished);
}

export function getBySlug(slug: string): Genealogy | undefined {
  return loadAll().find((g) => g.slug === slug);
}

export function getPublishedBySlug(slug: string): Genealogy | undefined {
  const g = getBySlug(slug);
  return g && isPublished(g) ? g : undefined;
}

export type IndexedGenealogy = Genealogy & {
  index: NonNullable<Genealogy["index"]>;
};

export function listForIndex(): readonly IndexedGenealogy[] {
  return listPublished()
    .filter((g): g is IndexedGenealogy => g.index != null)
    .toSorted(
      (a, b) =>
        a.index.earliest.date.startYear - b.index.earliest.date.startYear ||
        a.phrase.localeCompare(b.phrase, "en") ||
        a.slug.localeCompare(b.slug, "en"),
    );
}

function searchHaystack(g: Genealogy): string[] {
  const terms = [g.phrase, ...g.aliases];
  if (g.index) {
    terms.push(g.index.earliest.date.display, String(g.index.earliest.date.startYear));
    const assertion = g.assertions.find((a) => a.assertionId === g.index!.earliest.assertionId);
    if (assertion?.evidenceRole === "EARLIEST_REPORTED_OCCURRENCE") {
      terms.push(`Reported ${g.index.earliest.date.display}`, "reported");
    }
  }
  for (const a of g.assertions) {
    terms.push(a.subject);
  }
  for (const s of g.sources) {
    terms.push(s.author);
  }
  return terms;
}

export function search(query: string): Genealogy[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return listPublished().filter((g) =>
    searchHaystack(g).some((term) => term.toLowerCase().includes(q)),
  );
}

export type AutocompleteItem = {
  slug: string;
  phrase: string;
  aliases: string[];
  searchTerms: string[];
};

export function listForAutocomplete(): AutocompleteItem[] {
  return listPublishedForAutocomplete();
}

export function listPublishedForAutocomplete(): AutocompleteItem[] {
  return listPublished().map((g) => ({
    slug: g.slug,
    phrase: g.phrase,
    aliases: g.aliases,
    searchTerms: searchHaystack(g),
  }));
}
