import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(__filename);
const {
  importPublicationBundle,
  validatePublicationBundle,
} = require("../../tools/import-concept-publication.mjs") as {
  importPublicationBundle: (
    bundlePath: string,
    repoRoot?: string,
  ) => { ok: boolean; written: string[] };
  validatePublicationBundle: (
    bundle: unknown,
    authority: { keyId: string; publicKeyBase64: string },
  ) => { ok: boolean };
};

const fixtures = path.join(process.cwd(), "tests/fixtures/concepts");
const authority = JSON.parse(
  fs.readFileSync(
    path.join(process.cwd(), "data/concepts/publication-authority.public.json"),
    "utf8",
  ),
);

function load(name: string) {
  return JSON.parse(fs.readFileSync(path.join(fixtures, name), "utf8"));
}

describe("concept publication importer", () => {
  it("accepts a valid signed publication envelope", () => {
    const bundle = load("publication-bundle-valid.json");
    expect(validatePublicationBundle(bundle, authority).ok).toBe(true);
  });

  it("imports accepted assertions only into a temp publications dir", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "origin-pub-"));
    fs.mkdirSync(path.join(tmp, "data/concepts"), { recursive: true });
    fs.copyFileSync(
      path.join(process.cwd(), "data/concepts/publication-authority.public.json"),
      path.join(tmp, "data/concepts/publication-authority.public.json"),
    );
    const result = importPublicationBundle(
      path.join(fixtures, "publication-bundle-valid.json"),
      tmp,
    );
    expect(result.ok).toBe(true);
    expect(result.written).toHaveLength(1);
    const dossier = JSON.parse(fs.readFileSync(result.written[0]!, "utf8"));
    expect(dossier.assertions).toHaveLength(1);
    expect(dossier.slug).toBe("synthetic-fixture-concept");
  });

  const negatives: [string, string][] = [
    ["publication-bundle-candidate-assertion.json", "Candidate or unaccepted"],
    ["publication-bundle-sourced-unaccepted.json", "Sourced but unaccepted"],
    ["publication-bundle-invalid-signature.json", "Invalid signature"],
    ["publication-bundle-unknown-signer.json", "Unknown signer"],
    ["publication-bundle-digest-mismatch.json", "Digest mismatch"],
    ["publication-bundle-registry-mismatch.json", "Registry mismatch"],
    ["publication-bundle-wrong-repo.json", "Repository mismatch"],
    ["publication-bundle-wrong-host.json", "Canonical host mismatch"],
    ["publication-bundle-duplicate-assertion.json", "Duplicate assertion"],
    ["publication-bundle-duplicate-slug.json", "Duplicate concept slug"],
    ["publication-bundle-caller-selected-earliest.json", "Caller-selected"],
    ["publication-bundle-missing-review-lineage.json", "accepted-review lineage"],
    ["publication-bundle-stale-auth.json", "Stale authorization"],
    ["publication-bundle-withdrawn.json", "withdrawn"],
    ["publication-bundle-arbitrary-projection.json", "Projection not derived"],
  ];

  for (const [file, needle] of negatives) {
    it(`rejects ${file}`, () => {
      const bundle = load(file);
      expect(() => validatePublicationBundle(bundle, authority)).toThrow(
        new RegExp(needle, "i"),
      );
    });
  }
});
