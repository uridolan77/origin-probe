#!/usr/bin/env npx tsx
/**
 * Publication leakage + import path isolation guard.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateConceptData } from "./validate-concept-data";
import { loadVerifiedPublications, resolveMembraneOptionsForRepo } from "../src/lib/concepts/publication-membrane";
import { regeneratePublicFinding, FINDING_TEMPLATE_VERSION } from "../src/lib/concepts/finding-projection";

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
  "data/concepts/publication-bundles/",
  "data/concepts/publication-authority.public.json",
  "data/concepts/publication-root.public.json",
  "data/concepts/pinned-publication-policy.json",
  "data/concepts/catalog-receipt.json",
  "data/concepts/authority-rotation-envelope.json",
  "data/concepts/registries/",
];

function walk(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

function guardImportPaths(repoRoot: string): string[] {
  const errors: string[] = [];

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
    if (
      /candidate-005\.json|TASK_GRAPH\.json|ROLE_AUDIT_QUEUE\.csv|TRUSTED_VERIFIER/i.test(
        text,
      ) &&
      /readFile(?:Sync)?\s*\(/.test(text)
    ) {
      errors.push(`${rel}: forbidden research file read`);
    }
  }

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

  let publicHistoricalClaimCount = 0;
  let authorizedCount = validation.authorizedAssertionIds?.length ?? 0;
  try {
    const loaded = loadVerifiedPublications(
      repoRoot,
      resolveMembraneOptionsForRepo(repoRoot),
    );
    publicHistoricalClaimCount = loaded.dossiers
      .filter((d) => d.status === "published")
      .reduce(
        (n, d) =>
          n + d.projectionSlots.reduce((m, slot) => m + slot.assertionIds.length, 0),
        0,
      );
    authorizedCount = loaded.authorizedAssertionIds.length;

    const rendered = loaded.dossiers
      .filter((d) => d.status === "published")
      .flatMap((d) =>
        d.projectionSlots.flatMap((slot) => slot.assertionIds),
      )
      .sort();
    const authorized = [...loaded.authorizedAssertionIds].sort();
    if (rendered.join(",") !== authorized.join(",")) {
      for (const id of rendered) {
        if (!loaded.authorizedAssertionIds.includes(id)) {
          errors.push(
            `rendered public assertion ${id} is not authorized by verified publication plans`,
          );
        }
      }
      for (const id of authorized) {
        if (!rendered.includes(id)) {
          errors.push(
            `verified plan selected assertion ${id} is not rendered in public sections`,
          );
        }
      }
      if (rendered.length !== publicHistoricalClaimCount) {
        errors.push("rendered public assertion count mismatch");
      }
    }

    for (const bundle of loaded.bundles) {
      for (const dossier of bundle.dossiers.filter((d) => d.status === "published")) {
        for (const plan of bundle.projectionPlans.filter(
          (p) => p.conceptId === dossier.conceptId && p.slug === dossier.slug,
        )) {
          const regenerated = regeneratePublicFinding({
            templateVersion: FINDING_TEMPLATE_VERSION,
            searchScope: dossier.searchScope,
            slot: plan.slot,
            disposition: plan.disposition,
            selectedAssertionIds: plan.selectedAssertionIds,
            assertions: dossier.assertions,
            sources: dossier.sources,
          });
          if (dossier.finding !== regenerated) {
            errors.push(
              `${dossier.slug}: public finding bytes do not match regenerated projection`,
            );
          }
        }
      }
    }
  } catch (err) {
    errors.push(
      `publication membrane guard: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (publicHistoricalClaimCount > authorizedCount && authorizedCount >= 0) {
    // Prefer exact authorization equality for published assertion IDs
    const acceptedAssertionCount = validation.acceptedAssertionCount;
    if (publicHistoricalClaimCount > acceptedAssertionCount) {
      errors.push(
        `public historical claim count ${publicHistoricalClaimCount} exceeds accepted assertion count ${acceptedAssertionCount}`,
      );
    }
  }

  errors.push(...guardImportPaths(repoRoot));

  // Authority pin files must exist
  const pinPath = path.join(
    repoRoot,
    "tools",
    "pins",
    "publication-authority.sha256",
  );
  const rootPinPath = path.join(
    repoRoot,
    "tools",
    "pins",
    "publication-root.sha256",
  );
  if (!fs.existsSync(pinPath)) {
    errors.push("missing tools/pins/publication-authority.sha256");
  }
  if (!fs.existsSync(rootPinPath)) {
    errors.push("missing tools/pins/publication-root.sha256");
  }

  const roleRegistryPath = path.join(
    repoRoot,
    "data",
    "concepts",
    "registries",
    "role-registry.json",
  );
  const policyRegistryPath = path.join(
    repoRoot,
    "data",
    "concepts",
    "registries",
    "policy-registry.json",
  );
  if (!fs.existsSync(roleRegistryPath)) {
    errors.push("missing data/concepts/registries/role-registry.json");
  }
  if (!fs.existsSync(policyRegistryPath)) {
    errors.push("missing data/concepts/registries/policy-registry.json");
  }

  return {
    ok: errors.length === 0,
    errors,
    acceptedAssertionCount: validation.acceptedAssertionCount,
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
