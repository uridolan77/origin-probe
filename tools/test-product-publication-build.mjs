#!/usr/bin/env node
/**
 * Fixture-backed static-export product-path witness.
 *
 * Temporarily overlays a signed publication fixture into the live repo, runs
 * `next build`, asserts exported HTML/sitemap contain the published finding,
 * then restores the original concept data tree.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = path.join(repoRoot, "tests/fixtures/concepts");
const conceptsDir = path.join(repoRoot, "data/concepts");
const pinsDir = path.join(repoRoot, "tools/pins");
const outDir = path.join(repoRoot, "out");

const fixturePolicy = JSON.parse(
  fs.readFileSync(path.join(fixtures, "keys/fixture-pinned-policy.json"), "utf8"),
);
const fixtureAuthority = JSON.parse(
  fs.readFileSync(path.join(fixtures, "keys/fixture-only.public.json"), "utf8"),
);

function sha256Text(text) {
  return createHash("sha256").update(text.replace(/\r\n/g, "\n")).digest("hex");
}

function backupTree(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.cpSync(src, dest, { recursive: true });
}

function restoreTree(backup, dest) {
  if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
  if (fs.existsSync(backup)) fs.cpSync(backup, dest, { recursive: true });
}

function buildCatalogOverlay() {
  const catalogItem = {
    conceptId: "C042",
    slug: "synthetic-fixture-concept",
    label: "Synthetic fixture concept",
    aliases: ["fixture concept"],
    objectKind: "thought_experiment",
    domains: ["Fixture domain"],
    researchMaturity: "published",
    publicFindingAvailable: true,
    openTaskCount: 0,
    sourceLeadCount: 1,
    evidenceLeadCount: 1,
    acceptedAssertionCount: 1,
    publicationSlug: "synthetic-fixture-concept",
    sourcePackageId: "ORIGIN-CONCEPT-GENEALOGIES-100-CANDIDATE-005",
    sourceRecordDigest: "a".repeat(64),
  };

  const catalog = {
    schemaVersion: 1,
    sourcePackageId: "ORIGIN-CONCEPT-GENEALOGIES-100-CANDIDATE-005",
    sourceArtifactDigest:
      "a2e463e0b134b4ed49ebb6cced8d0bf1afbb2dcf5780568d7e66ac31299d6814",
    generatedFrom: {
      artifactDigest:
        "a2e463e0b134b4ed49ebb6cced8d0bf1afbb2dcf5780568d7e66ac31299d6814",
      corpusAuditDigest: "b".repeat(64),
      c092PilotDigest: null,
    },
    items: Array.from({ length: 100 }, (_, i) => {
      const conceptId = `C${String(i + 1).padStart(3, "0")}`;
      if (conceptId === "C042") return catalogItem;
      if (conceptId === "C092") {
        return {
          conceptId: "C092",
          slug: "trolley-problem",
          label: "Trolley problem",
          aliases: [],
          objectKind: "thought_experiment",
          domains: ["Ethics"],
          researchMaturity: "partially_verified",
          publicFindingAvailable: false,
          openTaskCount: 0,
          sourceLeadCount: 0,
          evidenceLeadCount: 0,
          acceptedAssertionCount: 0,
          publicationSlug: null,
          sourcePackageId: "ORIGIN-CONCEPT-GENEALOGIES-100-CANDIDATE-005",
          sourceRecordDigest: "d".repeat(64),
        };
      }
      return {
        conceptId,
        slug: `fixture-${conceptId.toLowerCase()}`,
        label: `Fixture ${conceptId}`,
        aliases: [],
        objectKind: "theory",
        domains: ["Fixture"],
        researchMaturity: "research_queue",
        publicFindingAvailable: false,
        openTaskCount: 0,
        sourceLeadCount: 0,
        evidenceLeadCount: 0,
        acceptedAssertionCount: 0,
        publicationSlug: null,
        sourcePackageId: "ORIGIN-CONCEPT-GENEALOGIES-100-CANDIDATE-005",
        sourceRecordDigest: "c".repeat(64),
      };
    }),
  };

  for (const name of [
    "publication-bundles",
    "publications",
    "registries",
  ]) {
    const p = path.join(conceptsDir, name);
    if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
  }
  fs.mkdirSync(path.join(conceptsDir, "registries"), { recursive: true });
  for (const file of fs.readdirSync(path.join(fixtures, "registries"))) {
    fs.copyFileSync(
      path.join(fixtures, "registries", file),
      path.join(conceptsDir, "registries", file),
    );
  }

  fs.writeFileSync(
    path.join(conceptsDir, "catalog.json"),
    `${JSON.stringify(catalog, null, 2)}\n`,
  );
  const catalogRaw = fs.readFileSync(path.join(conceptsDir, "catalog.json"), "utf8");
  fs.writeFileSync(
    path.join(conceptsDir, "catalog-receipt.json"),
    `${JSON.stringify(
      {
        receiptKind: "origin_concept_catalog_receipt_v1",
        sourcePackageId: catalog.sourcePackageId,
        sourceArtifactDigest: catalog.sourceArtifactDigest,
        corpusAuditDigest: catalog.generatedFrom.corpusAuditDigest,
        c092PilotDigest: null,
        catalogDigest: sha256Text(catalogRaw),
        catalogCount: 100,
        acceptedAssertionCount: 1,
        publishedDossierCount: 1,
        c092Maturity: "partially_verified",
        transformationBoundary: "Fixture product-path build witness",
      },
      null,
      2,
    )}\n`,
  );
  fs.writeFileSync(
    path.join(conceptsDir, "pinned-publication-policy.json"),
    `${JSON.stringify(fixturePolicy, null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(conceptsDir, "publication-authority.public.json"),
    `${JSON.stringify(fixtureAuthority, null, 2)}\n`,
  );
  fs.mkdirSync(pinsDir, { recursive: true });
  fs.writeFileSync(
    path.join(pinsDir, "publication-authority.sha256"),
    `${fixturePolicy.authorityFingerprintSha256}\n`,
  );
}

const backupRoot = fs.mkdtempSync(path.join(os.tmpdir(), "origin-product-backup-"));
const conceptsBackup = path.join(backupRoot, "concepts");
const pinsBackup = path.join(backupRoot, "pins");
const outBackup = path.join(backupRoot, "out");

console.log(`product-build-witness backup=${backupRoot}`);

try {
  backupTree(conceptsDir, conceptsBackup);
  backupTree(pinsDir, pinsBackup);
  backupTree(outDir, outBackup);

  buildCatalogOverlay();

  const importTs = path.join(backupRoot, "_import-fixture.ts");
  fs.writeFileSync(
    importTs,
    `import { importPublicationBundle } from "${path
      .join(repoRoot, "src/lib/concepts/publication-membrane.ts")
      .replace(/\\/g, "/")}";
const membraneOpts = {
  fixtureMode: true as const,
  authority: ${JSON.stringify(fixtureAuthority)},
  pinnedPolicy: ${JSON.stringify(fixturePolicy)},
  pinFingerprint: ${JSON.stringify(fixturePolicy.authorityFingerprintSha256)},
  registriesRoot: ${JSON.stringify(
      path.join(conceptsDir, "registries").replace(/\\/g, "/"),
    )},
};
const imported = importPublicationBundle(
  ${JSON.stringify(
      path.join(fixtures, "publication-bundle-valid.json").replace(/\\/g, "/"),
    )},
  ${JSON.stringify(repoRoot.replace(/\\/g, "/"))},
  membraneOpts,
);
if (!imported.ok) {
  console.error(JSON.stringify(imported));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true }));
`,
  );

  const importRun = spawnSync("npx", ["tsx", importTs], {
    cwd: repoRoot,
    encoding: "utf8",
    shell: true,
  });
  if (importRun.status !== 0) {
    console.error(importRun.stdout);
    console.error(importRun.stderr);
    throw new Error(`importPublicationBundle failed with exit ${importRun.status}`);
  }

  const bundle = JSON.parse(
    fs.readFileSync(path.join(fixtures, "publication-bundle-valid.json"), "utf8"),
  );
  const dossier = bundle.dossiers[0];
  const findingSnippet = dossier.finding.slice(0, 80);
  const claimSnippet = dossier.assertions[0].claim.slice(0, 60);

  if (fs.existsSync(outDir)) fs.rmSync(outDir, { recursive: true, force: true });

  const build = spawnSync("npx", ["next", "build"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      SITE_URL: "http://localhost:3000",
      ORIGIN_PAGES_BASE_PATH: "",
      NEXT_PUBLIC_ORIGIN_LIVE_ANALYTICS: "false",
      CI: "true",
      ORIGIN_REQUIRE_EXTERNAL_PINS: "0",
    },
    encoding: "utf8",
    shell: true,
  });
  if (build.status !== 0) {
    console.error(build.stdout);
    console.error(build.stderr);
    throw new Error(`next build failed with exit ${build.status}`);
  }

  const htmlPath = path.join(outDir, "concepts/synthetic-fixture-concept/index.html");
  if (!fs.existsSync(htmlPath)) {
    throw new Error(`Missing exported page: ${htmlPath}`);
  }
  const html = fs.readFileSync(htmlPath, "utf8");
  if (!html.includes("Synthetic fixture concept")) {
    throw new Error("Exported HTML missing concept title");
  }
  if (!html.includes(findingSnippet)) {
    throw new Error("Exported HTML missing regenerated finding prose");
  }
  if (!html.includes(claimSnippet)) {
    throw new Error("Exported HTML missing authorized assertion claim");
  }

  const sitemapPath = path.join(outDir, "sitemap.xml");
  if (!fs.existsSync(sitemapPath)) {
    throw new Error(`Missing sitemap: ${sitemapPath}`);
  }
  const sitemap = fs.readFileSync(sitemapPath, "utf8");
  if (!sitemap.includes("/concepts/synthetic-fixture-concept/")) {
    throw new Error("Sitemap missing published concept URL");
  }

  console.log(
    JSON.stringify({
      ok: true,
      message: "Fixture-backed next build product-path witness PASS",
      htmlPath,
      sitemapPath,
    }),
  );
} finally {
  restoreTree(conceptsBackup, conceptsDir);
  restoreTree(pinsBackup, pinsDir);
  restoreTree(outBackup, outDir);
  try {
    fs.rmSync(backupRoot, { recursive: true, force: true });
  } catch {
    /* best-effort */
  }
}
