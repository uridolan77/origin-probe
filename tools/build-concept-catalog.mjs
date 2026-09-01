#!/usr/bin/env node
/**
 * Build sanitized concept catalog from sealed Candidate 005 ZIP archives only.
 *
 * Usage:
 *   node tools/build-concept-catalog.mjs --artifact-zip <zip> --c092-zip <zip>
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildConceptCatalogFromZips } from "./lib/build-concept-catalog-core.mjs";

export { buildConceptCatalogFromZips } from "./lib/build-concept-catalog-core.mjs";

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const val = argv[i + 1];
      if (!val || val.startsWith("--")) throw new Error(`Missing value for --${key}`);
      out[key] = val;
      i++;
    }
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv);
  if (args["artifact-dir"] || args["c092-report"]) {
    console.error(
      "Refusing trusted --artifact-dir / --c092-report. Pass sealed --artifact-zip and --c092-zip only.",
    );
    process.exit(1);
  }
  const result = buildConceptCatalogFromZips({
    artifactZip: args["artifact-zip"],
    c092Zip: args["c092-zip"],
  });
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
