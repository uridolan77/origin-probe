#!/usr/bin/env node
/**
 * Operator tool: encrypt Candidate 005 ZIPs into committed custody blobs.
 *
 * Usage:
 *   set CANDIDATE_005_CUSTODY_PASSPHRASE=...
 *   node tools/encrypt-custody-artifacts.mjs \
 *     --artifact-zip <path> --c092-zip <path>
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { encryptCustodyFile } from "./lib/custody-crypto.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXPECTED_ARTIFACT =
  "a2e463e0b134b4ed49ebb6cced8d0bf1afbb2dcf5780568d7e66ac31299d6814";
const EXPECTED_C092 =
  "74ace215ecc436399e5f57da0b4e1b4ad6d61672a3025a8e930ff679c5d209d0";

function cliFlag(name) {
  const i = process.argv.indexOf(name);
  if (i < 0 || i + 1 >= process.argv.length) return null;
  return process.argv[i + 1];
}

function sha256File(p) {
  return createHash("sha256").update(fs.readFileSync(p)).digest("hex");
}

const passphrase = process.env.CANDIDATE_005_CUSTODY_PASSPHRASE;
if (!passphrase) {
  console.error("Missing CANDIDATE_005_CUSTODY_PASSPHRASE");
  process.exit(1);
}

const artifactZip = cliFlag("--artifact-zip");
const c092Zip = cliFlag("--c092-zip");
if (!artifactZip || !c092Zip) {
  console.error(
    "usage: node tools/encrypt-custody-artifacts.mjs --artifact-zip <path> --c092-zip <path>",
  );
  process.exit(1);
}

const artifactDigest = sha256File(artifactZip);
const c092Digest = sha256File(c092Zip);
if (artifactDigest !== EXPECTED_ARTIFACT) {
  console.error(`Artifact digest mismatch: ${artifactDigest}`);
  process.exit(1);
}
if (c092Digest !== EXPECTED_C092) {
  console.error(`C092 digest mismatch: ${c092Digest}`);
  process.exit(1);
}

const outDir = path.join(repoRoot, "data/concepts/custody");
const artifactEnc = path.join(outDir, "candidate-005-artifact.zip.enc");
const c092Enc = path.join(outDir, "candidate-005-c092.zip.enc");
encryptCustodyFile(artifactZip, artifactEnc, passphrase);
encryptCustodyFile(c092Zip, c092Enc, passphrase);

console.log(
  JSON.stringify(
    {
      ok: true,
      artifactEnc: path.relative(repoRoot, artifactEnc).replace(/\\/g, "/"),
      c092Enc: path.relative(repoRoot, c092Enc).replace(/\\/g, "/"),
      artifactDigest,
      c092Digest,
    },
    null,
    2,
  ),
);
