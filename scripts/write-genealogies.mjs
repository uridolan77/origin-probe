/**
 * Canonical genealogy data lives in data/genealogies/*.json.
 *
 * This script is intentionally non-destructive. It validates the committed
 * corpus via the canonical validator and optionally rewrites JSON with stable
 * formatting. It does not embed an alternate corpus that could overwrite
 * published records.
 *
 * Usage:
 *   node scripts/write-genealogies.mjs           # validate only
 *   node scripts/write-genealogies.mjs --check   # validate only (alias)
 *   node scripts/write-genealogies.mjs --format  # rewrite with stable JSON formatting
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validateCorpus } from "../tools/validate-data.mjs";
import { GenealogySchema } from "../tools/genealogy-schema.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "data", "genealogies");

const mode = process.argv.includes("--format") ? "format" : "check";

const result = validateCorpus(root);
if (!result.ok) {
  for (const msg of result.errors) {
    console.error(`write-genealogies: FAIL — ${msg}`);
  }
  process.exit(1);
}

if (mode === "check") {
  console.log(`write-genealogies: ok (${result.count} genealogies, no files rewritten)`);
  process.exit(0);
}

if (!existsSync(outDir)) {
  throw new Error(`missing ${outDir}`);
}

let rewritten = 0;
const files = readdirSync(outDir)
  .filter((f) => f.endsWith(".json"))
  .sort();

for (const file of files) {
  const full = join(outDir, file);
  const rawText = readFileSync(full, "utf8");
  const raw = JSON.parse(rawText);
  const parsed = GenealogySchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`${file}: schema ${JSON.stringify(parsed.error.issues)}`);
  }
  const next = `${JSON.stringify(parsed.data, null, 2)}\n`;
  if (next !== rawText) {
    writeFileSync(full, next, "utf8");
    rewritten += 1;
  }
}

console.log(`write-genealogies: formatted ${rewritten}/${files.length} file(s)`);
