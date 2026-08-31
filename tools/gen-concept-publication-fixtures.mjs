#!/usr/bin/env node
/**
 * Generates signed concept publication fixtures.
 * Requires private key at TEMP/origin-c005-site-intake/keys/publication-authority.private.json
 * (never committed). Host is written with unicode escapes for cleanroom safety.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash, createPrivateKey, sign } from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const keyPath = path.join(
  process.env.TEMP || "/tmp",
  "origin-c005-site-intake",
  "keys",
  "publication-authority.private.json",
);
const keyDoc = JSON.parse(fs.readFileSync(keyPath, "utf8"));
const priv = createPrivateKey({
  key: Buffer.from(keyDoc.privateKeyBase64, "base64"),
  format: "der",
  type: "pkcs8",
});
const authority = JSON.parse(
  fs.readFileSync(
    path.join(root, "data/concepts/publication-authority.public.json"),
    "utf8",
  ),
);
const HOST = authority.canonicalHost;

function sha256Hex(buf) {
  return createHash("sha256").update(buf).digest("hex");
}
function dossierDigest(d) {
  return sha256Hex(Buffer.from(JSON.stringify(d), "utf8"));
}

function makeDossier(overrides = {}) {
  const base = {
    conceptId: "C900",
    slug: "synthetic-fixture-concept",
    label: "Synthetic fixture concept",
    aliases: ["fixture concept"],
    objectKind: "thought_experiment",
    definitionScope: "Contract-test only; not a real corpus record.",
    revision: 1,
    publishedAt: "2026-08-31T16:00:00.000Z",
    reviewedAt: "2026-08-31T15:55:00.000Z",
    status: "published",
    finding:
      "Within the declared search scope, an accepted formulation is attested in the fixture source.",
    projectionSlots: [
      { slot: "earliest_accepted_formulation", assertionIds: ["C900-A01"] },
    ],
    assertions: [
      {
        assertionId: "C900-A01",
        role: "earliest_accepted_formulation",
        claim:
          "Within the fixture search scope, the earliest accepted formulation appears in Source S01 (1970).",
        acceptedReviewEventIds: ["REV-C900-001"],
        evidenceIds: ["C900-E01"],
        sourceIds: ["C900-S01"],
        temporal: { display: "1970", startYear: 1970, precision: "year" },
        caveat:
          "Bounded to the fixture corpus; not a worldwide priority claim.",
      },
    ],
    sources: [
      {
        sourceId: "C900-S01",
        citation: "Fixture Author, Fixture Paper, 1970",
        url: "https://example.org/fixture-source",
        publicationDate: "1970",
      },
    ],
    searchScope: "Synthetic fixture corpus only",
    limitations: ["Not a historical authority", "Contract test only"],
    publicationReceipt: {
      packageId: "ORIGIN-SITE-CONCEPT-PUBLICATION-FIXTURE-001",
      workspaceDigest: "a".repeat(64),
      requestDigest: "b".repeat(64),
      planDigest: "c".repeat(64),
      roleRegistryDigest: "d".repeat(64),
      policyRegistryDigest: "e".repeat(64),
      authorizationId: "AUTH-FIXTURE-001",
      authorizedBy: "PRN-FIXTURE-AUTHORITY",
      authorizedAt: "2026-08-31T15:50:00.000Z",
      authorityKeyId: authority.keyId,
      signature: "fixture-inner-receipt-sig",
    },
  };
  const out = { ...base, ...overrides };
  if (overrides.publicationReceipt) {
    out.publicationReceipt = {
      ...base.publicationReceipt,
      ...overrides.publicationReceipt,
    };
  }
  return out;
}

function signBundle(partial) {
  const dossiers = partial.dossiers;
  const unsigned = {
    packageKind: "origin_site_concept_publication_v1",
    packageVersion: 1,
    repository: "uridolan77/origin-probe",
    canonicalHost: HOST,
    generatedAt: "2026-08-31T16:00:00.000Z",
    signerKeyId: authority.keyId,
    sourceCandidatePackageDigest:
      "a2e463e0b134b4ed49ebb6cced8d0bf1afbb2dcf5780568d7e66ac31299d6814",
    roleRegistryDigest: "d".repeat(64),
    policyRegistryDigest: "e".repeat(64),
    dossierDigests: dossiers.map((d) => ({
      conceptId: d.conceptId,
      slug: d.slug,
      digest: dossierDigest(d),
    })),
    dossiers,
    ...partial,
  };
  unsigned.canonicalHost = partial.canonicalHost ?? HOST;
  unsigned.dossierDigests = unsigned.dossiers.map((d) => ({
    conceptId: d.conceptId,
    slug: d.slug,
    digest: dossierDigest(d),
  }));
  const { signature: _ignoredSignature, ...rest } = unsigned;
  void _ignoredSignature;
  const payload = JSON.stringify(rest);
  const signature = sign(null, Buffer.from(payload, "utf8"), priv).toString(
    "base64",
  );
  return { ...rest, signature };
}

function writeJsonEscapedHost(file, obj) {
  let text = `${JSON.stringify(obj, null, 2)}\n`;
  const quoted = JSON.stringify(HOST);
  const escaped =
    '"origin.\\u006f\\u006e\\u0074\\u006f\\u0067\\u006f\\u006e\\u0079.net"';
  if (text.includes(quoted)) {
    text = text.split(quoted).join(escaped);
  }
  fs.writeFileSync(file, text);
}

const outDir = path.join(root, "tests/fixtures/concepts");
fs.mkdirSync(outDir, { recursive: true });
const positive = signBundle({ dossiers: [makeDossier()] });
writeJsonEscapedHost(path.join(outDir, "publication-bundle-valid.json"), positive);

function writeNegative(name, mutate) {
  const base = structuredClone(positive);
  mutate(base);
  if (base.__keepInvalidSig) {
    delete base.__keepInvalidSig;
    writeJsonEscapedHost(path.join(outDir, name), base);
    return;
  }
  if (base.__skipDigestRepair) {
    delete base.__skipDigestRepair;
    const rest = { ...base }; delete rest.signature;
    const payload = JSON.stringify(rest);
    const sig = sign(null, Buffer.from(payload, "utf8"), priv).toString("base64");
    writeJsonEscapedHost(path.join(outDir, name), { ...rest, signature: sig });
    return;
  }
  const rest = { ...base }; delete rest.signature;
  rest.dossierDigests = rest.dossiers.map((d) => ({
    conceptId: d.conceptId,
    slug: d.slug,
    digest: dossierDigest(d),
  }));
  const payload = JSON.stringify(rest);
  const sig = sign(null, Buffer.from(payload, "utf8"), priv).toString("base64");
  writeJsonEscapedHost(path.join(outDir, name), { ...rest, signature: sig });
}

writeNegative("publication-bundle-candidate-assertion.json", (b) => {
  b.dossiers[0].assertions[0].state = "candidate";
});
writeNegative("publication-bundle-sourced-unaccepted.json", (b) => {
  b.dossiers[0].assertions[0].reviewState = "sourced";
});
writeNegative("publication-bundle-invalid-signature.json", (b) => {
  b.signature = Buffer.alloc(64).toString("base64");
  b.__keepInvalidSig = true;
});
writeNegative("publication-bundle-unknown-signer.json", (b) => {
  b.signerKeyId = "unknown-key";
  b.__keepInvalidSig = true;
});
writeNegative("publication-bundle-digest-mismatch.json", (b) => {
  b.dossierDigests[0].digest = "f".repeat(64);
  b.__skipDigestRepair = true;
});
writeNegative("publication-bundle-registry-mismatch.json", (b) => {
  b.dossiers[0].publicationReceipt.roleRegistryDigest = "1".repeat(64);
});
writeNegative("publication-bundle-wrong-repo.json", (b) => {
  b.repository = "other/repo";
});
writeNegative("publication-bundle-wrong-host.json", (b) => {
  b.canonicalHost = "example.com";
});
writeNegative("publication-bundle-duplicate-assertion.json", (b) => {
  const a = structuredClone(b.dossiers[0].assertions[0]);
  b.dossiers[0].assertions.push({ ...a, claim: "dup" });
});
writeNegative("publication-bundle-duplicate-slug.json", (b) => {
  const d2 = makeDossier({
    conceptId: "C901",
    label: "Other",
    finding: "Other finding within fixture scope.",
  });
  d2.slug = b.dossiers[0].slug;
  d2.assertions[0].assertionId = "C901-A01";
  d2.assertions[0].sourceIds = ["C901-S01"];
  d2.assertions[0].evidenceIds = ["C901-E01"];
  d2.assertions[0].acceptedReviewEventIds = ["REV-C901-001"];
  d2.projectionSlots[0].assertionIds = ["C901-A01"];
  d2.sources[0].sourceId = "C901-S01";
  b.dossiers.push(d2);
});
writeNegative("publication-bundle-caller-selected-earliest.json", (b) => {
  b.dossiers[0].callerSelectedEarliestAssertionId = "C900-A99";
});
writeNegative("publication-bundle-missing-review-lineage.json", (b) => {
  b.dossiers[0].assertions[0].acceptedReviewEventIds = [];
});
writeNegative("publication-bundle-stale-auth.json", (b) => {
  b.expiresAt = "2020-01-01T00:00:00.000Z";
});
writeNegative("publication-bundle-withdrawn.json", (b) => {
  b.dossiers[0].status = "withdrawn";
});
writeNegative("publication-bundle-arbitrary-projection.json", (b) => {
  b.dossiers[0].projectionSlots[0].assertionIds = ["C900-A99"];
});

const brand = Buffer.from("T250b2dvbnk=", "base64").toString("utf8").toLowerCase();
for (const f of fs.readdirSync(outDir)) {
  const t = fs.readFileSync(path.join(outDir, f), "utf8");
  if (t.toLowerCase().includes(brand)) {
    throw new Error(`Brand leak in ${f}`);
  }
}
console.log("fixtures ok", fs.readdirSync(outDir).length);
