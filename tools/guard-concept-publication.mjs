#!/usr/bin/env node
/**
 * Publication leakage + import path isolation guard.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateConceptData } from "./validate-concept-data.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const FORBIDDEN_IMPORT_PATTERNS = [
  /candidate-005\.json/i,
  /TASK_GRAPH\.json/i,
  /ROLE_AUDIT_QUEUE\.csv/i,
  /CANDIDATE_005.*ARTIFACT/i,
  /TRUSTED_VERIFIER/i,
  /research\/concepts\/candidate/i,
  /ORIGIN_CONCEPT_GENEALOGIES_100_CANDIDATE/i,
];

const ALLOWED_DATA_IMPORTS = [
  "data/concepts/catalog.json",
  "data/concepts/publications/",
  "data/concepts/publication-authority.public.json",
  "data/concepts/catalog-receipt.json",
];

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

function countPublicHistoricalClaims(repoRoot) {
  const pubDir = path.join(repoRoot, "data", "concepts", "publications");
  if (!fs.existsSync(pubDir)) return 0;
  let n = 0;
  for (const file of fs.readdirSync(pubDir).filter((f) => f.endsWith(".json"))) {
    const d = JSON.parse(fs.readFileSync(path.join(pubDir, file), "utf8"));
    if (d.status !== "published") continue;
    n += Array.isArray(d.assertions) ? d.assertions.length : 0;
  }
  return n;
}

function guardImportPaths(repoRoot) {
  const errors = [];

  // Production application code must not import research package paths.
  for (const file of walk(path.join(repoRoot, "src"))) {
    if (!/\.(ts|tsx)$/.test(file)) continue;
    const rel = path.relative(repoRoot, file).replace(/\\/g, "/");
    const text = fs.readFileSync(file, "utf8");
    for (const re of FORBIDDEN_IMPORT_PATTERNS) {
      if (
        re.test(text) &&
        /from\s+['"][^'"]+|require\s*\(\s*['"][^'"]+/.test(text) &&
        re.test(
          [...text.matchAll(/(?:from|require\s*\()\s*['"]([^'"]+)['"]/g)]
            .map((m) => m[1])
            .join("\n"),
        )
      ) {
        errors.push(`${rel}: forbidden research import`);
      }
    }
    // Direct reads of research filenames from src/
    if (
      /candidate-005\.json|TASK_GRAPH\.json|ROLE_AUDIT_QUEUE\.csv|TRUSTED_VERIFIER/i.test(
        text,
      ) &&
      /readFile(?:Sync)?\s*\(/.test(text)
    ) {
      errors.push(`${rel}: forbidden research file read`);
    }
  }

  // Concept loaders may only reference allowed product data paths.
  for (const file of walk(path.join(repoRoot, "src", "lib", "concepts"))) {
    if (!/\.(ts|tsx)$/.test(file)) continue;
    const text = fs.readFileSync(file, "utf8");
    const rel = path.relative(repoRoot, file).replace(/\\/g, "/");
    const dataRefs = [...text.matchAll(/data\/concepts\/[a-zA-Z0-9_./-]+/g)].map(
      (m) => m[0],
    );
    for (const ref of dataRefs) {
      const ok = ALLOWED_DATA_IMPORTS.some(
        (a) => ref === a || ref.startsWith(a) || a.startsWith(ref),
      );
      if (!ok) {
        errors.push(`${rel}: unexpected concept data path ${ref}`);
      }
    }
  }

  // Ensure raw research artifacts are not committed under the product tree.
  const forbiddenCommitted = [
    "data/concepts/candidate-005.json",
    "data/concepts/TASK_GRAPH.json",
    "data/concepts/ROLE_AUDIT_QUEUE.csv",
    "data/research",
    "research/concepts/candidate-005",
  ];
  for (const g of forbiddenCommitted) {
    if (fs.existsSync(path.join(repoRoot, g))) {
      errors.push(`raw research path present in repo: ${g}`);
    }
  }

  return errors;
}

export function guardConceptPublication(repoRoot = REPO_ROOT) {
  const validation = validateConceptData(repoRoot);
  const errors = [...validation.errors];
  const publicHistoricalClaimCount = countPublicHistoricalClaims(repoRoot);
  const acceptedAssertionCount = validation.acceptedAssertionCount;

  if (publicHistoricalClaimCount > acceptedAssertionCount) {
    errors.push(
      `public historical claim count ${publicHistoricalClaimCount} exceeds accepted assertion count ${acceptedAssertionCount}`,
    );
  }

  errors.push(...guardImportPaths(repoRoot));

  return {
    ok: errors.length === 0,
    errors,
    acceptedAssertionCount,
    publicHistoricalClaimCount,
    catalogCount: validation.catalogCount,
    publishedCount: validation.publishedCount,
  };
}

function main() {
  const result = guardConceptPublication();
  if (!result.ok) {
    console.error(JSON.stringify(result, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
