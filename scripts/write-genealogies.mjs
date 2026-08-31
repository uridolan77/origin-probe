/**
 * Canonical genealogy data lives in data/genealogies/*.json.
 *
 * This script is intentionally non-destructive. It validates the committed
 * corpus and optionally rewrites JSON with stable formatting. It does not
 * embed an alternate corpus that could overwrite published records.
 *
 * Usage:
 *   node scripts/write-genealogies.mjs           # validate only
 *   node scripts/write-genealogies.mjs --check   # validate only (alias)
 *   node scripts/write-genealogies.mjs --format  # rewrite with stable JSON formatting
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { GenealogySchema } from "../tools/genealogy-schema.mjs";
import { collectIndexProvenanceErrors } from "../tools/index-provenance.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "data", "genealogies");

function computeHash(sources) {
  const lines = sources
    .map((s) => `${s.sourceId}\t${s.url}\t${s.publicationDate}`)
    .sort((a, b) => a.localeCompare(b));
  const digest = createHash("sha256").update(lines.join("\n"), "utf8").digest("hex");
  return `sha256:${digest.slice(0, 16)}`;
}

function loadAll() {
  if (!existsSync(outDir)) {
    throw new Error(`missing ${outDir}`);
  }
  return readdirSync(outDir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((file) => {
      const full = join(outDir, file);
      const rawText = readFileSync(full, "utf8");
      const raw = JSON.parse(rawText);
      return { file, full, rawText, raw };
    });
}

function validateRecord(file, raw) {
  const parsed = GenealogySchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`${file}: schema ${JSON.stringify(parsed.error.issues)}`);
  }
  const g = parsed.data;
  if (file !== `${g.slug}.json`) {
    throw new Error(`${file}: filename must match slug ${g.slug}.json`);
  }
  const expected = computeHash(g.sources);
  if (g.sourceSetHash !== expected) {
    throw new Error(`${file}: sourceSetHash mismatch got=${g.sourceSetHash} expected=${expected}`);
  }
  const assertionById = new Map(g.assertions.map((a) => [a.assertionId, a]));
  const sourceById = new Map(g.sources.map((s) => [s.sourceId, s]));
  for (const msg of collectIndexProvenanceErrors(g, assertionById, sourceById)) {
    throw new Error(`${file}: ${msg}`);
  }
  return g;
}

const mode = process.argv.includes("--format") ? "format" : "check";
const records = loadAll();
if (records.length === 0) {
  throw new Error("genealogy collection is empty");
}

let rewritten = 0;
for (const { file, full, rawText, raw } of records) {
  const g = validateRecord(file, raw);
  if (mode === "format") {
    const next = `${JSON.stringify(g, null, 2)}\n`;
    if (next !== rawText) {
      writeFileSync(full, next, "utf8");
      rewritten += 1;
    }
  }
}

if (mode === "format") {
  console.log(`write-genealogies: formatted ${rewritten}/${records.length} file(s)`);
} else {
  console.log(`write-genealogies: ok (${records.length} genealogies, no files rewritten)`);
}
