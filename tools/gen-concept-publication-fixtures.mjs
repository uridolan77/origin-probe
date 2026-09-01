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
const registriesDir = path.join(root, "tests/fixtures/concepts/registries");
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
const FINDING_TEMPLATE_VERSION = 1;

function sha256Hex(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

const ROLE_REGISTRY_DIGEST = sha256Hex(
  fs.readFileSync(path.join(registriesDir, "role-registry.json"), "utf8").replace(/\r\n/g, "\n"),
);
const POLICY_REGISTRY_DIGEST = sha256Hex(
  fs.readFileSync(path.join(registriesDir, "policy-registry.json"), "utf8").replace(/\r\n/g, "\n"),
);

function dossierDigest(d) {
  return sha256Hex(Buffer.from(JSON.stringify(d), "utf8"));
}
function signPayload(obj) {
  const { signature: _s, ...rest } = obj;
  void _s;
  const payload = JSON.stringify(rest);
  return sign(null, Buffer.from(payload, "utf8"), priv).toString("base64");
}

function sourceCitations(assertion, sources) {
  const byId = new Map(sources.map((s) => [s.sourceId, s]));
  return assertion.sourceIds
    .map((id) => byId.get(id)?.citation)
    .filter(Boolean)
    .join("; ");
}

function regeneratePublicFinding({
  searchScope,
  slot,
  disposition,
  selectedAssertionIds,
  assertions,
  sources,
}) {
  const byId = new Map(assertions.map((a) => [a.assertionId, a]));
  const selected = selectedAssertionIds.map((id) => {
    const a = byId.get(id);
    if (!a) throw new Error(`Missing assertion ${id}`);
    return a;
  });
  const scopePrefix = `Within ${searchScope}, `;
  if (disposition === "contested") {
    const lines = selected.map((a) => {
      const temporal = a.temporal?.display ?? "undated";
      const cites = sourceCitations(a, sources);
      return `- ${a.claim} (${temporal}; ${cites})`;
    });
    return `${scopePrefix}the earliest accepted formulation for ${slot} is contested among:\n${lines.join("\n")}`;
  }
  const winner = selected[0];
  const temporal = winner.temporal?.display ?? "undated";
  const cites = sourceCitations(winner, sources);
  return `${scopePrefix}the earliest accepted formulation for ${slot} is attested as follows: ${winner.claim} (${temporal}; ${cites}).`;
}

function makePlan(dossier, overrides = {}) {
  const slot = "earliest_accepted_formulation";
  const eligibleAssertionIds = dossier.assertions
    .filter((a) => a.role === slot)
    .map((a) => a.assertionId);
  const normalizedIntervals = dossier.assertions
    .filter((a) => a.role === slot)
    .map((a) => ({
      assertionId: a.assertionId,
      startYear: a.temporal?.startYear ?? 1970,
      endYear: a.temporal?.endYear,
      precision: a.temporal?.precision ?? "year",
    }));
  const selectedAssertionIds = dossier.projectionSlots.find((s) => s.slot === slot)
    .assertionIds;
  const disposition =
    overrides.disposition ??
    (selectedAssertionIds.length > 1 ? "contested" : "unique");

  const basePlan = {
    conceptId: dossier.conceptId,
    slug: dossier.slug,
    slot,
    templateVersion: FINDING_TEMPLATE_VERSION,
    eligibleAssertionIds,
    normalizedIntervals,
    searchScopeId: "fixture-scope-1",
    searchScopeDigest: sha256Hex(dossier.searchScope),
    selectedAssertionIds,
    disposition,
    projectionTextDigest: "0".repeat(64),
    ...overrides,
  };

  const finding = regeneratePublicFinding({
    searchScope: dossier.searchScope,
    slot,
    disposition: basePlan.disposition,
    selectedAssertionIds: basePlan.selectedAssertionIds,
    assertions: dossier.assertions,
    sources: dossier.sources,
  });
  dossier.finding = finding;
  basePlan.projectionTextDigest = sha256Hex(finding);
  return basePlan;
}

function makeUpstreamArtifacts(dossier, plan) {
  const reviewedWorkspace = {
    workspaceKind: "origin_reviewed_workspace_v1",
    conceptId: dossier.conceptId,
    slug: dossier.slug,
    acceptedAssertionIds: dossier.assertions.map((a) => a.assertionId),
    reviewEventIds: [
      ...new Set(
        dossier.assertions.flatMap((a) => a.acceptedReviewEventIds),
      ),
    ],
    reviewedAt: dossier.reviewedAt,
  };
  const publicationRequest = {
    requestKind: "origin_publication_request_v1",
    requestId: "REQ-FIXTURE-001",
    conceptId: dossier.conceptId,
    slug: dossier.slug,
    revision: dossier.revision,
    requestedSlots: ["earliest_accepted_formulation"],
    requestedAt: "2026-08-31T15:45:00.000Z",
  };
  return {
    conceptId: dossier.conceptId,
    slug: dossier.slug,
    reviewedWorkspace,
    publicationRequest,
    derivedPlan: plan,
  };
}

function makeAuthEnvelope(upstream) {
  const base = {
    authorizationId: "AUTH-FIXTURE-001",
    authorizedBy: "PRN-FIXTURE-AUTHORITY",
    authorizedAt: "2026-08-31T15:50:00.000Z",
    workspaceDigest: sha256Hex(
      Buffer.from(JSON.stringify(upstream.reviewedWorkspace), "utf8"),
    ),
    requestDigest: sha256Hex(
      Buffer.from(JSON.stringify(upstream.publicationRequest), "utf8"),
    ),
    planDigest: sha256Hex(
      Buffer.from(JSON.stringify(upstream.derivedPlan), "utf8"),
    ),
    authorityKeyId: authority.keyId,
  };
  return { ...base, signature: signPayload(base) };
}

function makeReceipt(envelope, overrides = {}) {
  const base = {
    packageId: "ORIGIN-SITE-CONCEPT-PUBLICATION-FIXTURE-001",
    workspaceDigest: envelope.workspaceDigest,
    requestDigest: envelope.requestDigest,
    planDigest: envelope.planDigest,
    roleRegistryDigest: ROLE_REGISTRY_DIGEST,
    policyRegistryDigest: POLICY_REGISTRY_DIGEST,
    authorizationId: envelope.authorizationId,
    authorizedBy: envelope.authorizedBy,
    authorizedAt: envelope.authorizedAt,
    authorityKeyId: authority.keyId,
    ...overrides,
  };
  return { ...base, signature: signPayload(base) };
}

function makeDossier(overrides = {}) {
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
    finding: "",
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
    publicationReceipt: null,
  };
  const out = { ...base, ...overrides };
  if (overrides.assertions) out.assertions = overrides.assertions;
  if (overrides.projectionSlots) out.projectionSlots = overrides.projectionSlots;
  if (overrides.sources) out.sources = overrides.sources;
  if (!overrides.reviewedAt) out.reviewedAt = "2026-08-31T15:40:00.000Z";
  if (!overrides.publishedAt) out.publishedAt = "2026-08-31T16:00:00.000Z";
  return out;
}

function signBundle(partial) {
  const dossiers = partial.dossiers;
  const plans = partial.projectionPlans ?? dossiers.map((d) => makePlan(d));
  const upstreamArtifacts =
    partial.upstreamArtifacts ??
    dossiers.map((d, i) => makeUpstreamArtifacts(d, plans[i]));
  const envelope =
    partial.authorizationEnvelope ?? makeAuthEnvelope(upstreamArtifacts[0]);

  for (const d of dossiers) {
    if (!d.publicationReceipt) {
      d.publicationReceipt = makeReceipt(envelope, partial.receiptOverrides);
    }
  }

  const unsigned = {
    packageKind: "origin_site_concept_publication_v1",
    packageVersion: 1,
    repository: "uridolan77/origin-probe",
    canonicalHost: HOST,
    generatedAt: "2026-08-31T16:00:00.000Z",
    signerKeyId: authority.keyId,
    sourceCandidatePackageDigest: SOURCE_DIGEST,
    roleRegistryDigest: ROLE_REGISTRY_DIGEST,
    policyRegistryDigest: POLICY_REGISTRY_DIGEST,
    authorizationEnvelope: envelope,
    upstreamArtifacts,
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
  unsigned.upstreamArtifacts = upstreamArtifacts;
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

const positiveDossier = makeDossier();
const positivePlan = makePlan(positiveDossier);
const positiveUpstream = makeUpstreamArtifacts(positiveDossier, positivePlan);
const positiveEnv = makeAuthEnvelope(positiveUpstream);
positiveDossier.publicationReceipt = makeReceipt(positiveEnv);
const positive = signBundle({
  authorizationEnvelope: positiveEnv,
  upstreamArtifacts: [positiveUpstream],
  projectionPlans: [positivePlan],
  dossiers: [positiveDossier],
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
  if (flags.rebuildPlans || base.__rebuildPlans) {
    rest.projectionPlans = rest.dossiers.map((d) => makePlan(d));
    rest.upstreamArtifacts = rest.dossiers.map((d, i) =>
      makeUpstreamArtifacts(d, rest.projectionPlans[i]),
    );
    rest.authorizationEnvelope = makeAuthEnvelope(rest.upstreamArtifacts[0]);
    for (const d of rest.dossiers) {
      d.publicationReceipt = makeReceipt(rest.authorizationEnvelope);
    }
  }
  rest.dossierDigests = rest.dossiers.map((d) => ({
    conceptId: d.conceptId,
    slug: d.slug,
    digest: dossierDigest(d),
  }));
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
  const d2 = makeDossier({
    conceptId: "C043",
    label: "Other",
  });
  d2.slug = b.dossiers[0].slug;
  d2.assertions[0].assertionId = "C043-A01";
  d2.assertions[0].sourceIds = ["C043-S01"];
  d2.assertions[0].evidenceIds = ["C043-E01"];
  d2.assertions[0].acceptedReviewEventIds = ["REV-C043-001"];
  d2.projectionSlots[0].assertionIds = ["C043-A01"];
  d2.sources[0].sourceId = "C043-S01";
  const plan2 = makePlan(d2);
  const upstream2 = makeUpstreamArtifacts(d2, plan2);
  b.dossiers.push(d2);
  b.projectionPlans.push(plan2);
  b.upstreamArtifacts.push(upstream2);
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

writeNegative("publication-bundle-finding-tamper.json", (b, f) => {
  b.dossiers[0].finding =
    "Tampered unrelated public prose not derived from selected assertions.";
  b.projectionPlans[0].projectionTextDigest = sha256Hex(b.dossiers[0].finding);
  b.upstreamArtifacts[0].derivedPlan = structuredClone(b.projectionPlans[0]);
  b.authorizationEnvelope = makeAuthEnvelope(b.upstreamArtifacts[0]);
  b.dossiers[0].publicationReceipt = makeReceipt(b.authorizationEnvelope);
  b.dossierDigests[0].digest = dossierDigest(b.dossiers[0]);
  f.skipDigestRepair = true;
});

// Published dossier with non-priority slot + tampered finding (must still reject).
{
  const d = makeDossier({
    projectionSlots: [
      { slot: "lexical_history", assertionIds: ["C042-A01"] },
    ],
    assertions: [
      {
        assertionId: "C042-A01",
        role: "lexical_history",
        claim:
          "Within the fixture search scope, the lexical history appears in Source S01 (1970).",
        acceptedReviewEventIds: ["REV-C042-001"],
        evidenceIds: ["C042-E01"],
        sourceIds: ["C042-S01"],
        temporal: { display: "1970", startYear: 1970, precision: "year" },
        caveat:
          "Bounded to the fixture corpus; not a worldwide priority claim.",
      },
    ],
  });
  const plan = {
    conceptId: d.conceptId,
    slug: d.slug,
    slot: "lexical_history",
    templateVersion: FINDING_TEMPLATE_VERSION,
    eligibleAssertionIds: ["C042-A01"],
    normalizedIntervals: [
      {
        assertionId: "C042-A01",
        startYear: 1970,
        precision: "year",
      },
    ],
    searchScopeId: "fixture-scope-1",
    searchScopeDigest: sha256Hex(d.searchScope),
    selectedAssertionIds: ["C042-A01"],
    disposition: "unique",
    projectionTextDigest: "0".repeat(64),
  };
  const honestFinding = regeneratePublicFinding({
    searchScope: d.searchScope,
    slot: plan.slot,
    disposition: plan.disposition,
    selectedAssertionIds: plan.selectedAssertionIds,
    assertions: d.assertions,
    sources: d.sources,
  });
  plan.projectionTextDigest = sha256Hex(honestFinding);
  d.finding =
    "Tampered finding accepted without priority-slot verification path.";
  const upstream = makeUpstreamArtifacts(d, plan);
  upstream.publicationRequest.requestedSlots = ["lexical_history"];
  const env = makeAuthEnvelope(upstream);
  d.publicationReceipt = makeReceipt(env);
  const bundle = signBundle({
    authorizationEnvelope: env,
    upstreamArtifacts: [upstream],
    projectionPlans: [plan],
    dossiers: [d],
  });
  fs.writeFileSync(
    path.join(outDir, "publication-bundle-finding-no-priority-tamper.json"),
    `${JSON.stringify(bundle, null, 2)}\n`,
  );
}

// Upstream derivedPlan digests correctly but differs from live projectionPlans.
writeNegative("publication-bundle-upstream-plan-decoy.json", (b, f) => {
  const decoy = structuredClone(b.projectionPlans[0]);
  decoy.searchScopeId = "decoy-scope-not-used-by-live-plan";
  b.upstreamArtifacts[0].derivedPlan = decoy;
  b.authorizationEnvelope = makeAuthEnvelope(b.upstreamArtifacts[0]);
  b.dossiers[0].publicationReceipt = makeReceipt(b.authorizationEnvelope);
  b.dossierDigests[0].digest = dossierDigest(b.dossiers[0]);
  f.skipDigestRepair = true;
});

// Priority: caller selects 2000 over 1900
{
  const d = makeDossier();
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
  const plan = makePlan(d, {
    eligibleAssertionIds: ["C042-A1900", "C042-A2000"],
    normalizedIntervals: [
      { assertionId: "C042-A1900", startYear: 1900, precision: "year" },
      { assertionId: "C042-A2000", startYear: 2000, precision: "year" },
    ],
    selectedAssertionIds: ["C042-A2000"],
    disposition: "unique",
  });
  const upstream = makeUpstreamArtifacts(d, plan);
  const env = makeAuthEnvelope(upstream);
  d.publicationReceipt = makeReceipt(env);
  const bundle = signBundle({
    authorizationEnvelope: env,
    upstreamArtifacts: [upstream],
    projectionPlans: [plan],
    dossiers: [d],
  });
  fs.writeFileSync(
    path.join(outDir, "publication-bundle-earliest-omission.json"),
    `${JSON.stringify(bundle, null, 2)}\n`,
  );
}

// Priority: exact tie → contested (valid)
{
  const d = makeDossier();
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
  const plan = makePlan(d, {
    eligibleAssertionIds: ["C042-A1", "C042-A2"],
    normalizedIntervals: [
      { assertionId: "C042-A1", startYear: 1950, precision: "year" },
      { assertionId: "C042-A2", startYear: 1950, precision: "year" },
    ],
    selectedAssertionIds: ["C042-A1", "C042-A2"],
    disposition: "contested",
  });
  const upstream = makeUpstreamArtifacts(d, plan);
  const env = makeAuthEnvelope(upstream);
  d.publicationReceipt = makeReceipt(env);
  const bundle = signBundle({
    authorizationEnvelope: env,
    upstreamArtifacts: [upstream],
    projectionPlans: [plan],
    dossiers: [d],
  });
  fs.writeFileSync(
    path.join(outDir, "publication-bundle-earliest-tie-contested.json"),
    `${JSON.stringify(bundle, null, 2)}\n`,
  );
}

console.log("fixtures ok", fs.readdirSync(outDir).filter((f) => f.endsWith(".json")).length);
