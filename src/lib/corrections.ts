import { z } from "zod";

export const CorrectionSubmissionSchema = z.object({
  phrase: z.string().trim().min(1).max(200),
  candidateSourceUrl: z.string().trim().url().max(2000),
  candidateSourceTitle: z.string().trim().min(1).max(300),
  candidatePublicationDate: z.string().trim().min(1).max(40),
  notes: z.string().trim().min(1).max(2000),
  submitter: z.string().trim().max(200).optional(),
});

export type CorrectionSubmission = z.infer<typeof CorrectionSubmissionSchema>;

export type CorrectionStoreResult =
  | { ok: true; id: string }
  | { ok: false; errors: string[] };

const STORE_KEY = "origin_corrections_v1";

export type StoredCorrection = CorrectionSubmission & {
  id: string;
  storedAt: string;
};

/**
 * Mock local submission adapter. Validates structured fields and stores locally.
 * Callers must never render user-supplied fields as HTML.
 */
export function submitCorrection(input: unknown): CorrectionStoreResult {
  const parsed = CorrectionSubmissionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join(".") || "form"}: ${i.message}`),
    };
  }

  const record: StoredCorrection = {
    ...parsed.data,
    id: `corr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    storedAt: new Date().toISOString(),
  };

  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const prev = window.localStorage.getItem(STORE_KEY);
      const list: StoredCorrection[] = prev ? (JSON.parse(prev) as StoredCorrection[]) : [];
      list.push(record);
      window.localStorage.setItem(STORE_KEY, JSON.stringify(list));
    } catch {
      return { ok: false, errors: ["Could not store correction locally."] };
    }
  }

  return { ok: true, id: record.id };
}

/** Plain-text safe read for diagnostics; never treat as HTML. */
export function listStoredCorrections(): StoredCorrection[] {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    const prev = window.localStorage.getItem(STORE_KEY);
    if (!prev) return [];
    return JSON.parse(prev) as StoredCorrection[];
  } catch {
    return [];
  }
}
