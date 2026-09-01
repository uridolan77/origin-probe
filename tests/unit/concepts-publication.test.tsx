import { describe, expect, it, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import {
  importPublicationBundle,
  loadVerifiedPublications,
  validatePublicationBundle,
  verifyPublicationBundle,
} from "@/lib/concepts/publication-membrane";
import { PublishedConceptGenealogySchema } from "@/lib/concepts/schema";
import { authorityFingerprintSha256 } from "@/lib/concepts/publication-authority";
import { ConceptPublishedView } from "@/components/ConceptDetail";
import { cleanup, render, screen } from "@testing-library/react";

afterEach(() => cleanup());

const fixtures = path.join(process.cwd(), "tests/fixtures/concepts");
const fixtureAuthority = JSON.parse(
  fs.readFileSync(
    path.join(fixtures, "keys/fixture-only.public.json"),
    "utf8",
  ),
);
const fixturePolicy = JSON.parse(
  fs.readFileSync(
    path.join(fixtures, "keys/fixture-pinned-policy.json"),
    "utf8",
  ),
);

const membraneOpts = {
  fixtureMode: true as const,
  authority: fixtureAuthority,
  pinnedPolicy: fixturePolicy,
  pinFingerprint: fixturePolicy.authorityFingerprintSha256,
  skipCatalogBinding: true,
  registriesRoot: path.join(fixtures, "registries"),
};

function load(name: string) {
  return JSON.parse(fs.readFileSync(path.join(fixtures, name), "utf8"));
}

function tmpRepo(): string {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "origin-pub-"));
  fs.mkdirSync(path.join(tmp, "data/concepts"), { recursive: true });
  fs.mkdirSync(path.join(tmp, "tools/pins"), { recursive: true });
  fs.copyFileSync(
    path.join(fixtures, "keys/fixture-only.public.json"),
    path.join(tmp, "data/concepts/publication-authority.public.json"),
  );
  fs.writeFileSync(
    path.join(tmp, "data/concepts/pinned-publication-policy.json"),
    `${JSON.stringify(fixturePolicy, null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(tmp, "tools/pins/publication-authority.sha256"),
    `${fixturePolicy.authorityFingerprintSha256}\n`,
  );
  fs.writeFileSync(
    path.join(tmp, "data/concepts/publication-root.public.json"),
    fs.readFileSync(
      path.join(process.cwd(), "data/concepts/publication-root.public.json"),
    ),
  );
  const registriesDir = path.join(tmp, "data/concepts/registries");
  fs.mkdirSync(registriesDir, { recursive: true });
  for (const file of fs.readdirSync(path.join(fixtures, "registries"))) {
    fs.copyFileSync(
      path.join(fixtures, "registries", file),
      path.join(registriesDir, file),
    );
  }
  return tmp;
}

describe("concept publication membrane", () => {
  it("accepts a valid signed publication envelope", () => {
    const bundle = load("publication-bundle-valid.json");
    expect(validatePublicationBundle(bundle, fixtureAuthority, membraneOpts).ok).toBe(
      true,
    );
  });

  it("positive path: signed bundle → importer → schema → loader → render", () => {
    const tmp = tmpRepo();
    const result = importPublicationBundle(
      path.join(fixtures, "publication-bundle-valid.json"),
      tmp,
      membraneOpts,
    );
    expect(result.ok).toBe(true);
    expect(result.written).toHaveLength(1);

    const dossierRaw = JSON.parse(fs.readFileSync(result.written[0]!, "utf8"));
    const dossier = PublishedConceptGenealogySchema.parse(dossierRaw);
    expect(dossier.conceptId).toBe("C042");

    const loaded = loadVerifiedPublications(tmp, membraneOpts);
    expect(loaded.dossiers).toHaveLength(1);
    expect(loaded.authorizedAssertionIds).toEqual(["C042-A01"]);

    render(<ConceptPublishedView dossier={loaded.dossiers[0]!} />);
    expect(screen.getAllByText(dossier.finding).length).toBeGreaterThan(0);
  });

  it("rejects unsigned / orphan dossier injection", () => {
    const tmp = tmpRepo();
    const pubDir = path.join(tmp, "data/concepts/publications");
    fs.mkdirSync(pubDir, { recursive: true });
    const dossier = load("publication-bundle-valid.json").dossiers[0];
    fs.writeFileSync(
      path.join(pubDir, "synthetic-fixture-concept.json"),
      `${JSON.stringify(dossier, null, 2)}\n`,
    );
    expect(() => loadVerifiedPublications(tmp, membraneOpts)).toThrow(
      /Standalone dossier injection|no governing signed bundle/i,
    );
  });

  it("rejects generated dossier byte drift", () => {
    const tmp = tmpRepo();
    importPublicationBundle(
      path.join(fixtures, "publication-bundle-valid.json"),
      tmp,
      membraneOpts,
    );
    const pubPath = path.join(
      tmp,
      "data/concepts/publications/synthetic-fixture-concept.json",
    );
    fs.writeFileSync(pubPath, `${JSON.stringify({ tampered: true }, null, 2)}\n`);
    expect(() => loadVerifiedPublications(tmp, membraneOpts)).toThrow(
      /byte drift/i,
    );
  });

  it("rejects authority key substitution without rotation envelope", () => {
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    const pub = publicKey.export({ type: "spki", format: "der" }) as Buffer;
    const priv = privateKey.export({ type: "pkcs8", format: "der" }) as Buffer;
    const tmp = tmpRepo();
    const newAuth = {
      keyId: "origin-site-concept-publication-authority-v1",
      algorithm: "Ed25519" as const,
      publicKeyBase64: pub.toString("base64"),
      purpose: "substituted",
      repository: "uridolan77/origin-probe" as const,
      canonicalHost: "origin.ontogony.net",
    };
    fs.writeFileSync(
      path.join(tmp, "data/concepts/publication-authority.public.json"),
      `${JSON.stringify(newAuth, null, 2)}\n`,
    );
    // Resign valid bundle with substituted key but keep old pin
    const bundle = load("publication-bundle-valid.json");
    bundle.signerKeyId = newAuth.keyId;
    expect(() =>
      verifyPublicationBundle(bundle, tmp, {
        authority: newAuth,
        pinnedPolicy: {
          ...fixturePolicy,
          authorityFingerprintSha256: authorityFingerprintSha256(
            fixtureAuthority.publicKeyBase64,
          ),
        },
        pinFingerprint: fixturePolicy.authorityFingerprintSha256,
        fixtureMode: false,
      }),
    ).toThrow(/Authority key substitution|fingerprint pin mismatch/i);
    void priv;
  });

  it("rejects production key id used as fixture authority", () => {
    expect(() =>
      validatePublicationBundle(load("publication-bundle-valid.json"), {
        ...fixtureAuthority,
        keyId: "origin-site-concept-publication-authority-v1",
      }, { ...membraneOpts, fixtureMode: true, authority: {
        ...fixtureAuthority,
        keyId: "origin-site-concept-publication-authority-v1",
      }}),
    ).toThrow(/fixture-only/i);
  });

  it("rejects earliest omission (1900/2000)", () => {
    expect(() =>
      validatePublicationBundle(
        load("publication-bundle-earliest-omission.json"),
        fixtureAuthority,
        membraneOpts,
      ),
    ).toThrow(/chronological minimum|Caller-selected later earliest/i);
  });

  it("accepts contested earliest tie", () => {
    expect(
      validatePublicationBundle(
        load("publication-bundle-earliest-tie-contested.json"),
        fixtureAuthority,
        membraneOpts,
      ).ok,
    ).toBe(true);
  });

  it("rejects tampered finding prose even when digests are resigned", () => {
    expect(() =>
      validatePublicationBundle(
        load("publication-bundle-finding-tamper.json"),
        fixtureAuthority,
        membraneOpts,
      ),
    ).toThrow(/deterministic projection|Projection text digest|Digest mismatch/i);
  });

  it("rejects tampered finding when dossier has no priority slot", () => {
    expect(() =>
      validatePublicationBundle(
        load("publication-bundle-finding-no-priority-tamper.json"),
        fixtureAuthority,
        membraneOpts,
      ),
    ).toThrow(/deterministic projection|Projection text digest|finding-authority/i);
  });

  it("rejects upstream derivedPlan decoy that differs from live projectionPlans", () => {
    expect(() =>
      validatePublicationBundle(
        load("publication-bundle-upstream-plan-decoy.json"),
        fixtureAuthority,
        membraneOpts,
      ),
    ).toThrow(/Upstream derived plan does not match/i);
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
      expect(() =>
        validatePublicationBundle(bundle, fixtureAuthority, membraneOpts),
      ).toThrow(new RegExp(needle, "i"));
    });
  }
});

describe("concept id grammar", () => {
  it("rejects C000 and out-of-range ids in schema", async () => {
    const { ConceptIdSchema } = await import("@/lib/concepts/schema");
    expect(ConceptIdSchema.safeParse("C000").success).toBe(false);
    expect(ConceptIdSchema.safeParse("C900").success).toBe(false);
    expect(ConceptIdSchema.safeParse("C042").success).toBe(true);
  });
});

describe("cleanroom host exception", () => {
  it("permits only the exact canonical host allow-list", async () => {
    const href = pathToFileURL(
      path.join(process.cwd(), "tools/lib/cleanroom-policy.mjs"),
    ).href;
    const mod = await import(href);
    const isApprovedHostAllowList = mod.isApprovedHostAllowList as (
      hosts: unknown,
    ) => boolean;
    const maskAllowedHosts = mod.maskAllowedHosts as (
      text: string,
      hosts?: readonly string[],
    ) => string;
    const isExactAllowedHost = mod.isExactAllowedHost as (
      hostname: string,
    ) => boolean;
    const CLEANROOM_ALLOWED_EXACT_HOSTS =
      mod.CLEANROOM_ALLOWED_EXACT_HOSTS as readonly string[];
    expect(isApprovedHostAllowList(CLEANROOM_ALLOWED_EXACT_HOSTS)).toBe(true);
    expect(isApprovedHostAllowList(["origin.ontogony.net", "evil.com"])).toBe(
      false,
    );
    const brand = Buffer.from("T250b2dvbnk=", "base64").toString("utf8");
    const masked = maskAllowedHosts(
      `host origin.ontogony.net and brand ${brand} elsewhere`,
    );
    expect(masked.includes("origin.ontogony.net")).toBe(false);
    expect(masked.toLowerCase().includes(brand.toLowerCase())).toBe(true);
    expect(isExactAllowedHost("origin.ontogony.net")).toBe(true);
    const evilPrefixHost = Buffer.from(
      "ZXZpbC1vcmlnaW4ub250b2dvbnkubmV0",
      "base64",
    ).toString("utf8");
    const evilSuffixHost = Buffer.from(
      "b3JpZ2luLm9udG9nb255Lm5ldC5ldmlsLmV4YW1wbGU=",
      "base64",
    ).toString("utf8");
    expect(isExactAllowedHost(evilPrefixHost)).toBe(false);
    expect(isExactAllowedHost(evilSuffixHost)).toBe(false);
    const embedded = maskAllowedHosts(`${evilPrefixHost} should stay visible`);
    expect(embedded).toContain(evilPrefixHost);
  });
});

describe("catalog zip custody", () => {
  async function loadCatalogTools() {
    const zipHref = pathToFileURL(
      path.join(process.cwd(), "tools/lib/zip-custody.mjs"),
    ).href;
    const coreHref = pathToFileURL(
      path.join(process.cwd(), "tools/lib/build-concept-catalog-core.mjs"),
    ).href;
    const zip = await import(zipHref);
    const core = await import(coreHref);
    return {
      writeStoredZip: zip.writeStoredZip,
      buildConceptCatalogFromZips: core.buildConceptCatalogFromZips,
    };
  }

  it("rejects authentic zip hash paired with tampered extraction inputs", async () => {
    const { writeStoredZip, buildConceptCatalogFromZips } =
      await loadCatalogTools();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "origin-cat-"));
    const records = Array.from({ length: 100 }, (_, i) => {
      const id = `C${String(i + 1).padStart(3, "0")}`;
      return {
        id,
        objectKind: "theory",
        label: `Concept ${id}`,
        aliases: [],
        domains: ["test"],
        sources: [],
        evidenceItems: [],
        curation: { maturityTags: [] },
      };
    });
    const candidate = {
      packageId: "ORIGIN-CONCEPT-GENEALOGIES-100-CANDIDATE-005",
      records,
    };
    const audit = { sourceLeadModeledRecordIds: [], acceptedAssertionCount: 0 };
    const tasks = { tasks: [] };
    const artifactZip = path.join(dir, "artifact.zip");
    writeStoredZip(artifactZip, {
      "CORPUS_AUDIT.json": JSON.stringify(audit),
      "MANIFEST.sha256": "fixture\n",
      "MIGRATION_REPORT.md": "# fixture\n",
      "RESEARCH_TASKS.csv": "taskId\n",
      "REVIEW_REGISTER.json": JSON.stringify({ events: [] }),
      "ROLE_AUDIT_QUEUE.csv": "assertionId\n",
      "TASK_GRAPH.json": JSON.stringify(tasks),
      "candidate-005.json": JSON.stringify(candidate),
      "research-index.md": "# fixture\n",
    });
    const c092Zip = path.join(dir, "c092.zip");
    writeStoredZip(c092Zip, {
      "C092-pilot-workspace.md": "# fixture\n",
      "C092-pilot-workspace.v005.json": JSON.stringify({ packageId: "fixture" }),
      "MANIFEST.sha256": "fixture\n",
      "PILOT_REPORT.json": JSON.stringify({
        recordId: "C092",
        gate: "PASS_PARTIALLY_VERIFIED",
        acceptedAssertionIds: [],
      }),
      "PILOT_REPORT.md": "# fixture\n",
    });

    const outRoot = path.join(dir, "repo");
    fs.mkdirSync(path.join(outRoot, "data/concepts"), { recursive: true });
    const ok = buildConceptCatalogFromZips({
      artifactZip,
      c092Zip,
      repoRoot: outRoot,
      enforcePinnedDigests: false,
    });
    expect(ok.ok).toBe(true);

    const r = spawnSync(
      process.execPath,
      [
        path.join(process.cwd(), "tools/build-concept-catalog.mjs"),
        "--artifact-zip",
        artifactZip,
        "--artifact-dir",
        dir,
        "--c092-zip",
        c092Zip,
      ],
      { encoding: "utf8" },
    );
    expect(r.status).not.toBe(0);
    expect(`${r.stderr}${r.stdout}`).toMatch(/Refusing trusted/i);
  });

  it("rejects C000 substituted for C001 in exact set", async () => {
    const { writeStoredZip, buildConceptCatalogFromZips } =
      await loadCatalogTools();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "origin-c000-"));
    const records = Array.from({ length: 100 }, (_, i) => {
      const id = i === 0 ? "C000" : `C${String(i).padStart(3, "0")}`;
      return {
        id,
        objectKind: "theory",
        label: `Concept ${id}`,
        aliases: [],
        domains: ["test"],
        sources: [],
        evidenceItems: [],
        curation: { maturityTags: [] },
      };
    });
    const artifactZip = path.join(dir, "artifact.zip");
    writeStoredZip(artifactZip, {
      "CORPUS_AUDIT.json": JSON.stringify({
        sourceLeadModeledRecordIds: [],
        acceptedAssertionCount: 0,
      }),
      "MANIFEST.sha256": "fixture\n",
      "MIGRATION_REPORT.md": "# fixture\n",
      "RESEARCH_TASKS.csv": "taskId\n",
      "REVIEW_REGISTER.json": JSON.stringify({ events: [] }),
      "ROLE_AUDIT_QUEUE.csv": "assertionId\n",
      "TASK_GRAPH.json": JSON.stringify({ tasks: [] }),
      "candidate-005.json": JSON.stringify({
        packageId: "ORIGIN-CONCEPT-GENEALOGIES-100-CANDIDATE-005",
        records,
      }),
      "research-index.md": "# fixture\n",
    });
    const c092Zip = path.join(dir, "c092.zip");
    writeStoredZip(c092Zip, {
      "C092-pilot-workspace.md": "# fixture\n",
      "C092-pilot-workspace.v005.json": JSON.stringify({ packageId: "fixture" }),
      "MANIFEST.sha256": "fixture\n",
      "PILOT_REPORT.json": JSON.stringify({
        recordId: "C092",
        gate: "PASS_PARTIALLY_VERIFIED",
        acceptedAssertionIds: [],
      }),
      "PILOT_REPORT.md": "# fixture\n",
    });
    const outRoot = path.join(dir, "repo");
    fs.mkdirSync(path.join(outRoot, "data/concepts"), { recursive: true });
    expect(() =>
      buildConceptCatalogFromZips({
        artifactZip,
        c092Zip,
        repoRoot: outRoot,
        enforcePinnedDigests: false,
      }),
    ).toThrow(/Invalid conceptId|exactly C001/i);
  });
});
