#!/usr/bin/env node
/**
 * Decrypt committed Candidate 005 custody blobs and verify env-pinned digests.
 *
 * Usage:
 *   CANDIDATE_005_CUSTODY_PASSPHRASE=... \
 *   CANDIDATE_005_ARTIFACT_SHA256=... \
 *   CANDIDATE_005_C092_ZIP_SHA256=... \
 *   node tools/decrypt-custody-artifacts.mjs \
 *     --artifact-enc <path> --c092-enc <path> \
 *     --artifact-out <path> --c092-out <path>
 */
import fs from "node:fs";
import { createHash } from "node:crypto";
import { decryptCustodyFile } from "./lib/custody-crypto.mjs";

function cliFlag(name) {
  const i = process.argv.indexOf(name);
  if (i < 0 || i + 1 >= process.argv.length) return null;
  return process.argv[i + 1];
}

function sha256Buf(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

const passphrase = process.env.CANDIDATE_005_CUSTODY_PASSPHRASE;
const expectedArtifact = process.env.CANDIDATE_005_ARTIFACT_SHA256;
const expectedC092 = process.env.CANDIDATE_005_C092_ZIP_SHA256;

if (!passphrase) {
  console.error("Missing CANDIDATE_005_CUSTODY_PASSPHRASE");
  process.exit(1);
}
if (!expectedArtifact || !expectedC092) {
  console.error(
    "Missing CANDIDATE_005_ARTIFACT_SHA256 or CANDIDATE_005_C092_ZIP_SHA256",
  );
  process.exit(1);
}

const artifactEnc = cliFlag("--artifact-enc");
const c092Enc = cliFlag("--c092-enc");
const artifactOut = cliFlag("--artifact-out");
const c092Out = cliFlag("--c092-out");
if (!artifactEnc || !c092Enc || !artifactOut || !c092Out) {
  console.error(
    "usage: node tools/decrypt-custody-artifacts.mjs --artifact-enc <p> --c092-enc <p> --artifact-out <p> --c092-out <p>",
  );
  process.exit(1);
}

const artifactPlain = decryptCustodyFile(artifactEnc, artifactOut, passphrase);
const c092Plain = decryptCustodyFile(c092Enc, c092Out, passphrase);
const artifactDigest = sha256Buf(artifactPlain);
const c092Digest = sha256Buf(c092Plain);

if (artifactDigest !== expectedArtifact.toLowerCase()) {
  console.error(
    `Decrypted artifact digest mismatch: got ${artifactDigest}, expected ${expectedArtifact}`,
  );
  try {
    fs.unlinkSync(artifactOut);
  } catch {
    /* ignore */
  }
  process.exit(1);
}
if (c092Digest !== expectedC092.toLowerCase()) {
  console.error(
    `Decrypted C092 digest mismatch: got ${c092Digest}, expected ${expectedC092}`,
  );
  try {
    fs.unlinkSync(c092Out);
  } catch {
    /* ignore */
  }
  process.exit(1);
}

console.log(
  JSON.stringify({
    ok: true,
    artifactDigest,
    c092Digest,
    artifactOut,
    c092Out,
  }),
);
