/**
 * Canonical public host for signed concept publication bundles.
 * Stored as a normal hostname; cleanroom allows only this exact public host
 * as a narrow exception to the brand denylist (see tools/cleanroom-scan.mjs).
 */
export const CANONICAL_PUBLICATION_HOST = "origin.ontogony.net" as const;

export function canonicalPublicationHost(): string {
  return CANONICAL_PUBLICATION_HOST;
}

export const CANONICAL_PUBLICATION_REPOSITORY = "uridolan77/origin-probe" as const;
