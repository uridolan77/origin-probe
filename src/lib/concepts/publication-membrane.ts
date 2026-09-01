import fs from "node:fs";
import path from "node:path";
import { createHash, createPublicKey, verify } from "node:crypto";
import {
  CANONICAL_PUBLICATION_HOST,
  CANONICAL_PUBLICATION_REPOSITORY,
} from "./canonical";
import {
  authorityFingerprintSha256,
  loadPublicationAuthority,
  verifyPublicationSignature,
} from "./publication-authority";
import {
  AuthorityRotationEnvelopeSchema,
  ConceptCatalogFileSchema,
  ConceptPublicationBundleSchema,
  PinnedPublicationPolicySchema,
  PRIORITY_PROJECTION_SLOTS,
  PublishedConceptGenealogySchema,
  SlugSchema,
  type AuthorizationEnvelope,
  type ConceptCatalogFile,
  type ConceptPublicationBundle,
  type PinnedPublicationPolicy,
  type PublicationAuthority,
  type PublicationProjectionPlan,
  type PublishedConceptAssertion,
  type PublishedConceptGenealogy,
} from "./schema";
import {
  FINDING_TEMPLATE_VERSION,
  verifyFindingProjection,
} from "./finding-projection";
import {
  deriveNormalizedIntervals,
  intervalsEqual,
} from "./temporal-normalization";
import {
  loadRegistries,
  validateRegistrySemantics,
  RoleRegistrySchema,
  PolicyRegistrySchema,
  type LoadedRegistries,
} from "./registry-loader";
import { compareCatalogDossierIdentity } from "./catalog-identity";

export class PublicationRejectedError extends Error {
  code = "PUBLICATION_REJECTED" as const;
  constructor(message: string) {
    super(message);
    this.name = "PublicationRejectedError";
  }
}

function fail(msg: string): never {
  throw new PublicationRejectedError(msg);
}

export function sha256Hex(buf: Buffer | string): string {
  return createHash("sha256").update(buf).digest("hex");
}

export function canonicalDossierDigest(
  dossier: PublishedConceptGenealogy,
): string {
  return sha256Hex(Buffer.from(JSON.stringify(dossier), "utf8"));
}

export function signingPayloadWithoutSignature<T extends { signature?: string }>(
  obj: T,
): string {
  const { signature: _s, ...rest } = obj;
  void _s;
  return JSON.stringify(rest);
}

export type MembraneOptions = {
  now?: number;
  allowSuperseded?: boolean;
  /** When true, authority keyId must contain "fixture-only". */
  fixtureMode?: boolean;
  authority?: PublicationAuthority;
  pinnedPolicy?: PinnedPublicationPolicy;
  pinFingerprint?: string;
  rootPublicKeyBase64?: string;
  rotationEnvelope?: unknown;
  /** Override catalog concept IDs allowed in dossiers (fixture isolation). */
  allowedConceptIds?: ReadonlySet<string>;
  /** Skip catalog identity binding (component-only fixture tests). */
  skipCatalogBinding?: boolean;
  /** Override registries directory (fixture isolation). */
  registriesRoot?: string;
};

function parseFiniteTime(label: string, value: string): number {
  const t = Date.parse(value);
  if (!Number.isFinite(t)) fail(`Invalid ${label} timestamp`);
  return t;
}

function loadPinnedPolicy(repoRoot: string): PinnedPublicationPolicy {
  const p = path.join(
    repoRoot,
    "data",
    "concepts",
    "pinned-publication-policy.json",
  );
  return PinnedPublicationPolicySchema.parse(
    JSON.parse(fs.readFileSync(p, "utf8")),
  );
}

function loadRootDocument(repoRoot: string): {
  publicKeyBase64: string;
  fingerprintSha256: string;
} {
  const doc = JSON.parse(
    fs.readFileSync(
      path.join(repoRoot, "data", "concepts", "publication-root.public.json"),
      "utf8",
    ),
  ) as { publicKeyBase64: string; fingerprintSha256?: string };
  return {
    publicKeyBase64: doc.publicKeyBase64,
    fingerprintSha256: (
      doc.fingerprintSha256 ?? authorityFingerprintSha256(doc.publicKeyBase64)
    ).toLowerCase(),
  };
}

function requiresExternalPins(opts: MembraneOptions): boolean {
  if (opts.fixtureMode) return false;
  return (
    process.env.ORIGIN_REQUIRE_EXTERNAL_PINS === "1" ||
    process.env.CI === "true"
  );
}

function loadCatalogIfPresent(repoRoot: string): ConceptCatalogFile | null {
  const catalogPath = path.join(repoRoot, "data", "concepts", "catalog.json");
  if (!fs.existsSync(catalogPath)) return null;
  return ConceptCatalogFileSchema.parse(
    JSON.parse(fs.readFileSync(catalogPath, "utf8")),
  );
}

function loadRegistriesFromRoot(
  repoRoot: string,
  opts: MembraneOptions,
): LoadedRegistries {
  if (opts.registriesRoot) {
    const roleRaw = fs.readFileSync(
      path.join(opts.registriesRoot, "role-registry.json"),
      "utf8",
    );
    const policyRaw = fs.readFileSync(
      path.join(opts.registriesRoot, "policy-registry.json"),
      "utf8",
    );
    const { RoleRegistrySchema: RoleSchema, PolicyRegistrySchema: PolicySchema } =
      { RoleRegistrySchema, PolicyRegistrySchema };
    return {
      roleRegistry: RoleSchema.parse(JSON.parse(roleRaw)),
      policyRegistry: PolicySchema.parse(JSON.parse(policyRaw)),
      roleRegistryDigest: sha256Hex(roleRaw.replace(/\r\n/g, "\n")),
      policyRegistryDigest: sha256Hex(policyRaw.replace(/\r\n/g, "\n")),
    };
  }
  return loadRegistries(repoRoot);
}

function loadCommittedPin(repoRoot: string): string {
  const p = path.join(
    repoRoot,
    "tools",
    "pins",
    "publication-authority.sha256",
  );
  return fs.readFileSync(p, "utf8").trim().toLowerCase();
}

function verifyEd25519(
  payloadUtf8: string,
  signatureBase64: string,
  publicKeyBase64: string,
): boolean {
  const key = createPublicKey({
    key: Buffer.from(publicKeyBase64, "base64"),
    format: "der",
    type: "spki",
  });
  return verify(
    null,
    Buffer.from(payloadUtf8, "utf8"),
    key,
    Buffer.from(signatureBase64, "base64"),
  );
}

export function resolveAuthorityTrust(
  repoRoot: string,
  opts: MembraneOptions = {},
): { authority: PublicationAuthority; policy: PinnedPublicationPolicy } {
  const authority =
    opts.authority ?? loadPublicationAuthority(repoRoot);
  const policy = opts.pinnedPolicy ?? loadPinnedPolicy(repoRoot);
  const fp = authorityFingerprintSha256(authority.publicKeyBase64);

  if (opts.fixtureMode) {
    if (!authority.keyId.includes("fixture-only")) {
      fail("Fixture mode requires a fixture-only authority keyId");
    }
  } else if (authority.keyId.includes("fixture-only")) {
    fail("Production publication authority must not use a fixture-only key");
  }

  const envPin = process.env.ORIGIN_PUBLICATION_AUTHORITY_FINGERPRINT?.trim().toLowerCase();
  const envRootPin = process.env.ORIGIN_PUBLICATION_ROOT_FINGERPRINT?.trim().toLowerCase();
  const committedPin =
    opts.pinFingerprint?.toLowerCase() ??
    (opts.fixtureMode
      ? policy.authorityFingerprintSha256
      : loadCommittedPin(repoRoot));
  const rootDoc = loadRootDocument(repoRoot);

  if (requiresExternalPins(opts)) {
    if (!envPin) {
      fail("Missing ORIGIN_PUBLICATION_AUTHORITY_FINGERPRINT (external pin required)");
    }
    if (!envRootPin) {
      fail("Missing ORIGIN_PUBLICATION_ROOT_FINGERPRINT (external pin required)");
    }
    if (envRootPin !== rootDoc.fingerprintSha256) {
      fail("Root fingerprint pin mismatch");
    }
  } else if (!opts.fixtureMode && envRootPin && envRootPin !== rootDoc.fingerprintSha256) {
    fail("Root fingerprint pin mismatch");
  }

  // Fixture mode never consults the production CI pin env var.
  const expectedPin = requiresExternalPins(opts)
    ? envPin!
    : (opts.fixtureMode ? committedPin : envPin || committedPin).toLowerCase();

  if (fp !== expectedPin) {
    // Allow only with a valid root-signed rotation envelope.
    const rotationPath = path.join(
      repoRoot,
      "data",
      "concepts",
      "authority-rotation-envelope.json",
    );
    const rotationRaw =
      opts.rotationEnvelope ??
      (fs.existsSync(rotationPath)
        ? JSON.parse(fs.readFileSync(rotationPath, "utf8"))
        : null);
    if (!rotationRaw) {
      fail("Authority key substitution rejected: fingerprint pin mismatch");
    }
    const rotation = AuthorityRotationEnvelopeSchema.parse(rotationRaw);
    if (rotation.fromFingerprintSha256 !== expectedPin) {
      fail("Authority rotation from-fingerprint mismatch");
    }
    if (rotation.toFingerprintSha256 !== fp) {
      fail("Authority rotation to-fingerprint mismatch");
    }
    if (rotation.toKeyId !== authority.keyId) {
      fail("Authority rotation toKeyId mismatch");
    }
    const rootKey = opts.rootPublicKeyBase64 ?? rootDoc.publicKeyBase64;
    if (
      requiresExternalPins(opts) &&
      envRootPin &&
      envRootPin !== rootDoc.fingerprintSha256
    ) {
      fail("Root fingerprint pin mismatch for rotation envelope");
    }
    const rotPayload = signingPayloadWithoutSignature(rotation);
    if (!verifyEd25519(rotPayload, rotation.signature, rootKey)) {
      fail("Invalid authority rotation envelope signature");
    }
  } else if (policy.authorityFingerprintSha256 !== fp && !opts.fixtureMode) {
    fail("Pinned publication policy authority fingerprint mismatch");
  }

  return { authority, policy };
}

function exactSetEqual(a: Iterable<string>, b: Iterable<string>): boolean {
  const A = new Set(a);
  const B = new Set(b);
  if (A.size !== B.size) return false;
  for (const x of A) if (!B.has(x)) return false;
  return true;
}

function intervalBounds(interval: {
  startYear: number;
  endYear?: number;
}): { lo: number; hi: number } {
  const lo = interval.startYear;
  const hi = interval.endYear ?? interval.startYear;
  if (hi < lo) fail("Invalid temporal interval: end before start");
  return { lo, hi };
}

function intervalsOverlap(
  a: { lo: number; hi: number },
  b: { lo: number; hi: number },
): boolean {
  return a.lo <= b.hi && b.lo <= a.hi;
}

/**
 * Recompute priority disposition for an earliest_* slot from the plan + assertions.
 */
export function verifyPriorityPlan(
  plan: PublicationProjectionPlan,
  assertions: readonly PublishedConceptAssertion[],
  dossier: PublishedConceptGenealogy,
): void {
  const byId = new Map(assertions.map((a) => [a.assertionId, a]));
  for (const id of plan.eligibleAssertionIds) {
    if (!byId.has(id)) fail("Projection plan eligible assertion missing from dossier");
  }
  if (
    !exactSetEqual(
      plan.eligibleAssertionIds,
      plan.normalizedIntervals.map((i) => i.assertionId),
    )
  ) {
    fail("Projection plan intervals must cover eligible assertion set exactly");
  }

  // Every accepted assertion with this priority role must appear in the eligible set.
  for (const a of assertions) {
    if (a.role === plan.slot && !plan.eligibleAssertionIds.includes(a.assertionId)) {
      fail("Projection plan omits an eligible earlier accepted assertion");
    }
  }

  // Search scope: unqualified earliest requires matching dossier searchScope digest.
  const scopeDigest = sha256Hex(dossier.searchScope);
  if (plan.searchScopeDigest !== scopeDigest) {
    fail("Projection plan search-scope digest mismatch");
  }

  const bounds = plan.normalizedIntervals.map((iv) => ({
    assertionId: iv.assertionId,
    ...intervalBounds(iv),
  }));

  const minLo = Math.min(...bounds.map((b) => b.lo));
  const minima = bounds.filter((b) => b.lo === minLo);

  // Contested if multiple minima or overlapping uncertainty among earliest band.
  let contested = minima.length > 1;
  if (!contested && minima.length === 1) {
    const m = minima[0]!;
    for (const other of bounds) {
      if (other.assertionId === m.assertionId) continue;
      if (intervalsOverlap(m, other) && other.lo <= m.hi) {
        contested = true;
        break;
      }
    }
  }

  const expectedDisposition = contested ? "contested" : "unique";
  if (plan.disposition !== expectedDisposition) {
    fail(
      `Projection plan disposition must be ${expectedDisposition} for chronological result`,
    );
  }

  if (contested) {
    const expectedSelected = minima.map((m) => m.assertionId).sort();
    const selected = [...plan.selectedAssertionIds].sort();
    if (!exactSetEqual(expectedSelected, selected)) {
      fail("Contested projection must select all chronological minima");
    }
  } else {
    const winner = minima[0]!.assertionId;
    if (
      plan.selectedAssertionIds.length !== 1 ||
      plan.selectedAssertionIds[0] !== winner
    ) {
      fail("Caller-selected later earliest claim: selected is not chronological minimum");
    }
  }

  // Dossier projection slot must match plan selection.
  const slot = dossier.projectionSlots.find((s) => s.slot === plan.slot);
  if (!slot) fail("Dossier missing projection slot for plan");
  if (!exactSetEqual(slot.assertionIds, plan.selectedAssertionIds)) {
    fail("Dossier projection slot does not match verified plan selection");
  }

  if (plan.templateVersion !== FINDING_TEMPLATE_VERSION) {
    fail(`Unsupported finding template version: ${plan.templateVersion}`);
  }

  const derivedIntervals = deriveNormalizedIntervals(
    assertions,
    plan.eligibleAssertionIds,
    plan.slot,
  );
  if (!intervalsEqual(plan.normalizedIntervals, derivedIntervals)) {
    fail("Projection plan intervals must match derived assertion temporal facts");
  }

  try {
    verifyFindingProjection(dossier, plan);
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
  }
}

function verifyAuthorizationEnvelope(
  envelope: AuthorizationEnvelope,
  authority: PublicationAuthority,
  dossier: PublishedConceptGenealogy,
  now: number,
): void {
  if (envelope.authorityKeyId !== authority.keyId) {
    fail("Authorization envelope authorityKeyId mismatch");
  }
  if (envelope.authorityKeyId !== dossier.publicationReceipt.authorityKeyId) {
    fail("Receipt authorityKeyId mismatch");
  }
  const authAt = parseFiniteTime("authorization", envelope.authorizedAt);
  if (authAt > now) fail("Future authorization");
  const reviewedAt = parseFiniteTime("review", dossier.reviewedAt);
  const publishedAt = parseFiniteTime("publication", dossier.publishedAt);
  if (authAt < reviewedAt) {
    fail("Authorization occurs before governing reviews");
  }
  if (publishedAt < authAt) {
    fail("Publication occurs before authorization");
  }

  const payload = signingPayloadWithoutSignature(envelope);
  if (
    !verifyPublicationSignature(payload, envelope.signature, authority)
  ) {
    fail("Invalid inner authorization signature");
  }

  const receipt = dossier.publicationReceipt;
  if (
    receipt.workspaceDigest !== envelope.workspaceDigest ||
    receipt.requestDigest !== envelope.requestDigest ||
    receipt.planDigest !== envelope.planDigest ||
    receipt.authorizationId !== envelope.authorizationId ||
    receipt.authorizedAt !== envelope.authorizedAt
  ) {
    fail("Publication receipt does not match authorization envelope");
  }

  // Receipt signature must also verify over receipt fields excluding signature.
  const receiptPayload = signingPayloadWithoutSignature(receipt);
  if (
    !verifyPublicationSignature(receiptPayload, receipt.signature, authority)
  ) {
    fail("Invalid publication receipt signature");
  }
}

function verifyUpstreamArtifacts(
  bundle: ConceptPublicationBundle,
  dossiers: readonly PublishedConceptGenealogy[],
): void {
  for (const dossier of dossiers) {
    const upstream = bundle.upstreamArtifacts.find(
      (u) => u.conceptId === dossier.conceptId && u.slug === dossier.slug,
    );
    if (!upstream) {
      fail(`Missing upstream artifacts for dossier ${dossier.conceptId}`);
    }

    const wsDigest = sha256Hex(
      Buffer.from(JSON.stringify(upstream.reviewedWorkspace), "utf8"),
    );
    const reqDigest = sha256Hex(
      Buffer.from(JSON.stringify(upstream.publicationRequest), "utf8"),
    );
    const planDigest = sha256Hex(
      Buffer.from(JSON.stringify(upstream.derivedPlan), "utf8"),
    );

    if (wsDigest !== bundle.authorizationEnvelope.workspaceDigest) {
      fail("Upstream workspace digest mismatch");
    }
    if (reqDigest !== bundle.authorizationEnvelope.requestDigest) {
      fail("Upstream publication request digest mismatch");
    }
    if (planDigest !== bundle.authorizationEnvelope.planDigest) {
      fail("Upstream derived plan digest mismatch");
    }

    if (upstream.reviewedWorkspace.conceptId !== dossier.conceptId) {
      fail("Upstream workspace conceptId mismatch");
    }
    if (upstream.reviewedWorkspace.slug !== dossier.slug) {
      fail("Upstream workspace slug mismatch");
    }
    if (upstream.publicationRequest.conceptId !== dossier.conceptId) {
      fail("Upstream request conceptId mismatch");
    }
    if (upstream.publicationRequest.slug !== dossier.slug) {
      fail("Upstream request slug mismatch");
    }
    if (upstream.publicationRequest.revision !== dossier.revision) {
      fail("Upstream request revision mismatch");
    }

    const dossierAssertionIds = new Set(
      dossier.assertions.map((a) => a.assertionId),
    );
    for (const id of dossierAssertionIds) {
      if (!upstream.reviewedWorkspace.acceptedAssertionIds.includes(id)) {
        fail(`Upstream workspace missing accepted assertion ${id}`);
      }
    }

    for (const rid of upstream.reviewedWorkspace.reviewEventIds) {
      let found = false;
      for (const a of dossier.assertions) {
        if (a.acceptedReviewEventIds.includes(rid)) {
          found = true;
          break;
        }
      }
      if (!found) {
        fail(`Upstream review event ${rid} not referenced by dossier assertions`);
      }
    }

    const plans = bundle.projectionPlans.filter(
      (p) => p.conceptId === dossier.conceptId && p.slug === dossier.slug,
    );
    // The upstream derived plan must be byte-identical to the live projection
    // plan that will be used for priority/finding verification — not merely a
    // digest-compatible decoy that differs from bundle.projectionPlans.
    const derivedMatches = plans.some(
      (p) => JSON.stringify(p) === JSON.stringify(upstream.derivedPlan),
    );
    if (!derivedMatches) {
      fail("Upstream derived plan does not match verified projection plan");
    }
    if (plans.length === 1) {
      if (JSON.stringify(plans[0]) !== JSON.stringify(upstream.derivedPlan)) {
        fail("Upstream derived plan does not match the sole verified projection plan");
      }
    } else {
      // When multiple plans exist for the dossier, the governing priority plan
      // (if any) must be the exact upstream derivedPlan object.
      for (const prioritySlot of PRIORITY_PROJECTION_SLOTS) {
        const priorityPlan = plans.find((p) => p.slot === prioritySlot);
        if (
          priorityPlan &&
          JSON.stringify(priorityPlan) !== JSON.stringify(upstream.derivedPlan)
        ) {
          fail(
            "Upstream derived plan does not match the priority projection plan under verification",
          );
        }
      }
    }
  }
}

function verifyCatalogBinding(
  catalog: ConceptCatalogFile,
  dossier: PublishedConceptGenealogy,
): void {
  const byId = catalog.items.find((i) => i.conceptId === dossier.conceptId);
  const bySlug = catalog.items.find((i) => i.slug === dossier.slug);
  if (!byId) fail(`Unknown catalog conceptId ${dossier.conceptId}`);
  if (!bySlug) fail(`Unknown catalog slug ${dossier.slug}`);
  if (byId.conceptId !== bySlug.conceptId || byId.slug !== bySlug.slug) {
    fail("Catalog conceptId/slug identity binding mismatch");
  }
  const mismatches = compareCatalogDossierIdentity(byId, dossier);
  if (mismatches.length > 0) {
    fail(`Catalog/dossier identity mismatch: ${mismatches[0]!.field}`);
  }
  if (byId.researchMaturity !== "published") {
    fail(`${dossier.slug}: catalog maturity must be published for active dossier`);
  }
}

/**
 * Parse + verify a signed publication bundle. Shared by importer, loader, guards, tests.
 */
export function verifyPublicationBundle(
  raw: unknown,
  repoRoot: string = process.cwd(),
  opts: MembraneOptions = {},
): ConceptPublicationBundle {
  const { authority, policy } = resolveAuthorityTrust(repoRoot, opts);
  const registries = loadRegistriesFromRoot(repoRoot, opts);
  const now = opts.now ?? Date.now();
  const catalog = opts.skipCatalogBinding ? null : loadCatalogIfPresent(repoRoot);

  // Pre-schema semantic rejects so adversarial fixtures keep stable messages.
  if (raw && typeof raw === "object") {
    const pre = raw as {
      packageKind?: string;
      packageVersion?: number;
      repository?: string;
      canonicalHost?: string;
      revoked?: boolean;
      dossiers?: Array<{
        callerSelectedEarliestAssertionId?: unknown;
        assertions?: Array<{
          state?: string;
          reviewState?: string;
          acceptance?: string;
          acceptedReviewEventIds?: unknown[];
        }>;
      }>;
    };
    if (pre.repository && pre.repository !== CANONICAL_PUBLICATION_REPOSITORY) {
      fail("Repository mismatch");
    }
    if (pre.canonicalHost && pre.canonicalHost !== CANONICAL_PUBLICATION_HOST) {
      fail("Canonical host mismatch");
    }
    if (pre.revoked === true) fail("Bundle revoked");
    for (const dossier of pre.dossiers ?? []) {
      if (dossier.callerSelectedEarliestAssertionId) {
        fail('Caller-selected later "earliest" claim');
      }
      for (const assertion of dossier.assertions ?? []) {
        if (assertion.state && assertion.state !== "accepted") {
          fail("Candidate or unaccepted assertion included");
        }
        if (assertion.reviewState && assertion.reviewState !== "accepted") {
          fail("Sourced but unaccepted assertion included");
        }
        if (
          assertion.acceptance !== undefined &&
          assertion.acceptance !== "accepted"
        ) {
          fail("Unaccepted assertion included");
        }
        if (
          Array.isArray(assertion.acceptedReviewEventIds) &&
          assertion.acceptedReviewEventIds.length === 0
        ) {
          fail("Missing accepted-review lineage");
        }
      }
    }
  }

  let parsed: ConceptPublicationBundle;
  try {
    parsed = ConceptPublicationBundleSchema.parse(raw);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/acceptedReviewEventIds/i.test(msg)) {
      fail("Missing accepted-review lineage");
    }
    fail(`Bundle schema validation failed: ${msg}`);
  }

  if (parsed.repository !== CANONICAL_PUBLICATION_REPOSITORY) {
    fail("Repository mismatch");
  }
  if (parsed.canonicalHost !== CANONICAL_PUBLICATION_HOST) {
    fail("Canonical host mismatch");
  }
  if (parsed.revoked === true) fail("Bundle revoked");
  const generatedAt = parseFiniteTime("generatedAt", parsed.generatedAt);
  if (generatedAt > now) fail("Future bundle generatedAt");
  if (parsed.expiresAt) {
    const exp = parseFiniteTime("expiry", parsed.expiresAt);
    if (exp < now) fail("Stale authorization / expired bundle");
  }
  if (authority.expiresAt) {
    const authExp = parseFiniteTime("authority expiry", authority.expiresAt);
    if (authExp < now) fail("Publication authority expired");
  }
  if (authority.revoked === true) fail("Publication authority revoked");

  validateRegistrySemantics(
    registries.roleRegistry,
    registries.policyRegistry,
    parsed.packageKind,
    parsed.packageVersion,
    FINDING_TEMPLATE_VERSION,
  );

  if (parsed.roleRegistryDigest !== registries.roleRegistryDigest) {
    fail("Role registry digest mismatch");
  }
  if (parsed.policyRegistryDigest !== registries.policyRegistryDigest) {
    fail("Policy registry digest mismatch");
  }
  if (parsed.roleRegistryDigest !== policy.roleRegistryDigest) {
    fail("Registry mismatch");
  }
  if (parsed.policyRegistryDigest !== policy.policyRegistryDigest) {
    fail("Registry mismatch");
  }

  if (
    !exactSetEqual(
      parsed.dossiers.map((d) => `${d.conceptId}:${d.slug}`),
      parsed.upstreamArtifacts.map((u) => `${u.conceptId}:${u.slug}`),
    )
  ) {
    fail("upstreamArtifacts must cover dossier set exactly");
  }

  const conceptIds = new Set<string>();
  const slugs = new Set<string>();
  for (const dossier of parsed.dossiers) {
    if (conceptIds.has(dossier.conceptId)) fail("Duplicate concept ID");
    conceptIds.add(dossier.conceptId);
    if (slugs.has(dossier.slug)) fail("Duplicate concept slug");
    slugs.add(dossier.slug);
  }

  verifyUpstreamArtifacts(parsed, parsed.dossiers);

  if (parsed.signerKeyId !== authority.keyId) fail("Unknown signer");

  const outerPayload = signingPayloadWithoutSignature(parsed);
  if (!verifyPublicationSignature(outerPayload, parsed.signature, authority)) {
    fail("Invalid signature");
  }

  if (parsed.sourceCandidatePackageDigest !== policy.sourceCandidatePackageDigest) {
    fail("Incorrect source Candidate digest");
  }

  // Exact dossier digest set
  const digestKeys = parsed.dossierDigests.map((d) => `${d.conceptId}:${d.slug}`);
  const dossierKeys = parsed.dossiers.map((d) => `${d.conceptId}:${d.slug}`);
  if (!exactSetEqual(digestKeys, dossierKeys)) {
    fail("dossierDigests must be an exact set over dossiers");
  }
  if (new Set(digestKeys).size !== digestKeys.length) {
    fail("Duplicate dossier digest records");
  }

  const assertionIds = new Set<string>();
  const sourceIds = new Set<string>();
  const evidenceIds = new Set<string>();
  const reviewEventIds = new Set<string>();
  const allowedIds = opts.allowedConceptIds;

  for (const dossier of parsed.dossiers) {
    // Re-parse each dossier with product schema (already done by bundle schema,
    // but keep explicit for callers that pass partially typed objects).
    PublishedConceptGenealogySchema.parse(dossier);

    if (allowedIds && !allowedIds.has(dossier.conceptId)) {
      fail("Invalid concept ID for publication catalog");
    }

    if (dossier.status === "withdrawn") fail("Publication of a withdrawn dossier");
    if (dossier.status === "superseded" && !opts.allowSuperseded) {
      fail("Stale or superseded publication");
    }
    if (dossier.status !== "published" && dossier.status !== "superseded") {
      fail(`Invalid dossier status: ${dossier.status}`);
    }
    if (dossier.revision > 1 && !dossier.supersedesDossierDigest) {
      fail("Revision > 1 requires supersedesDossierDigest");
    }

    if (catalog && dossier.status === "published") {
      verifyCatalogBinding(catalog, dossier);
    }

    const expected = parsed.dossierDigests.find(
      (d) => d.conceptId === dossier.conceptId && d.slug === dossier.slug,
    );
    if (!expected) fail("Missing dossier digest entry");
    if (canonicalDossierDigest(dossier) !== expected.digest) {
      fail("Digest mismatch");
    }

    if (
      dossier.publicationReceipt.roleRegistryDigest !== parsed.roleRegistryDigest ||
      dossier.publicationReceipt.policyRegistryDigest !== parsed.policyRegistryDigest
    ) {
      fail("Registry mismatch");
    }

    if (
      dossier.publicationReceipt.workspaceDigest !==
        parsed.authorizationEnvelope.workspaceDigest ||
      dossier.publicationReceipt.requestDigest !==
        parsed.authorizationEnvelope.requestDigest ||
      dossier.publicationReceipt.planDigest !==
        parsed.authorizationEnvelope.planDigest
    ) {
      fail("Incorrect workspace/request/plan digest");
    }

    verifyAuthorizationEnvelope(
      parsed.authorizationEnvelope,
      authority,
      dossier,
      now,
    );

    const sourceIdSet = new Set(dossier.sources.map((s) => s.sourceId));
    for (const src of dossier.sources) {
      if (sourceIds.has(src.sourceId)) fail("Duplicate source ID");
      sourceIds.add(src.sourceId);
    }

    for (const assertion of dossier.assertions) {
      if (assertionIds.has(assertion.assertionId)) fail("Duplicate assertion ID");
      assertionIds.add(assertion.assertionId);

      for (const eid of assertion.evidenceIds) {
        if (evidenceIds.has(eid)) fail("Duplicate evidence ID");
        evidenceIds.add(eid);
      }
      for (const rid of assertion.acceptedReviewEventIds) {
        if (reviewEventIds.has(rid)) fail("Duplicate review event ID");
        reviewEventIds.add(rid);
      }

      // Reject sneaky acceptance fields if present via index access on raw objects
      const rawAssertion = assertion as PublishedConceptAssertion & {
        state?: string;
        reviewState?: string;
        acceptance?: string;
      };
      if (rawAssertion.state && rawAssertion.state !== "accepted") {
        fail("Candidate or unaccepted assertion included");
      }
      if (rawAssertion.reviewState && rawAssertion.reviewState !== "accepted") {
        fail("Sourced but unaccepted assertion included");
      }
      if (
        rawAssertion.acceptance !== undefined &&
        rawAssertion.acceptance !== "accepted"
      ) {
        fail("Unaccepted assertion included");
      }

      for (const sid of assertion.sourceIds) {
        if (!sourceIdSet.has(sid)) fail("Missing source/evidence closure");
      }
      const claimLower = assertion.claim.toLowerCase();
      if (
        /\b(first ever|worldwide|absolute worldwide|the definitive origin)\b/.test(
          claimLower,
        ) &&
        !assertion.caveat
      ) {
        fail("Absolute worldwide-priority language outside a bounded scope");
      }
    }

    const assertSet = new Set(dossier.assertions.map((a) => a.assertionId));
    const slotNames = new Set<string>();
    for (const slot of dossier.projectionSlots) {
      if (slotNames.has(slot.slot)) fail("Duplicate projection slot");
      slotNames.add(slot.slot);
      for (const aid of slot.assertionIds) {
        if (!assertSet.has(aid)) {
          fail("Projection not derived by the trusted publication plan");
        }
      }
    }

    // Priority plans required when present; finding projection is unconditional
    // for every published dossier.
    let governingPlan: PublicationProjectionPlan | null = null;
    for (const prioritySlot of PRIORITY_PROJECTION_SLOTS) {
      if (!slotNames.has(prioritySlot)) continue;
      const plans = parsed.projectionPlans.filter(
        (p) =>
          p.conceptId === dossier.conceptId &&
          p.slug === dossier.slug &&
          p.slot === prioritySlot,
      );
      if (plans.length !== 1) {
        fail(`Missing or duplicate projection plan for ${prioritySlot}`);
      }
      verifyPriorityPlan(plans[0]!, dossier.assertions, dossier);
      governingPlan = plans[0]!;
    }

    if (!governingPlan) {
      const dossierPlans = parsed.projectionPlans.filter(
        (p) => p.conceptId === dossier.conceptId && p.slug === dossier.slug,
      );
      if (dossierPlans.length !== 1) {
        fail("Published dossier missing finding-authority plan");
      }
      governingPlan = dossierPlans[0]!;
      try {
        verifyFindingProjection(dossier, governingPlan);
      } catch (err) {
        fail(err instanceof Error ? err.message : String(err));
      }
    }
  }

  // Every projection plan must reference a dossier with exact identity pair
  for (const plan of parsed.projectionPlans) {
    const dossier = parsed.dossiers.find(
      (d) => d.conceptId === plan.conceptId && d.slug === plan.slug,
    );
    if (!dossier) {
      fail("Projection plan references unknown dossier");
    }
    if (plan.conceptId !== dossier!.conceptId || plan.slug !== dossier!.slug) {
      fail("Projection plan identity pair mismatch");
    }
  }

  return parsed;
}

export function derivePublishedDossiers(
  bundle: ConceptPublicationBundle,
): PublishedConceptGenealogy[] {
  return bundle.dossiers.filter((d) => d.status === "published");
}

export function authorizedAcceptedAssertionIds(
  bundle: ConceptPublicationBundle,
): string[] {
  const ids = new Set<string>();
  for (const plan of bundle.projectionPlans) {
    for (const id of plan.selectedAssertionIds) ids.add(id);
  }
  return [...ids].sort();
}

export function planSelectedAssertionIds(
  bundle: ConceptPublicationBundle,
): string[] {
  return authorizedAcceptedAssertionIds(bundle);
}

export function safePublicationPath(
  publicationsDir: string,
  slug: string,
): string {
  const parsedSlug = SlugSchema.safeParse(slug);
  if (!parsedSlug.success) fail("Slug must match product slug schema");
  const resolvedDir = path.resolve(publicationsDir);
  const outPath = path.resolve(resolvedDir, `${parsedSlug.data}.json`);
  if (
    outPath !== path.join(resolvedDir, `${parsedSlug.data}.json`) &&
    !outPath.startsWith(resolvedDir + path.sep)
  ) {
    fail("Publication path escapes publications directory");
  }
  if (!outPath.startsWith(resolvedDir + path.sep) && outPath !== resolvedDir) {
    // Windows: ensure under dir
    const rel = path.relative(resolvedDir, outPath);
    if (rel.startsWith("..") || path.isAbsolute(rel)) {
      fail("Publication path escapes publications directory");
    }
  }
  return outPath;
}

export function writeDossierAtomic(
  publicationsDir: string,
  dossier: PublishedConceptGenealogy,
): string {
  fs.mkdirSync(publicationsDir, { recursive: true });
  const outPath = safePublicationPath(publicationsDir, dossier.slug);
  const tmp = `${outPath}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(dossier, null, 2)}\n`);
  fs.renameSync(tmp, outPath);
  return outPath;
}

export function importPublicationBundle(
  bundlePath: string,
  repoRoot: string = process.cwd(),
  opts: MembraneOptions = {},
): { ok: true; written: string[]; bundle: ConceptPublicationBundle } {
  const raw: unknown = JSON.parse(fs.readFileSync(bundlePath, "utf8"));
  const bundle = verifyPublicationBundle(raw, repoRoot, opts);
  const outDir = path.join(repoRoot, "data", "concepts", "publications");
  const bundlesDir = path.join(repoRoot, "data", "concepts", "publication-bundles");
  fs.mkdirSync(bundlesDir, { recursive: true });

  // Persist the verified bundle as the authoritative committed input.
  const bundleName = path.basename(bundlePath);
  const destBundle = path.join(bundlesDir, bundleName);
  if (path.resolve(bundlePath) !== path.resolve(destBundle)) {
    fs.copyFileSync(bundlePath, destBundle);
  }

  const written: string[] = [];
  for (const dossier of derivePublishedDossiers(bundle)) {
    written.push(writeDossierAtomic(outDir, dossier));
  }
  return { ok: true, written, bundle };
}

export type LoadedPublications = {
  bundles: ConceptPublicationBundle[];
  dossiers: PublishedConceptGenealogy[];
  authorizedAssertionIds: string[];
};

/**
 * Load publications from signed bundles only. Orphan dossier JSON is rejected.
 */
export function loadVerifiedPublications(
  repoRoot: string = process.cwd(),
  opts: MembraneOptions = {},
): LoadedPublications {
  const bundlesDir = path.join(repoRoot, "data", "concepts", "publication-bundles");
  const pubDir = path.join(repoRoot, "data", "concepts", "publications");

  const bundles: ConceptPublicationBundle[] = [];
  const dossiers: PublishedConceptGenealogy[] = [];
  const authorized = new Set<string>();
  const globalConceptIds = new Map<string, PublishedConceptGenealogy>();
  const globalSlugs = new Map<string, PublishedConceptGenealogy>();
  const bundleContentDigests = new Set<string>();
  const activeDigests = new Map<string, string>();

  if (fs.existsSync(bundlesDir)) {
    const files = fs
      .readdirSync(bundlesDir)
      .filter((f) => f.endsWith(".json"))
      .sort();
    for (const file of files) {
      const filePath = path.join(bundlesDir, file);
      const rawText = fs.readFileSync(filePath, "utf8");
      const raw: unknown = JSON.parse(rawText);
      const contentDigest = sha256Hex(rawText.replace(/\r\n/g, "\n"));
      if (bundleContentDigests.has(contentDigest)) {
        fail(`Duplicate bundle content loaded from ${file}`);
      }
      bundleContentDigests.add(contentDigest);

      const bundle = verifyPublicationBundle(raw, repoRoot, opts);
      bundles.push(bundle);
      for (const d of derivePublishedDossiers(bundle)) {
        const priorConcept = globalConceptIds.get(d.conceptId);
        if (priorConcept) {
          fail(`Duplicate active concept ${d.conceptId} across bundles`);
        }
        const priorSlug = globalSlugs.get(d.slug);
        if (priorSlug) {
          fail(`Duplicate active slug ${d.slug} across bundles`);
        }

        if (d.revision > 1) {
          if (!d.supersedesDossierDigest) {
            fail("Revision > 1 requires supersedesDossierDigest");
          }
          const priorDigest = activeDigests.get(d.conceptId);
          if (!priorDigest || priorDigest !== d.supersedesDossierDigest) {
            fail("Invalid supersession chain: supersedesDossierDigest mismatch");
          }
        }

        const digest = canonicalDossierDigest(d);
        activeDigests.set(d.conceptId, digest);
        globalConceptIds.set(d.conceptId, d);
        globalSlugs.set(d.slug, d);
        dossiers.push(d);
      }
      for (const id of authorizedAcceptedAssertionIds(bundle)) {
        authorized.add(id);
      }
    }
  }

  // Byte-parity / orphan rejection for publications/*.json
  if (fs.existsSync(pubDir)) {
    const derivedBySlug = new Map(
      dossiers.map((d) => [
        d.slug,
        `${JSON.stringify(d, null, 2)}\n`,
      ]),
    );
    const files = fs.readdirSync(pubDir).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      const full = path.join(pubDir, file);
      const onDisk = fs.readFileSync(full, "utf8");
      const slug = file.replace(/\.json$/, "");
      const expected = derivedBySlug.get(slug);
      if (!expected) {
        fail(
          `Standalone dossier injection rejected: ${file} has no governing signed bundle`,
        );
      }
      if (onDisk !== expected) {
        fail(`Generated dossier byte drift for ${file}`);
      }
      derivedBySlug.delete(slug);
    }
    // Remaining derived dossiers without committed files are OK (derive-in-memory).
  }

  return {
    bundles,
    dossiers,
    authorizedAssertionIds: [...authorized].sort(),
  };
}

export function resolveMembraneOptionsForRepo(
  repoRoot: string = process.cwd(),
): MembraneOptions {
  const authPath = path.join(
    repoRoot,
    "data",
    "concepts",
    "publication-authority.public.json",
  );
  if (!fs.existsSync(authPath)) return {};
  const authority = loadPublicationAuthority(repoRoot);
  if (!authority.keyId.includes("fixture-only")) return {};
  const policy = loadPinnedPolicy(repoRoot);
  const registriesRoot = path.join(repoRoot, "data", "concepts", "registries");
  return {
    fixtureMode: true,
    authority,
    pinnedPolicy: policy,
    pinFingerprint: policy.authorityFingerprintSha256,
    registriesRoot: fs.existsSync(registriesRoot) ? registriesRoot : undefined,
  };
}

export function validatePublicationBundle(
  bundle: unknown,
  authority: PublicationAuthority,
  opts: MembraneOptions = {},
): { ok: true; dossierCount: number } {
  const policy =
    opts.pinnedPolicy ??
    ({
      schemaVersion: 1 as const,
      sourceCandidatePackageDigest:
        typeof bundle === "object" &&
        bundle &&
        "sourceCandidatePackageDigest" in bundle
          ? String(
              (bundle as { sourceCandidatePackageDigest: string })
                .sourceCandidatePackageDigest,
            )
          : "a2e463e0b134b4ed49ebb6cced8d0bf1afbb2dcf5780568d7e66ac31299d6814",
      roleRegistryDigest:
        typeof bundle === "object" &&
        bundle &&
        "roleRegistryDigest" in bundle
          ? String((bundle as { roleRegistryDigest: string }).roleRegistryDigest)
          : "038a5c3d0da5963142d59b8177778d90e4415084ea35c3c7dd95f67c04ab5a9b",
      policyRegistryDigest:
        typeof bundle === "object" &&
        bundle &&
        "policyRegistryDigest" in bundle
          ? String((bundle as { policyRegistryDigest: string }).policyRegistryDigest)
          : "e1785ba1ef8036360241bcdb6570a87af084f6d07afde7ef2d82d0d21b2673f9",
      authorityFingerprintSha256: authorityFingerprintSha256(
        authority.publicKeyBase64,
      ),
    } satisfies PinnedPublicationPolicy);

  const verified = verifyPublicationBundle(bundle, process.cwd(), {
    ...opts,
    authority,
    pinnedPolicy: policy,
    pinFingerprint: authorityFingerprintSha256(authority.publicKeyBase64),
    fixtureMode: opts.fixtureMode ?? authority.keyId.includes("fixture-only"),
  });
  return { ok: true, dossierCount: verified.dossiers.length };
}
