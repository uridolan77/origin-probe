#!/usr/bin/env npx tsx
/**
 * Import a signed origin_site_concept_publication_v1 bundle.
 * Authoritative input is copied to data/concepts/publication-bundles/;
 * derived dossiers are written under data/concepts/publications/ with byte parity.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { importPublicationBundle } from "../src/lib/concepts/publication-membrane";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

export { importPublicationBundle, validatePublicationBundle } from "../src/lib/concepts/publication-membrane";

function main() {
  const bundlePath = process.argv[2];
  if (!bundlePath) {
    console.error(
      "Usage: npx tsx tools/import-concept-publication.ts <bundle.json>",
    );
    process.exit(1);
  }
  try {
    const result = importPublicationBundle(path.resolve(bundlePath), REPO_ROOT);
    console.log(
      JSON.stringify(
        { ok: result.ok, written: result.written },
        null,
        2,
      ),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ ok: false, error: message }, null, 2));
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
