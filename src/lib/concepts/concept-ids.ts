/** Exact product concept ID set C001–C100. */
export const EXPECTED_CONCEPT_IDS: readonly string[] = Object.freeze(
  Array.from({ length: 100 }, (_, i) => `C${String(i + 1).padStart(3, "0")}`),
);

export const EXPECTED_CONCEPT_ID_SET: ReadonlySet<string> = new Set(
  EXPECTED_CONCEPT_IDS,
);

const CONCEPT_ID_RE = /^C(?:00[1-9]|0[1-9]\d|100)$/;

export function isProductConceptId(id: string): boolean {
  return CONCEPT_ID_RE.test(id) && EXPECTED_CONCEPT_ID_SET.has(id);
}
