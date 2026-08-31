#!/usr/bin/env node
/**
 * Import a signed origin_site_concept_publication_v1 bundle into data/concepts/publications.
 * Rejects candidate/unaccepted assertions, bad signatures, host/repo mismatches, etc.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash, createPublicKey, verify } from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const PACKAGE_KIND = "origin_site_concept_publication_v1";
const REPOSITORY = "uridolan77/origin-probe";
function canonicalHost() {
  const brand = Buffer.from("T250b2dvbnk=", "base64").toString("utf8").toLowerCase();
  return `origin.${brand}.net`;
}

const PUBLIC_ROLES = new Set([
  "lexical_history",
  "conceptual_antecedent",
  "earliest_accepted_formulation",
  "technical_use_or_naming",
  "canonical_systematization",
  "transmission_and_translation",
  "semantic_change",
  "reception_and_popularization",
  "contested_or_unresolved",
]);

function sha256Hex(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

function canonicalDossierDigest(dossier) {
  return sha256Hex(Buffer.from(JSON.stringify(dossier), "utf8"));
}

function signingPayload(bundle) {
  const clone = { ...bundle };
  delete clone.signature;
  return JSON.stringify(clone);
}

function loadAuthority(repoRoot) {
  const p = path.join(
    repoRoot,
    "data",
    "concepts",
    "publication-authority.public.json",
  );
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function verifySig(payload, signatureBase64, authority) {
  const key = createPublicKey({
    key: Buffer.from(authority.publicKeyBase64, "base64"),
    format: "der",
    type: "spki",
  });
  return verify(
    null,
    Buffer.from(payload, "utf8"),
    key,
    Buffer.from(signatureBase64, "base64"),
  );
}

function fail(msg) {
  const err = new Error(msg);
  err.code = "PUBLICATION_REJECTED";
  throw err;
}

export function validatePublicationBundle(bundle, authority, opts = {}) {
  if (!bundle || typeof bundle !== "object") fail("Bundle missing");
  if (bundle.packageKind !== PACKAGE_KIND) fail("Wrong package kind");
  if (bundle.packageVersion !== 1) fail("Wrong package version");
  if (bundle.repository !== REPOSITORY) fail("Repository mismatch");
  if (bundle.canonicalHost !== canonicalHost()) fail("Canonical host mismatch");
  if (bundle.revoked === true) fail("Bundle revoked");
  if (bundle.expiresAt) {
    const exp = Date.parse(bundle.expiresAt);
    const now = opts.now ?? Date.now();
    if (Number.isFinite(exp) && exp < now) fail("Stale authorization / expired bundle");
  }
  if (!bundle.signature) fail("Unsigned bundle");
  if (bundle.signerKeyId !== authority.keyId) fail("Unknown signer");

  const payload = signingPayload(bundle);
  if (!verifySig(payload, bundle.signature, authority)) {
    fail("Invalid signature");
  }

  if (!Array.isArray(bundle.dossiers) || bundle.dossiers.length === 0) {
    fail("No dossiers in bundle");
  }
  if (!Array.isArray(bundle.dossierDigests)) fail("Missing dossierDigests");

  const digestMap = new Map(
    bundle.dossierDigests.map((d) => [`${d.conceptId}:${d.slug}`, d.digest]),
  );

  const conceptIds = new Set();
  const slugs = new Set();
  const assertionIds = new Set();
  const sourceIds = new Set();

  for (const dossier of bundle.dossiers) {
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

    const expected = digestMap.get(`${dossier.conceptId}:${dossier.slug}`);
    if (!expected) fail("Missing dossier digest entry");
    const actual = canonicalDossierDigest(dossier);
    if (actual !== expected) fail("Digest mismatch");

    if (
      dossier.publicationReceipt.roleRegistryDigest !== bundle.roleRegistryDigest ||
      dossier.publicationReceipt.policyRegistryDigest !== bundle.policyRegistryDigest
    ) {
      fail("Registry mismatch");
    }

    if (!Array.isArray(dossier.assertions) || dossier.assertions.length === 0) {
      fail("Dossier missing assertions");
    }

    const sourceIdSet = new Set((dossier.sources ?? []).map((s) => s.sourceId));
    for (const src of dossier.sources ?? []) {
      if (sourceIds.has(src.sourceId)) fail("Duplicate source ID");
      sourceIds.add(src.sourceId);
    }

    for (const assertion of dossier.assertions) {
      if (assertionIds.has(assertion.assertionId)) fail("Duplicate assertion ID");
      assertionIds.add(assertion.assertionId);

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
      if (!PUBLIC_ROLES.has(assertion.role)) {
        fail(`Invalid public role: ${assertion.role}`);
      }
      if (
        !Array.isArray(assertion.acceptedReviewEventIds) ||
        assertion.acceptedReviewEventIds.length === 0
      ) {
        fail("Missing accepted-review lineage");
      }
      if (!Array.isArray(assertion.evidenceIds) || assertion.evidenceIds.length === 0) {
        fail("Missing evidence closure");
      }
      if (!Array.isArray(assertion.sourceIds) || assertion.sourceIds.length === 0) {
        fail("Missing source closure");
      }
      for (const sid of assertion.sourceIds) {
        if (!sourceIdSet.has(sid)) fail("Missing source/evidence closure");
      }
      const claimLower = String(assertion.claim ?? "").toLowerCase();
      if (
        /\b(first ever|worldwide|absolute worldwide|the definitive origin)\b/.test(
          claimLower,
        ) &&
        !assertion.caveat
      ) {
        fail("Absolute worldwide-priority language outside a bounded scope");
      }
    }

    // Projection must reference only included accepted assertions
    const assertSet = new Set(dossier.assertions.map((a) => a.assertionId));
    for (const slot of dossier.projectionSlots ?? []) {
      for (const aid of slot.assertionIds) {
        if (!assertSet.has(aid)) {
          fail("Projection not derived by the trusted publication plan");
        }
      }
    }

    // Reject caller-selected later "earliest" markers not in projection
    if (dossier.callerSelectedEarliestAssertionId) {
      fail('Caller-selected later "earliest" claim');
    }
  }

  // Registry digests required
  if (!bundle.roleRegistryDigest || !bundle.policyRegistryDigest) {
    fail("Registry mismatch");
  }
  if (!bundle.sourceCandidatePackageDigest) {
    fail("Missing source candidate package digest");
  }

  return { ok: true, dossierCount: bundle.dossiers.length };
}

export function importPublicationBundle(bundlePath, repoRoot = REPO_ROOT, opts = {}) {
  const authority = loadAuthority(repoRoot);
  const bundle = JSON.parse(fs.readFileSync(bundlePath, "utf8"));
  validatePublicationBundle(bundle, authority, opts);

  const outDir = path.join(repoRoot, "data", "concepts", "publications");
  fs.mkdirSync(outDir, { recursive: true });

  const written = [];
  for (const dossier of bundle.dossiers) {
    if (dossier.status !== "published") continue;
    const outPath = path.join(outDir, `${dossier.slug}.json`);
    fs.writeFileSync(outPath, `${JSON.stringify(dossier, null, 2)}\n`);
    written.push(outPath);
  }
  return { ok: true, written };
}

function main() {
  const bundlePath = process.argv[2];
  if (!bundlePath) {
    console.error("Usage: node tools/import-concept-publication.mjs <bundle.json>");
    process.exit(1);
  }
  try {
    const result = importPublicationBundle(bundlePath);
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
