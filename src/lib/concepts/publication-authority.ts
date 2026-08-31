import fs from "node:fs";
import path from "node:path";
import { createPublicKey, verify } from "node:crypto";

export type PublicationAuthority = {
  keyId: string;
  algorithm: "Ed25519";
  publicKeyBase64: string;
  purpose: string;
  repository: string;
  canonicalHost: string;
};

const AUTHORITY_PATH = path.join(
  process.cwd(),
  "data",
  "concepts",
  "publication-authority.public.json",
);

let cached: PublicationAuthority | null = null;

export function loadPublicationAuthority(): PublicationAuthority {
  if (cached) return cached;
  const raw = JSON.parse(fs.readFileSync(AUTHORITY_PATH, "utf8")) as PublicationAuthority;
  if (raw.algorithm !== "Ed25519") {
    throw new Error("Unsupported publication authority algorithm");
  }
  if (!raw.publicKeyBase64 || !raw.keyId) {
    throw new Error("Invalid publication authority file");
  }
  cached = raw;
  return cached;
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
  authority: PublicationAuthority = loadPublicationAuthority(),
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
