#!/usr/bin/env node
/**
 * Proves coordinated in-repo authority/root substitution still fails against
 * external environment pins.
 *
 * Scope note: this harness keeps process-env pins fixed while mutating
 * repository authority/policy/root/pin files. It does not prove rejection of
 * coordinated workflow-YAML literal rewrites; that defense requires pins to
 * live in a GitHub Environment (vars/secrets) outside PR-controlled content.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { generateKeyPairSync } from "node:crypto";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function copyTree(tmp, rel) {
  const src = path.join(repoRoot, rel);
  const dest = path.join(tmp, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (fs.statSync(src).isDirectory()) {
    fs.cpSync(src, dest, { recursive: true });
  } else {
    fs.copyFileSync(src, dest);
  }
}

function prepareTempRepo() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "origin-substitution-"));
  for (const rel of [
    "data/concepts/publication-root.public.json",
    "data/concepts/pinned-publication-policy.json",
    "data/concepts/registries",
    "tools/pins",
    "tests/fixtures/concepts/publication-bundle-valid.json",
    "tests/fixtures/concepts/keys",
    "tests/fixtures/concepts/registries",
  ]) {
    copyTree(tmp, rel);
  }
  return tmp;
}

function runCheck(tmp, realAuthorityPin, realRootPin) {
  const checkScript = path.join(repoRoot, "tools/lib/coordinated-substitution-check.ts");
  return spawnSync("npx", ["tsx", checkScript, tmp], {
    cwd: repoRoot,
    env: {
      ...process.env,
      ORIGIN_REQUIRE_EXTERNAL_PINS: "1",
      ORIGIN_PUBLICATION_AUTHORITY_FINGERPRINT: realAuthorityPin,
      ORIGIN_PUBLICATION_ROOT_FINGERPRINT: realRootPin,
    },
    encoding: "utf8",
    shell: true,
  });
}

const realAuthorityPin = fs
  .readFileSync(path.join(repoRoot, "tools/pins/publication-authority.sha256"), "utf8")
  .trim();
const realRootPin = fs
  .readFileSync(path.join(repoRoot, "tools/pins/publication-root.sha256"), "utf8")
  .trim();

// Scenario 1: coordinated authority + policy + pin-file substitution
{
  const tmp = prepareTempRepo();
  const { publicKey } = generateKeyPairSync("ed25519");
  const pub = publicKey.export({ type: "spki", format: "der" });
  const substituted = {
    keyId: "origin-site-concept-publication-authority-v1",
    algorithm: "Ed25519",
    publicKeyBase64: pub.toString("base64"),
    purpose: "coordinated-substitution-test",
    repository: "uridolan77/origin-probe",
    canonicalHost: "origin.ontogony.net",
  };
  fs.writeFileSync(
    path.join(tmp, "data/concepts/publication-authority.public.json"),
    `${JSON.stringify(substituted, null, 2)}\n`,
  );

  const fakePin = "a".repeat(64);
  fs.writeFileSync(
    path.join(tmp, "tools/pins/publication-authority.sha256"),
    `${fakePin}\n`,
  );
  const policy = JSON.parse(
    fs.readFileSync(path.join(tmp, "data/concepts/pinned-publication-policy.json"), "utf8"),
  );
  policy.authorityFingerprintSha256 = fakePin;
  fs.writeFileSync(
    path.join(tmp, "data/concepts/pinned-publication-policy.json"),
    `${JSON.stringify(policy, null, 2)}\n`,
  );

  const local = runCheck(tmp, realAuthorityPin, realRootPin);
  if (local.status !== 0) {
    console.error(local.stdout);
    console.error(local.stderr);
    console.error(
      `expected coordinated authority substitution to fail under external pins; exit=${local.status}`,
    );
    process.exit(1);
  }
}

// Scenario 2: coordinated root document + root pin-file substitution
{
  const tmp = prepareTempRepo();
  // Keep a valid production-looking authority so the check reaches root pin logic.
  fs.copyFileSync(
    path.join(repoRoot, "data/concepts/publication-authority.public.json"),
    path.join(tmp, "data/concepts/publication-authority.public.json"),
  );

  const { publicKey } = generateKeyPairSync("ed25519");
  const pub = publicKey.export({ type: "spki", format: "der" });
  const fakeRootPin = "b".repeat(64);
  const fakeRoot = {
    keyId: "origin-site-concept-publication-root-v1",
    algorithm: "Ed25519",
    publicKeyBase64: pub.toString("base64"),
    purpose: "coordinated-root-substitution-test",
    fingerprintSha256: fakeRootPin,
  };
  fs.writeFileSync(
    path.join(tmp, "data/concepts/publication-root.public.json"),
    `${JSON.stringify(fakeRoot, null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(tmp, "tools/pins/publication-root.sha256"),
    `${fakeRootPin}\n`,
  );

  const local = runCheck(tmp, realAuthorityPin, realRootPin);
  if (local.status !== 0) {
    console.error(local.stdout);
    console.error(local.stderr);
    console.error(
      `expected coordinated root substitution to fail under external pins; exit=${local.status}`,
    );
    process.exit(1);
  }
}

console.log(
  JSON.stringify({
    ok: true,
    message:
      "Coordinated authority and root substitution rejected under external pins",
  }),
);
