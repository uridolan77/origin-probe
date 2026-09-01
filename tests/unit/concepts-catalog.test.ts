import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { EXPECTED_CONCEPT_IDS } from "@/lib/concepts/concept-ids";
import { CatalogReceiptSchema, ConceptCatalogFileSchema } from "@/lib/concepts/schema";

describe("concept catalog custody", () => {
  it("enforces exact C001–C100 set and receipt parity", () => {
    const catalogRaw = fs
      .readFileSync("data/concepts/catalog.json", "utf8")
      .replace(/\r\n/g, "\n");
    const catalog = ConceptCatalogFileSchema.parse(JSON.parse(catalogRaw));
    expect(catalog.items.map((i) => i.conceptId)).toEqual([...EXPECTED_CONCEPT_IDS]);

    const receipt = CatalogReceiptSchema.parse(
      JSON.parse(fs.readFileSync("data/concepts/catalog-receipt.json", "utf8")),
    );
    const digest = createHash("sha256")
      .update(Buffer.from(catalogRaw, "utf8"))
      .digest("hex");
    expect(receipt.catalogDigest).toBe(digest);
    expect(receipt.catalogCount).toBe(100);
    expect(receipt.acceptedAssertionCount).toBe(0);
    expect(receipt.publishedDossierCount).toBe(0);
    expect(receipt.sourceArtifactDigest).toBe(catalog.sourceArtifactDigest);
  });

  it("rejects C000 as a product concept id", async () => {
    const { ConceptIdSchema } = await import("@/lib/concepts/schema");
    expect(ConceptIdSchema.safeParse("C000").success).toBe(false);
  });
});
