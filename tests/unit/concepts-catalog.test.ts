import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  ConceptCatalogFileSchema,
  FORBIDDEN_CATALOG_CLAIM_KEYS,
} from "@/lib/concepts/schema";
import { listConceptCatalog, getConceptById } from "@/lib/concepts/catalog";
import { MATURITY_DISPLAY } from "@/lib/concepts/display";
import { listPublishedConcepts } from "@/lib/concepts/publications";

describe("concept catalog", () => {
  it("contains exactly 100 unique concept IDs and slugs in order", () => {
    const items = listConceptCatalog();
    expect(items).toHaveLength(100);
    const ids = items.map((i) => i.conceptId);
    const slugs = items.map((i) => i.slug);
    expect(new Set(ids).size).toBe(100);
    expect(new Set(slugs).size).toBe(100);
    for (let i = 1; i < items.length; i++) {
      expect(items[i - 1]!.conceptId.localeCompare(items[i]!.conceptId, "en")).toBeLessThan(
        0,
      );
    }
  });

  it("parses with the product schema", () => {
    const raw = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "data/concepts/catalog.json"), "utf8"),
    );
    const parsed = ConceptCatalogFileSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
  });

  it("excludes candidate assertion fields and historical claim text keys", () => {
    const raw = fs.readFileSync(
      path.join(process.cwd(), "data/concepts/catalog.json"),
      "utf8",
    );
    for (const key of FORBIDDEN_CATALOG_CLAIM_KEYS) {
      expect(raw.includes(`"${key}"`)).toBe(false);
    }
    expect(raw.toLowerCase()).not.toMatch(/most likely origin/);
  });

  it("derives C092 as partially_verified without a public finding", () => {
    const c092 = getConceptById("C092");
    expect(c092).toBeTruthy();
    expect(c092!.researchMaturity).toBe("partially_verified");
    expect(c092!.publicFindingAvailable).toBe(false);
    expect(c092!.publicationSlug).toBeNull();
    expect(MATURITY_DISPLAY.partially_verified.label).toBe(
      "Sources inspected — no public finding yet",
    );
  });

  it("does not mark any real record published without a signed dossier", () => {
    const items = listConceptCatalog();
    expect(items.every((i) => i.researchMaturity !== "published")).toBe(true);
    expect(listPublishedConcepts()).toHaveLength(0);
  });

  it("keeps public historical claim count at zero", () => {
    expect(listPublishedConcepts().flatMap((d) => d.assertions)).toHaveLength(0);
  });
});
