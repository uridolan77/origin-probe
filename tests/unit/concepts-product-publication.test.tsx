import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  importPublicationBundle,
  loadVerifiedPublications,
} from "@/lib/concepts/publication-membrane";
import { generateMetadata, generateStaticParams } from "@/app/concepts/[slug]/page";
import sitemap from "@/app/sitemap";
import { clearConceptPublicationCache } from "@/lib/concepts/publications";
import { clearConceptCatalogCache } from "@/lib/concepts/catalog";
import { pathToFileURL } from "node:url";

const fixtures = path.join(process.cwd(), "tests/fixtures/concepts");
const fixturePolicy = JSON.parse(
  fs.readFileSync(path.join(fixtures, "keys/fixture-pinned-policy.json"), "utf8"),
);
const fixtureAuthority = JSON.parse(
  fs.readFileSync(path.join(fixtures, "keys/fixture-only.public.json"), "utf8"),
);

const membraneOpts = {
  fixtureMode: true as const,
  authority: fixtureAuthority,
  pinnedPolicy: fixturePolicy,
  pinFingerprint: fixturePolicy.authorityFingerprintSha256,
  registriesRoot: path.join(fixtures, "registries"),
};

function buildCatalogFixtureRepo(tmp: string) {
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

  fs.mkdirSync(path.join(tmp, "data/concepts/registries"), { recursive: true });
  for (const file of fs.readdirSync(path.join(fixtures, "registries"))) {
    fs.copyFileSync(
      path.join(fixtures, "registries", file),
      path.join(tmp, "data/concepts/registries", file),
    );
  }
  fs.writeFileSync(
    path.join(tmp, "data/concepts/catalog.json"),
    `${JSON.stringify(catalog, null, 2)}\n`,
  );
  const catalogRaw = fs.readFileSync(path.join(tmp, "data/concepts/catalog.json"), "utf8");
  const catalogDigest = createHash("sha256").update(catalogRaw.replace(/\r\n/g, "\n")).digest("hex");
  fs.writeFileSync(
    path.join(tmp, "data/concepts/catalog-receipt.json"),
    `${JSON.stringify(
      {
        receiptKind: "origin_concept_catalog_receipt_v1",
        sourcePackageId: catalog.sourcePackageId,
        sourceArtifactDigest: catalog.sourceArtifactDigest,
        corpusAuditDigest: catalog.generatedFrom.corpusAuditDigest,
        c092PilotDigest: null,
        catalogDigest,
        catalogCount: 100,
        acceptedAssertionCount: 1,
        publishedDossierCount: 1,
        c092Maturity: "partially_verified",
        transformationBoundary: "Fixture product-path witness",
      },
      null,
      2,
    )}\n`,
  );
  fs.writeFileSync(
    path.join(tmp, "data/concepts/pinned-publication-policy.json"),
    `${JSON.stringify(fixturePolicy, null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(tmp, "data/concepts/publication-authority.public.json"),
    `${JSON.stringify(fixtureAuthority, null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(tmp, "data/concepts/publication-root.public.json"),
    fs.readFileSync(path.join(process.cwd(), "data/concepts/publication-root.public.json")),
  );
  fs.mkdirSync(path.join(tmp, "tools/pins"), { recursive: true });
  fs.writeFileSync(
    path.join(tmp, "tools/pins/publication-authority.sha256"),
    `${fixturePolicy.authorityFingerprintSha256}\n`,
  );
  fs.writeFileSync(
    path.join(tmp, "tools/pins/publication-root.sha256"),
    fs.readFileSync(path.join(process.cwd(), "tools/pins/publication-root.sha256")),
  );
}

describe("catalog-aware product publication path", () => {
  let tmp = "";
  let prevCwd = "";
  const repoRoot = process.cwd();

  beforeEach(() => {
    clearConceptPublicationCache();
    clearConceptCatalogCache();
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "origin-product-path-"));
    buildCatalogFixtureRepo(tmp);
    prevCwd = process.cwd();
    process.chdir(tmp);
  });

  afterEach(() => {
    process.chdir(prevCwd);
    clearConceptPublicationCache();
    clearConceptCatalogCache();
  });

  it("signed bundle → verify → import → validate → route metadata → sitemap", async () => {
    const bundlePath = path.join(fixtures, "publication-bundle-valid.json");
    const result = importPublicationBundle(bundlePath, tmp, membraneOpts);
    expect(result.ok).toBe(true);

    const validationHref = pathToFileURL(
      path.join(repoRoot, "tools/validate-concept-data.ts"),
    ).href;
    const { validateConceptData } = await import(validationHref);
    const validation = validateConceptData(tmp);
    expect(validation.ok).toBe(true);
    expect(validation.publishedCount).toBe(1);

    const loaded = loadVerifiedPublications(tmp, membraneOpts);
    expect(loaded.dossiers).toHaveLength(1);

    clearConceptPublicationCache();
    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: "synthetic-fixture-concept" }),
    });
    expect(metadata.title).toBe("Synthetic fixture concept");
    expect(metadata.robots).toEqual({ index: true, follow: true });

    clearConceptPublicationCache();
    const staticParams = generateStaticParams();
    expect(
      staticParams.some((p) => p.slug === "synthetic-fixture-concept"),
    ).toBe(true);

    const entries = sitemap();
    expect(
      entries.some((e) => e.url.includes("/concepts/synthetic-fixture-concept/")),
    ).toBe(true);
  });
});
