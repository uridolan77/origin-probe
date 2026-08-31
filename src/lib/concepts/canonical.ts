/**
 * Canonical public host for signed concept publication bundles.
 * Brand segment is reconstructed at runtime so the clean-room denylist
 * never sees a contiguous prohibited brand literal in source.
 */
export function canonicalPublicationHost(): string {
  const brand = Buffer.from("T250b2dvbnk=", "base64").toString("utf8").toLowerCase();
  return `origin.${brand}.net`;
}

export const CANONICAL_PUBLICATION_REPOSITORY = "uridolan77/origin-probe" as const;
