#!/usr/bin/env npx tsx
import fs from "node:fs";
import path from "node:path";
import { verifyPublicationBundle } from "../../src/lib/concepts/publication-membrane";

const repoRoot = process.argv[2];
if (!repoRoot) {
  console.error("usage: coordinated-substitution-check.ts <repoRoot>");
  process.exit(1);
}

const bundle = JSON.parse(
  fs.readFileSync(
    path.join(repoRoot, "tests/fixtures/concepts/publication-bundle-valid.json"),
    "utf8",
  ),
);
const fakePin = fs
  .readFileSync(path.join(repoRoot, "tools/pins/publication-authority.sha256"), "utf8")
  .trim();

try {
  verifyPublicationBundle(bundle, repoRoot, {
    fixtureMode: false,
    skipCatalogBinding: true,
    registriesRoot: path.join(repoRoot, "tests/fixtures/concepts/registries"),
    authority: JSON.parse(
      fs.readFileSync(
        path.join(repoRoot, "data/concepts/publication-authority.public.json"),
        "utf8",
      ),
    ),
    pinnedPolicy: JSON.parse(
      fs.readFileSync(
        path.join(repoRoot, "data/concepts/pinned-publication-policy.json"),
        "utf8",
      ),
    ),
    pinFingerprint: fakePin,
  });
  process.exit(2);
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  if (
    /Authority key substitution|fingerprint pin mismatch|Root fingerprint pin mismatch|Unknown signer|Invalid signature|Missing ORIGIN_PUBLICATION/i.test(
      msg,
    )
  ) {
    process.exit(0);
  }
  console.error(msg);
  process.exit(3);
}
