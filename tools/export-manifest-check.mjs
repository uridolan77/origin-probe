#!/usr/bin/env node
/**
 * Deny-by-default export manifest check.
 * Ensures tracked publishable paths fall into an allowed category glob,
 * and that the manifest itself is well-formed.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(root, "PUBLIC_EXPORT_MANIFEST.json");

const REQUIRED_CATEGORIES = [
  "product_source",
  "static_genealogy_data",
  "public_citations",
  "public_methodology",
  "analytics_event_contract",
  "correction_mechanism",
  "generated_social_cards",
  "ordinary_build_configuration",
];

function globToRegExp(glob) {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "{{GLOBSTAR}}")
    .replace(/\*/g, "[^/\\\\]*")
    .replace(/{{GLOBSTAR}}/g, ".*");
  return new RegExp(`^${escaped}$`);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

if (manifest.policy !== "deny_by_default") {
  console.error("export-manifest-check: policy must be deny_by_default");
  process.exit(1);
}

const categories = manifest.categories || {};
let failed = false;

for (const name of REQUIRED_CATEGORIES) {
  if (!categories[name] || !Array.isArray(categories[name].globs)) {
    failed = true;
    console.error(`missing category or globs: ${name}`);
  }
}

const allGlobs = [];
for (const [name, cat] of Object.entries(categories)) {
  for (const g of cat.globs || []) {
    allGlobs.push({ name, g, re: globToRegExp(g.replace(/\\/g, "/")) });
  }
}

/** Representative paths that must be allowlisted. */
const mustAllow = [
  "src/app/page.tsx",
  "src/lib/events.ts",
  "src/lib/corrections.ts",
  "src/components/CorrectionForm.tsx",
  "data/genealogies/example.json",
  "docs/EVENT_CONTRACT.md",
  "LAUNCH_READINESS.md",
  "public/og/sample.png",
  "package.json",
  "tools/validate-data.mjs",
  ".github/workflows/ci.yml",
];

for (const rel of mustAllow) {
  const normalized = rel.replace(/\\/g, "/");
  const hit = allGlobs.some((x) => x.re.test(normalized));
  if (!hit) {
    failed = true;
    console.error(`no category allows representative path: ${normalized}`);
  }
}

/** Paths that must remain denied. */
const mustDeny = [
  "secrets/prod.env",
  "internal/notes.md",
  "private/research.docx",
];

for (const rel of mustDeny) {
  const normalized = rel.replace(/\\/g, "/");
  const hit = allGlobs.some((x) => x.re.test(normalized));
  if (hit) {
    failed = true;
    console.error(`path unexpectedly allowed: ${normalized}`);
  }
}

if (failed) process.exit(1);
console.log("export-manifest-check: ok");
