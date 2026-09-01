import fs from "node:fs";
import path from "node:path";
import { createHash, createPublicKey, verify } from "node:crypto";
import {
  PublicationAuthoritySchema,
  type PublicationAuthority,
} from "./schema";
import { CANONICAL_PUBLICATION_HOST } from "./canonical";

const AUTHORITY_PATH = path.join(
  process.cwd(),
  "data",
  "concepts",
  "publication-authority.public.json",
);

let cached: PublicationAuthority | null = null;

export function authorityFingerprintSha256(
  publicKeyBase64: string,
): string {
  return createHash("sha256")
    .update(Buffer.from(publicKeyBase64, "base64"))
    .digest("hex");
}

export function loadPublicationAuthority(
  repoRoot: string = process.cwd(),
): PublicationAuthority {
  if (cached && repoRoot === process.cwd()) return cached;
  const authorityPath = path.join(
    repoRoot,
    "data",
    "concepts",
    "publication-authority.public.json",
  );
  const raw: unknown = JSON.parse(fs.readFileSync(authorityPath, "utf8"));
  const parsed = PublicationAuthoritySchema.parse(raw);
  if (parsed.canonicalHost !== CANONICAL_PUBLICATION_HOST) {
    throw new Error("Publication authority canonicalHost mismatch");
  }
  if (parsed.revoked === true) {
    throw new Error("Publication authority revoked");
  }
  const fp = authorityFingerprintSha256(parsed.publicKeyBase64);
  if (parsed.fingerprintSha256 && parsed.fingerprintSha256 !== fp) {
    throw new Error("Publication authority fingerprint field mismatch");
  }
  const withFp = { ...parsed, fingerprintSha256: fp };
  if (repoRoot === process.cwd()) cached = withFp;
  return withFp;
}

export function clearPublicationAuthorityCache(): void {
  cached = null;
}

/**
 * Verify an Ed25519 signature over canonical UTF-8 payload bytes.
 * Signature is base64-encoded raw 64-byte signature.
 */
export function verifyPublicationSignature(
  payloadUtf8: string,
  signatureBase64: string,
  authority: PublicationAuthority,
): boolean {
  const key = createPublicKey({
    key: Buffer.from(authority.publicKeyBase64, "base64"),
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

export { AUTHORITY_PATH };
