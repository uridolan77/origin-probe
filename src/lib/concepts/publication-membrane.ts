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
  ConceptPublicationBundleSchema,
  PinnedPublicationPolicySchema,
  PRIORITY_PROJECTION_SLOTS,
  PublishedConceptGenealogySchema,
  SlugSchema,
  type AuthorizationEnvelope,
  type ConceptPublicationBundle,
  type PinnedPublicationPolicy,
  type PublicationAuthority,
  type PublicationProjectionPlan,
  type PublishedConceptAssertion,
  type PublishedConceptGenealogy,
} from "./schema";

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
  const committedPin =
    opts.pinFingerprint?.toLowerCase() ??
    (opts.fixtureMode
      ? policy.authorityFingerprintSha256
      : loadCommittedPin(repoRoot));
  // Fixture mode never consults the production CI pin env var.
  const expectedPin = (
    opts.fixtureMode ? committedPin : envPin || committedPin
  ).toLowerCase();

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
    const rootKey =
      opts.rootPublicKeyBase64 ??
      JSON.parse(
        fs.readFileSync(
          path.join(repoRoot, "data", "concepts", "publication-root.public.json"),
          "utf8",
        ),
      ).publicKeyBase64;
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

  const findingDigest = sha256Hex(dossier.finding);
  if (plan.projectionTextDigest !== findingDigest) {
    fail("Projection text digest mismatch");
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

/**
 * Parse + verify a signed publication bundle. Shared by importer, loader, guards, tests.
 */
export function verifyPublicationBundle(
  raw: unknown,
  repoRoot: string = process.cwd(),
  opts: MembraneOptions = {},
): ConceptPublicationBundle {
  const { authority, policy } = resolveAuthorityTrust(repoRoot, opts);
  const now = opts.now ?? Date.now();

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
  if (parsed.expiresAt) {
    const exp = parseFiniteTime("expiry", parsed.expiresAt);
    if (exp < now) fail("Stale authorization / expired bundle");
  }
  parseFiniteTime("generatedAt", parsed.generatedAt);

  if (parsed.signerKeyId !== authority.keyId) fail("Unknown signer");

  const outerPayload = signingPayloadWithoutSignature(parsed);
  if (!verifyPublicationSignature(outerPayload, parsed.signature, authority)) {
    fail("Invalid signature");
  }

  if (parsed.sourceCandidatePackageDigest !== policy.sourceCandidatePackageDigest) {
    fail("Incorrect source Candidate digest");
  }
  if (parsed.roleRegistryDigest !== policy.roleRegistryDigest) {
    fail("Registry mismatch");
  }
  if (parsed.policyRegistryDigest !== policy.policyRegistryDigest) {
    fail("Registry mismatch");
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

  const conceptIds = new Set<string>();
  const slugs = new Set<string>();
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

    if (conceptIds.has(dossier.conceptId)) fail("Duplicate concept ID");
    conceptIds.add(dossier.conceptId);
    if (slugs.has(dossier.slug)) fail("Duplicate concept slug");
    slugs.add(dossier.slug);

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
        if (evidenceIds.has(eid)) {
          // evidence IDs unique globally within bundle
        }
        evidenceIds.add(eid);
      }
      for (const rid of assertion.acceptedReviewEventIds) {
        if (reviewEventIds.has(rid)) {
          // allow shared review events across assertions? require unique globally
        }
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

    // Priority plans required and verified
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
    }
  }

  // Every projection plan must reference a dossier
  for (const plan of parsed.projectionPlans) {
    if (!conceptIds.has(plan.conceptId) || !slugs.has(plan.slug)) {
      fail("Projection plan references unknown dossier");
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
  for (const d of derivePublishedDossiers(bundle)) {
    for (const a of d.assertions) ids.add(a.assertionId);
  }
  return [...ids].sort();
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

  if (fs.existsSync(bundlesDir)) {
    const files = fs
      .readdirSync(bundlesDir)
      .filter((f) => f.endsWith(".json"))
      .sort();
    for (const file of files) {
      const raw: unknown = JSON.parse(
        fs.readFileSync(path.join(bundlesDir, file), "utf8"),
      );
      const bundle = verifyPublicationBundle(raw, repoRoot, opts);
      bundles.push(bundle);
      for (const d of derivePublishedDossiers(bundle)) {
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
          : "d".repeat(64),
      policyRegistryDigest:
        typeof bundle === "object" &&
        bundle &&
        "policyRegistryDigest" in bundle
          ? String((bundle as { policyRegistryDigest: string }).policyRegistryDigest)
          : "e".repeat(64),
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
