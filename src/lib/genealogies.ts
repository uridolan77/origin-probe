import fs from "node:fs";
import path from "node:path";
import { GenealogySchema, type Genealogy } from "./schema";

const DATA_DIR = path.join(process.cwd(), "data", "genealogies");
const PUBLISHED_STATUSES = new Set(["provisional", "reviewed"]);

let cache: readonly Genealogy[] | null = null;

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
    if (PUBLISHED_STATUSES.has(record.status) && !record.index) {
      throw new Error(`Invalid genealogy in ${file}: published record missing index projection`);
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

export function getBySlug(slug: string): Genealogy | undefined {
  return loadAll().find((g) => g.slug === slug);
}

export type IndexedGenealogy = Genealogy & {
  index: NonNullable<Genealogy["index"]>;
};

export function listForIndex(): readonly IndexedGenealogy[] {
  return getAll().filter(
    (g): g is IndexedGenealogy => g.index != null,
  ).toSorted(
      (a, b) =>
        a.index.earliest.date.startYear - b.index.earliest.date.startYear ||
        a.phrase.localeCompare(b.phrase, "en") ||
        a.slug.localeCompare(b.slug),
    );
}

export function search(query: string): Genealogy[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return loadAll().filter((g) => {
    if (g.phrase.toLowerCase().includes(q)) return true;
    return g.aliases.some((a) => a.toLowerCase().includes(q));
  });
}

export type AutocompleteItem = {
  slug: string;
  phrase: string;
  aliases: string[];
};

export function listForAutocomplete(): AutocompleteItem[] {
  return getAll().map((g) => ({
    slug: g.slug,
    phrase: g.phrase,
    aliases: g.aliases,
  }));
}
