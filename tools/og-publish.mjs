import fs from "node:fs";
import path from "node:path";
import {
  GenealogySchema,
  PUBLISHED_STATUSES,
} from "./genealogy-schema.mjs";

export function loadPublishedGenealogies(dir) {
  if (!fs.existsSync(dir)) return [];
  const published = [];
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const raw = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
    const parsed = GenealogySchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(
        `gen-og-cards: invalid genealogy ${file}: ${JSON.stringify(parsed.error.issues)}`,
      );
    }
    const g = parsed.data;
    if (!PUBLISHED_STATUSES.has(g.status)) continue;
    if (!g.index) {
      throw new Error(`gen-og-cards: published genealogy ${file} missing index projection`);
    }
    published.push(g);
  }
  return published;
}

export function pruneStaleOgCards(directory, publishedSlugs) {
  if (!fs.existsSync(directory)) return [];
  const keep = new Set(publishedSlugs);
  const removed = [];
  for (const file of fs.readdirSync(directory).filter((f) => f.endsWith(".png"))) {
    const slug = file.replace(/\.png$/, "");
    if (keep.has(slug)) continue;
    fs.unlinkSync(path.join(directory, file));
    removed.push(slug);
  }
  return removed;
}
