#!/usr/bin/env node
/**
 * Generates signed concept publication fixtures with the fixture-only Ed25519 key.
 * Never uses the production publication-authority private key.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash, createPrivateKey, sign } from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const keysDir = path.join(root, "tests/fixtures/concepts/keys");
const keyDoc = JSON.parse(
  fs.readFileSync(path.join(keysDir, "fixture-only.private.json"), "utf8"),
);
const authority = JSON.parse(
  fs.readFileSync(path.join(keysDir, "fixture-only.public.json"), "utf8"),
);

if (!authority.keyId.includes("fixture-only")) {
  throw new Error("Fixture generator must use a fixture-only keyId");
}
if (authority.keyId === "origin-site-concept-publication-authority-v1") {
  throw new Error("Production key used by fixture generator");
}

const priv = createPrivateKey({
  key: Buffer.from(keyDoc.privateKeyBase64, "base64"),
  format: "der",
  type: "pkcs8",
});

const HOST = "origin.ontogony.net";
const SOURCE_DIGEST =
  "a2e463e0b134b4ed49ebb6cced8d0bf1afbb2dcf5780568d7e66ac31299d6814";

function sha256Hex(buf) {
  return createHash("sha256").update(buf).digest("hex");
}
function dossierDigest(d) {
  return sha256Hex(Buffer.from(JSON.stringify(d), "utf8"));
}
function signPayload(obj) {
  const { signature: _s, ...rest } = obj;
  void _s;
  const payload = JSON.stringify(rest);
  return sign(null, Buffer.from(payload, "utf8"), priv).toString("base64");
}

function makeAuthEnvelope(overrides = {}) {
  const base = {
    authorizationId: "AUTH-FIXTURE-001",
    authorizedBy: "PRN-FIXTURE-AUTHORITY",
    authorizedAt: "2026-08-31T15:50:00.000Z",
    workspaceDigest: "a".repeat(64),
    requestDigest: "b".repeat(64),
    planDigest: "c".repeat(64),
    authorityKeyId: authority.keyId,
    ...overrides,
  };
  return { ...base, signature: signPayload(base) };
}

function makeReceipt(envelope, overrides = {}) {
  const base = {
    packageId: "ORIGIN-SITE-CONCEPT-PUBLICATION-FIXTURE-001",
    workspaceDigest: envelope.workspaceDigest,
    requestDigest: envelope.requestDigest,
    planDigest: envelope.planDigest,
    roleRegistryDigest: "d".repeat(64),
    policyRegistryDigest: "e".repeat(64),
    authorizationId: envelope.authorizationId,
    authorizedBy: envelope.authorizedBy,
    authorizedAt: envelope.authorizedAt,
    authorityKeyId: authority.keyId,
    ...overrides,
  };
  return { ...base, signature: signPayload(base) };
}

function makePlan(dossier, overrides = {}) {
  const finding = dossier.finding;
  return {
    conceptId: dossier.conceptId,
    slug: dossier.slug,
    slot: "earliest_accepted_formulation",
    eligibleAssertionIds: dossier.assertions
      .filter((a) => a.role === "earliest_accepted_formulation")
      .map((a) => a.assertionId),
    normalizedIntervals: dossier.assertions
      .filter((a) => a.role === "earliest_accepted_formulation")
      .map((a) => ({
        assertionId: a.assertionId,
        startYear: a.temporal?.startYear ?? 1970,
        endYear: a.temporal?.endYear,
        precision: a.temporal?.precision ?? "year",
      })),
    searchScopeId: "fixture-scope-1",
    searchScopeDigest: sha256Hex(dossier.searchScope),
    selectedAssertionIds: dossier.projectionSlots.find(
      (s) => s.slot === "earliest_accepted_formulation",
    ).assertionIds,
    disposition: "unique",
    projectionTextDigest: sha256Hex(finding),
    ...overrides,
  };
}

function makeDossier(overrides = {}, envelope) {
  const env = envelope ?? makeAuthEnvelope();
  const base = {
    conceptId: "C042",
    slug: "synthetic-fixture-concept",
    label: "Synthetic fixture concept",
    aliases: ["fixture concept"],
    objectKind: "thought_experiment",
    definitionScope: "Contract-test only; not a real corpus record.",
    revision: 1,
    publishedAt: "2026-08-31T16:00:00.000Z",
    reviewedAt: "2026-08-31T15:40:00.000Z",
    status: "published",
    finding:
      "Within the declared search scope, an accepted formulation is attested in the fixture source.",
    projectionSlots: [
      { slot: "earliest_accepted_formulation", assertionIds: ["C042-A01"] },
    ],
    assertions: [
      {
        assertionId: "C042-A01",
        role: "earliest_accepted_formulation",
        claim:
          "Within the fixture search scope, the earliest accepted formulation appears in Source S01 (1970).",
        acceptedReviewEventIds: ["REV-C042-001"],
        evidenceIds: ["C042-E01"],
        sourceIds: ["C042-S01"],
        temporal: { display: "1970", startYear: 1970, precision: "year" },
        caveat:
          "Bounded to the fixture corpus; not a worldwide priority claim.",
      },
    ],
    sources: [
      {
        sourceId: "C042-S01",
        citation: "Fixture Author, Fixture Paper, 1970",
        url: "https://example.org/fixture-source",
        publicationDate: "1970",
      },
    ],
    searchScope: "Synthetic fixture corpus only",
    limitations: ["Not a historical authority", "Contract test only"],
    publicationReceipt: makeReceipt(env),
  };
  const out = { ...base, ...overrides };
  if (overrides.assertions) out.assertions = overrides.assertions;
  if (overrides.projectionSlots) out.projectionSlots = overrides.projectionSlots;
  if (overrides.sources) out.sources = overrides.sources;
  if (overrides.publicationReceipt) {
    out.publicationReceipt = makeReceipt(env, overrides.publicationReceipt);
  } else if (!overrides.reviewedAt) {
    out.publicationReceipt = makeReceipt(env);
  } else {
    out.publicationReceipt = makeReceipt(env);
  }
  // Ensure review ≤ authorization ≤ publication
  if (!overrides.reviewedAt) out.reviewedAt = "2026-08-31T15:40:00.000Z";
  if (!overrides.publishedAt) out.publishedAt = "2026-08-31T16:00:00.000Z";
  return out;
}

function signBundle(partial) {
  const envelope = partial.authorizationEnvelope ?? makeAuthEnvelope();
  const dossiers = partial.dossiers;
  const plans =
    partial.projectionPlans ??
    dossiers.map((d) => makePlan(d));
  const unsigned = {
    packageKind: "origin_site_concept_publication_v1",
    packageVersion: 1,
    repository: "uridolan77/origin-probe",
    canonicalHost: HOST,
    generatedAt: "2026-08-31T16:00:00.000Z",
    signerKeyId: authority.keyId,
    sourceCandidatePackageDigest: SOURCE_DIGEST,
    roleRegistryDigest: "d".repeat(64),
    policyRegistryDigest: "e".repeat(64),
    authorizationEnvelope: envelope,
    projectionPlans: plans,
    dossierDigests: dossiers.map((d) => ({
      conceptId: d.conceptId,
      slug: d.slug,
      digest: dossierDigest(d),
    })),
    dossiers,
    ...partial,
  };
  unsigned.canonicalHost = partial.canonicalHost ?? HOST;
  unsigned.authorizationEnvelope = envelope;
  unsigned.projectionPlans = plans;
  unsigned.dossierDigests = unsigned.dossiers.map((d) => ({
    conceptId: d.conceptId,
    slug: d.slug,
    digest: dossierDigest(d),
  }));
  const { signature: _ignored, ...rest } = unsigned;
  void _ignored;
  return { ...rest, signature: signPayload(rest) };
}

const outDir = path.join(root, "tests/fixtures/concepts");
fs.mkdirSync(outDir, { recursive: true });

const authEnv = makeAuthEnvelope();
const positive = signBundle({
  authorizationEnvelope: authEnv,
  dossiers: [makeDossier({}, authEnv)],
});
fs.writeFileSync(
  path.join(outDir, "publication-bundle-valid.json"),
  `${JSON.stringify(positive, null, 2)}\n`,
);

function writeNegative(name, mutate) {
  const base = structuredClone(positive);
  const flags = { rebuildPlans: false, keepInvalidSig: false, skipDigestRepair: false };
  mutate(base, flags);
  if (flags.keepInvalidSig || base.__keepInvalidSig) {
    delete base.__keepInvalidSig;
    fs.writeFileSync(path.join(outDir, name), `${JSON.stringify(base, null, 2)}\n`);
    return;
  }
  if (flags.skipDigestRepair || base.__skipDigestRepair) {
    delete base.__skipDigestRepair;
    const rest = { ...base };
    delete rest.signature;
    delete rest.__rebuildPlans;
    fs.writeFileSync(
      path.join(outDir, name),
      `${JSON.stringify({ ...rest, signature: signPayload(rest) }, null, 2)}\n`,
    );
    return;
  }
  const rest = { ...base };
  delete rest.signature;
  delete rest.__rebuildPlans;
  rest.dossierDigests = rest.dossiers.map((d) => ({
    conceptId: d.conceptId,
    slug: d.slug,
    digest: dossierDigest(d),
  }));
  if (flags.rebuildPlans || base.__rebuildPlans) {
    rest.projectionPlans = rest.dossiers.map((d) => makePlan(d));
  }
  fs.writeFileSync(
    path.join(outDir, name),
    `${JSON.stringify({ ...rest, signature: signPayload(rest) }, null, 2)}\n`,
  );
}

writeNegative("publication-bundle-candidate-assertion.json", (b) => {
  b.dossiers[0].assertions[0].state = "candidate";
});
writeNegative("publication-bundle-sourced-unaccepted.json", (b) => {
  b.dossiers[0].assertions[0].reviewState = "sourced";
});
writeNegative("publication-bundle-invalid-signature.json", (b, f) => {
  b.signature = Buffer.alloc(64).toString("base64");
  f.keepInvalidSig = true;
});
writeNegative("publication-bundle-unknown-signer.json", (b, f) => {
  b.signerKeyId = "unknown-key";
  f.keepInvalidSig = true;
});
writeNegative("publication-bundle-digest-mismatch.json", (b, f) => {
  b.dossierDigests[0].digest = "f".repeat(64);
  f.skipDigestRepair = true;
});
writeNegative("publication-bundle-registry-mismatch.json", (b) => {
  const receipt = { ...b.dossiers[0].publicationReceipt };
  delete receipt.signature;
  receipt.roleRegistryDigest = "1".repeat(64);
  receipt.signature = signPayload(receipt);
  b.dossiers[0].publicationReceipt = receipt;
});
writeNegative("publication-bundle-wrong-repo.json", (b) => {
  b.repository = "other/repo";
});
writeNegative("publication-bundle-wrong-host.json", (b) => {
  b.canonicalHost = "example.com";
});
writeNegative("publication-bundle-duplicate-assertion.json", (b, f) => {
  const a = structuredClone(b.dossiers[0].assertions[0]);
  b.dossiers[0].assertions.push({ ...a, claim: "dup" });
  f.rebuildPlans = true;
});
writeNegative("publication-bundle-duplicate-slug.json", (b, f) => {
  const env = b.authorizationEnvelope;
  const d2 = makeDossier(
    {
      conceptId: "C043",
      label: "Other",
      finding: "Other finding within fixture scope.",
    },
    env,
  );
  d2.slug = b.dossiers[0].slug;
  d2.assertions[0].assertionId = "C043-A01";
  d2.assertions[0].sourceIds = ["C043-S01"];
  d2.assertions[0].evidenceIds = ["C043-E01"];
  d2.assertions[0].acceptedReviewEventIds = ["REV-C043-001"];
  d2.projectionSlots[0].assertionIds = ["C043-A01"];
  d2.sources[0].sourceId = "C043-S01";
  d2.publicationReceipt = makeReceipt(env, {
    packageId: "ORIGIN-SITE-CONCEPT-PUBLICATION-FIXTURE-002",
  });
  b.dossiers.push(d2);
  f.rebuildPlans = true;
});
writeNegative("publication-bundle-caller-selected-earliest.json", (b) => {
  b.dossiers[0].callerSelectedEarliestAssertionId = "C042-A99";
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
  b.dossiers[0].projectionSlots[0].assertionIds = ["C042-A99"];
});

// Priority: caller selects 2000 over 1900
{
  const env = makeAuthEnvelope();
  const d = makeDossier({}, env);
  d.assertions = [
    {
      assertionId: "C042-A1900",
      role: "earliest_accepted_formulation",
      claim: "1900 formulation",
      acceptedReviewEventIds: ["REV-C042-1900"],
      evidenceIds: ["C042-E1900"],
      sourceIds: ["C042-S01"],
      temporal: { display: "1900", startYear: 1900, precision: "year" },
      caveat: "Bounded fixture",
    },
    {
      assertionId: "C042-A2000",
      role: "earliest_accepted_formulation",
      claim: "2000 formulation",
      acceptedReviewEventIds: ["REV-C042-2000"],
      evidenceIds: ["C042-E2000"],
      sourceIds: ["C042-S01"],
      temporal: { display: "2000", startYear: 2000, precision: "year" },
      caveat: "Bounded fixture",
    },
  ];
  d.projectionSlots = [
    { slot: "earliest_accepted_formulation", assertionIds: ["C042-A2000"] },
  ];
  d.publicationReceipt = makeReceipt(env);
  const plan = makePlan(d);
  plan.eligibleAssertionIds = ["C042-A1900", "C042-A2000"];
  plan.normalizedIntervals = [
    { assertionId: "C042-A1900", startYear: 1900, precision: "year" },
    { assertionId: "C042-A2000", startYear: 2000, precision: "year" },
  ];
  plan.selectedAssertionIds = ["C042-A2000"];
  plan.disposition = "unique";
  plan.projectionTextDigest = sha256Hex(d.finding);
  const bundle = signBundle({
    authorizationEnvelope: env,
    dossiers: [d],
    projectionPlans: [plan],
  });
  fs.writeFileSync(
    path.join(outDir, "publication-bundle-earliest-omission.json"),
    `${JSON.stringify(bundle, null, 2)}\n`,
  );
}

// Priority: exact tie → contested (valid)
{
  const env = makeAuthEnvelope();
  const d = makeDossier({}, env);
  d.assertions = [
    {
      assertionId: "C042-A1",
      role: "earliest_accepted_formulation",
      claim: "tie A",
      acceptedReviewEventIds: ["REV-C042-T1"],
      evidenceIds: ["C042-ET1"],
      sourceIds: ["C042-S01"],
      temporal: { display: "1950", startYear: 1950, precision: "year" },
      caveat: "Bounded fixture",
    },
    {
      assertionId: "C042-A2",
      role: "earliest_accepted_formulation",
      claim: "tie B",
      acceptedReviewEventIds: ["REV-C042-T2"],
      evidenceIds: ["C042-ET2"],
      sourceIds: ["C042-S01"],
      temporal: { display: "1950", startYear: 1950, precision: "year" },
      caveat: "Bounded fixture",
    },
  ];
  d.projectionSlots = [
    {
      slot: "earliest_accepted_formulation",
      assertionIds: ["C042-A1", "C042-A2"],
    },
  ];
  d.finding =
    "Within the fixture scope, two accepted formulations share the earliest year and remain contested.";
  d.publicationReceipt = makeReceipt(env);
  const plan = makePlan(d);
  plan.eligibleAssertionIds = ["C042-A1", "C042-A2"];
  plan.normalizedIntervals = [
    { assertionId: "C042-A1", startYear: 1950, precision: "year" },
    { assertionId: "C042-A2", startYear: 1950, precision: "year" },
  ];
  plan.selectedAssertionIds = ["C042-A1", "C042-A2"];
  plan.disposition = "contested";
  plan.projectionTextDigest = sha256Hex(d.finding);
  const bundle = signBundle({
    authorizationEnvelope: env,
    dossiers: [d],
    projectionPlans: [plan],
  });
  fs.writeFileSync(
    path.join(outDir, "publication-bundle-earliest-tie-contested.json"),
    `${JSON.stringify(bundle, null, 2)}\n`,
  );
}

console.log("fixtures ok", fs.readdirSync(outDir).filter((f) => f.endsWith(".json")).length);
