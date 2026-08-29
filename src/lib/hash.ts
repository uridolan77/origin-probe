import { createHash } from "node:crypto";

export type SourceHashInput = {
  sourceId: string;
  url: string;
  publicationDate: string;
};

/**
 * Deterministic sourceSetHash from sorted source IDs + urls + publicationDates.
 * SHA-256 hex truncated to 16 characters, prefixed with `sha256:`.
 */
export function computeSourceSetHash(sources: SourceHashInput[]): string {
  const lines = [...sources]
    .map((s) => `${s.sourceId}\t${s.url}\t${s.publicationDate}`)
    .sort((a, b) => a.localeCompare(b));
  const digest = createHash("sha256").update(lines.join("\n"), "utf8").digest("hex");
  return `sha256:${digest.slice(0, 16)}`;
}
