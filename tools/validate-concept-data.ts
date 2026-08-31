#!/usr/bin/env npx tsx
/**
 * Validate concept catalog, receipt parity, and signed publication membrane.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { EXPECTED_CONCEPT_IDS, EXPECTED_CONCEPT_ID_SET } from "../src/lib/concepts/concept-ids";
import {
  CatalogReceiptSchema,
  ConceptCatalogFileSchema,
  FORBIDDEN_CATALOG_CLAIM_KEYS,
} from "../src/lib/concepts/schema";
import {
  loadVerifiedPublications,
  PublicationRejectedError,
} from "../src/lib/concepts/publication-membrane";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

function sha256Hex(buf: Buffer | string): string {
  return createHash("sha256").update(buf).digest("hex");
}

export function validateConceptData(repoRoot = REPO_ROOT) {
  const errors: string[] = [];
  const fail = (msg: string) => errors.push(msg);

  const catalogPath = path.join(repoRoot, "data", "concepts", "catalog.json");
  if (!fs.existsSync(catalogPath)) {
    fail("missing data/concepts/catalog.json");
    return { ok: false, errors, catalogCount: 0, publishedCount: 0, acceptedAssertionCount: 0 };
  }

  const catalogRaw = fs.readFileSync(catalogPath, "utf8").replace(/\r\n/g, "\n");
  let catalog;
  try {
    catalog = ConceptCatalogFileSchema.parse(JSON.parse(catalogRaw));
  } catch (err) {
    fail(`catalog schema: ${err instanceof Error ? err.message : String(err)}`);
    return { ok: false, errors, catalogCount: 0, publishedCount: 0, acceptedAssertionCount: 0 };
  }

  const ids = catalog.items.map((i) => i.conceptId);
  if (
    ids.length !== EXPECTED_CONCEPT_IDS.length ||
    ids.some((id, i) => id !== EXPECTED_CONCEPT_IDS[i])
  ) {
    fail("catalog must be exactly the set C001–C100 in sorted order");
  }
  for (const id of ids) {
    if (!EXPECTED_CONCEPT_ID_SET.has(id)) fail(`invalid conceptId ${id}`);
  }
  if (ids.includes("C000")) fail("C000 is not a valid product concept id");

  const slugs = new Set<string>();
  for (const item of catalog.items) {
    if (slugs.has(item.slug)) fail(`duplicate slug ${item.slug}`);
    slugs.add(item.slug);
    for (const key of Object.keys(item)) {
      if ((FORBIDDEN_CATALOG_CLAIM_KEYS as readonly string[]).includes(key)) {
        fail(`${item.conceptId}: forbidden catalog field ${key}`);
      }
    }
  }

  const c092 = catalog.items.find((i) => i.conceptId === "C092");
  if (!c092) fail("C092 missing from catalog");
  else if (c092.researchMaturity !== "partially_verified") {
    fail("C092 must be partially_verified");
  } else if (c092.publicFindingAvailable) {
    fail("C092 must not have a public finding");
  }

  // Receipt parity
  const receiptPath = path.join(repoRoot, "data", "concepts", "catalog-receipt.json");
  if (!fs.existsSync(receiptPath)) {
    fail("missing data/concepts/catalog-receipt.json");
  } else {
    try {
      const receipt = CatalogReceiptSchema.parse(
        JSON.parse(fs.readFileSync(receiptPath, "utf8")),
      );
      const fileDigest = sha256Hex(Buffer.from(catalogRaw, "utf8"));
      if (receipt.catalogDigest !== fileDigest) {
        fail("catalog receipt drift: catalogDigest mismatch");
      }
      if (receipt.catalogCount !== 100) fail("catalog receipt catalogCount mismatch");
      if (receipt.sourceArtifactDigest !== catalog.sourceArtifactDigest) {
        fail("catalog receipt sourceArtifactDigest mismatch");
      }
      if (receipt.corpusAuditDigest !== catalog.generatedFrom.corpusAuditDigest) {
        fail("catalog receipt corpusAuditDigest mismatch");
      }
      if (receipt.c092PilotDigest !== catalog.generatedFrom.c092PilotDigest) {
        fail("catalog receipt c092PilotDigest mismatch");
      }
    } catch (err) {
      fail(`catalog receipt: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  let publishedCount = 0;
  let acceptedAssertionCount = 0;
  let authorizedAssertionIds: string[] = [];

  try {
    const loaded = loadVerifiedPublications(repoRoot);
    publishedCount = loaded.dossiers.filter((d) => d.status === "published").length;
    acceptedAssertionCount = loaded.dossiers
      .filter((d) => d.status === "published")
      .reduce((n, d) => n + d.assertions.length, 0);
    authorizedAssertionIds = loaded.authorizedAssertionIds;

    for (const d of loaded.dossiers) {
      const cat = catalog.items.find((i) => i.slug === d.slug);
      if (cat && cat.researchMaturity !== "published") {
        fail(
          `${d.slug}: published dossier present but catalog maturity is not published`,
        );
      }
    }
  } catch (err) {
    if (err instanceof PublicationRejectedError || (err as { code?: string }).code === "PUBLICATION_REJECTED") {
      fail(`publication membrane: ${err instanceof Error ? err.message : String(err)}`);
    } else {
      fail(`publication load: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Reject orphan JSON even when loadVerifiedPublications short-circuits empty bundles
  const pubDir = path.join(repoRoot, "data", "concepts", "publications");
  const bundlesDir = path.join(repoRoot, "data", "concepts", "publication-bundles");
  const bundleFiles = fs.existsSync(bundlesDir)
    ? fs.readdirSync(bundlesDir).filter((f) => f.endsWith(".json"))
    : [];
  if (fs.existsSync(pubDir)) {
    const pubFiles = fs.readdirSync(pubDir).filter((f) => f.endsWith(".json"));
    if (pubFiles.length > 0 && bundleFiles.length === 0) {
      fail("Standalone dossier injection rejected: publications without governing bundles");
    }
  }

  if (publishedCount === 0) {
    for (const item of catalog.items) {
      if (item.researchMaturity === "published") {
        fail(`${item.conceptId}: published without signed dossier`);
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    catalogCount: catalog.items.length,
    publishedCount,
    acceptedAssertionCount,
    authorizedAssertionIds,
  };
}

function main() {
  const result = validateConceptData();
  if (!result.ok) {
    console.error(JSON.stringify(result, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
