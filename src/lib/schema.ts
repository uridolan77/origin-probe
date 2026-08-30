import { z } from "zod";

export const EvidenceRoleSchema = z.enum([
  "EARLIEST_VERIFIED_OCCURRENCE",
  "CLAIMED_COINAGE",
  "POPULARIZED_BY",
  "MISATTRIBUTED_TO",
  "ANTECEDENT",
  "CONTESTED_INCOMPLETE",
]);

export type EvidenceRole = z.infer<typeof EvidenceRoleSchema>;

export const SupportKindSchema = z.enum([
  "direct",
  "supporting",
  "contested",
  "incomplete",
]);

export type SupportKind = z.infer<typeof SupportKindSchema>;

export const SourceTypeSchema = z.enum(["primary", "secondary"]);

export type SourceType = z.infer<typeof SourceTypeSchema>;

export const GenealogyStatusSchema = z.enum([
  "draft",
  "reviewed",
  "provisional",
  "superseded",
  "withdrawn",
]);

export type GenealogyStatus = z.infer<typeof GenealogyStatusSchema>;

export const CorrectionHistoryEntrySchema = z.object({
  at: z.string().min(1),
  summary: z.string().min(1),
  fromRevision: z.number().int().nonnegative().optional(),
  toRevision: z.number().int().nonnegative().optional(),
});

export type CorrectionHistoryEntry = z.infer<typeof CorrectionHistoryEntrySchema>;

export const AssertionSchema = z.object({
  assertionId: z.string().min(1),
  evidenceRole: EvidenceRoleSchema,
  subject: z.string().min(1),
  publicStatement: z.string().min(1),
  evidenceIds: z.array(z.string().min(1)).min(1),
  supportKind: SupportKindSchema,
  caveat: z.string().min(1).optional(),
});

export type Assertion = z.infer<typeof AssertionSchema>;

export const SourceSchema = z
  .object({
    sourceId: z.string().min(1),
    title: z.string().min(1),
    author: z.string().min(1),
    publisher: z.string().min(1),
    publicationDate: z.string().min(1),
    sourceType: SourceTypeSchema,
    url: z.string().url(),
    archiveUrl: z.string().url().optional(),
    accessedAt: z.string().min(1),
    supportsAssertionIds: z.array(z.string().min(1)).min(1),
    shortExcerpt: z.string().max(280).optional(),
  })
  .strict();

export type Source = z.infer<typeof SourceSchema>;

export const GenealogySchema = z
  .object({
    genealogyId: z.string().min(1),
    slug: z
      .string()
      .min(1)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    phrase: z.string().min(1),
    aliases: z.array(z.string()),
    revision: z.number().int().positive(),
    reviewedAt: z.string().min(1),
    status: GenealogyStatusSchema,
    finding: z.string().min(1),
    searchScope: z.string().min(1),
    evidenceReviewed: z.string().min(1),
    sourceSetHash: z.string().regex(/^sha256:[0-9a-f]{16}$/),
    supersedesRevision: z.number().int().positive().nullable(),
    correctionHistory: z.array(CorrectionHistoryEntrySchema),
    assertions: z.array(AssertionSchema).min(1),
    sources: z.array(SourceSchema).min(1),
  })
  .strict();

export type Genealogy = z.infer<typeof GenealogySchema>;
