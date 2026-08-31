#!/usr/bin/env node
/**
 * Validate concept catalog and published dossiers.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const OBJECT_KINDS = new Set([
  "argument",
  "case_family",
  "distinction",
  "doctrine",
  "framework",
  "lexeme_concept",
  "method",
  "paradox",
  "principle",
  "problem_family",
  "reception_formula",
  "theory",
  "thought_experiment",
]);

const MATURITIES = new Set([
  "research_queue",
  "source_leads_mapped",
  "partially_verified",
  "published",
]);

const FORBIDDEN_KEYS = new Set([
  "claim",
  "finding",
  "assertions",
  "earliest",
  "originator",
  "timeline",
  "candidateView",
  "legacyCandidate",
]);

export function validateConceptData(repoRoot = REPO_ROOT) {
  const errors = [];
  const fail = (msg) => errors.push(msg);

  const catalogPath = path.join(repoRoot, "data", "concepts", "catalog.json");
  if (!fs.existsSync(catalogPath)) {
    fail("missing data/concepts/catalog.json");
    return { ok: false, errors, catalogCount: 0, publishedCount: 0 };
  }

  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  if (catalog.schemaVersion !== 1) fail("catalog schemaVersion must be 1");
  if (!Array.isArray(catalog.items) || catalog.items.length !== 100) {
    fail(`catalog must contain exactly 100 items, got ${catalog.items?.length}`);
  }

  const ids = new Set();
  const slugs = new Set();
  for (const item of catalog.items ?? []) {
    if (!/^C(?:0[0-9]{2}|100)$/.test(item.conceptId)) {
      fail(`invalid conceptId ${item.conceptId}`);
    }
    if (ids.has(item.conceptId)) fail(`duplicate conceptId ${item.conceptId}`);
    ids.add(item.conceptId);
    if (slugs.has(item.slug)) fail(`duplicate slug ${item.slug}`);
    slugs.add(item.slug);
    if (!OBJECT_KINDS.has(item.objectKind)) {
      fail(`${item.conceptId}: invalid objectKind`);
    }
    if (!MATURITIES.has(item.researchMaturity)) {
      fail(`${item.conceptId}: invalid researchMaturity`);
    }
    for (const key of Object.keys(item)) {
      if (FORBIDDEN_KEYS.has(key)) {
        fail(`${item.conceptId}: forbidden catalog field ${key}`);
      }
    }
    if (item.researchMaturity !== "published") {
      if (item.publicFindingAvailable || item.publicationSlug) {
        fail(`${item.conceptId}: non-published item advertises public finding`);
      }
    }
  }

  // Deterministic ordering
  for (let i = 1; i < (catalog.items?.length ?? 0); i++) {
    if (
      catalog.items[i - 1].conceptId.localeCompare(catalog.items[i].conceptId, "en") >=
      0
    ) {
      fail("catalog items must be sorted by conceptId");
      break;
    }
  }

  const c092 = (catalog.items ?? []).find((i) => i.conceptId === "C092");
  if (!c092) fail("C092 missing from catalog");
  else if (c092.researchMaturity !== "partially_verified") {
    fail("C092 must be partially_verified");
  } else if (c092.publicFindingAvailable) {
    fail("C092 must not have a public finding");
  }

  const pubDir = path.join(repoRoot, "data", "concepts", "publications");
  let publishedCount = 0;
  let acceptedAssertionCount = 0;
  if (fs.existsSync(pubDir)) {
    const files = fs.readdirSync(pubDir).filter((f) => f.endsWith(".json"));
    publishedCount = files.length;
    for (const file of files) {
      const d = JSON.parse(fs.readFileSync(path.join(pubDir, file), "utf8"));
      acceptedAssertionCount += Array.isArray(d.assertions) ? d.assertions.length : 0;
      const cat = (catalog.items ?? []).find((i) => i.slug === d.slug);
      if (cat && cat.researchMaturity !== "published") {
        fail(
          `${d.slug}: published dossier present but catalog maturity is not published`,
        );
      }
    }
  }

  // Without signed publications, no catalog item may be published
  if (publishedCount === 0) {
    for (const item of catalog.items ?? []) {
      if (item.researchMaturity === "published") {
        fail(`${item.conceptId}: published without signed dossier`);
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    catalogCount: catalog.items?.length ?? 0,
    publishedCount,
    acceptedAssertionCount,
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
