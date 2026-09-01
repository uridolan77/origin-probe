import { z } from "zod";
import { isProductConceptId } from "./concept-ids";

export const ConceptObjectKindSchema = z.enum([
  "argument",
  "case_family",
  "distinction",
  "doctrine",
  "framework",
  "lexeme_concept",
  "method",
  "paradox",
  "principle",
  "problem_family",
  "reception_formula",
  "theory",
  "thought_experiment",
]);

export type ConceptObjectKind = z.infer<typeof ConceptObjectKindSchema>;

export const ResearchMaturitySchema = z.enum([
  "research_queue",
  "source_leads_mapped",
  "partially_verified",
  "published",
]);

export type ResearchMaturity = z.infer<typeof ResearchMaturitySchema>;

export const ConceptIdSchema = z
  .string()
  .refine((id) => isProductConceptId(id), {
    message: "conceptId must be in the exact set C001–C100",
  });

export const SlugSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const Sha256HexSchema = z.string().regex(/^[a-f0-9]{64}$/);

export const ConceptCatalogItemSchema = z
  .object({
    conceptId: ConceptIdSchema,
    slug: SlugSchema,
    label: z.string().min(1),
    aliases: z.array(z.string()),
    objectKind: ConceptObjectKindSchema,
    domains: z.array(z.string().min(1)).min(1),
    researchMaturity: ResearchMaturitySchema,
    publicFindingAvailable: z.boolean(),
    openTaskCount: z.number().int().nonnegative(),
    sourceLeadCount: z.number().int().nonnegative(),
    evidenceLeadCount: z.number().int().nonnegative(),
    acceptedAssertionCount: z.number().int().nonnegative(),
    publicationSlug: SlugSchema.nullable(),
    sourcePackageId: z.string().min(1),
    sourceRecordDigest: Sha256HexSchema,
  })
  .strict()
  .superRefine((item, ctx) => {
    if (item.researchMaturity === "published") {
      if (!item.publicFindingAvailable || !item.publicationSlug) {
        ctx.addIssue({
          code: "custom",
          message: "published maturity requires publicFindingAvailable and publicationSlug",
        });
      }
    } else if (item.publicFindingAvailable || item.publicationSlug) {
      ctx.addIssue({
        code: "custom",
        message: "non-published catalog items must not advertise a public finding",
      });
    }
  });

export type ConceptCatalogItem = z.infer<typeof ConceptCatalogItemSchema>;

export const ConceptCatalogFileSchema = z
  .object({
    schemaVersion: z.literal(1),
    sourcePackageId: z.string().min(1),
    sourceArtifactDigest: Sha256HexSchema,
    generatedFrom: z.object({
      artifactDigest: Sha256HexSchema,
      corpusAuditDigest: Sha256HexSchema,
      c092PilotDigest: Sha256HexSchema.nullable(),
    }),
    items: z.array(ConceptCatalogItemSchema).length(100),
  })
  .strict();

export type ConceptCatalogFile = z.infer<typeof ConceptCatalogFileSchema>;

export const ConceptPublicRoleSchema = z.enum([
  "lexical_history",
  "conceptual_antecedent",
  "earliest_accepted_formulation",
  "technical_use_or_naming",
  "canonical_systematization",
  "transmission_and_translation",
  "semantic_change",
  "reception_and_popularization",
  "contested_or_unresolved",
]);

export type ConceptPublicRole = z.infer<typeof ConceptPublicRoleSchema>;

export const PublishedConceptAssertionSchema = z
  .object({
    assertionId: z.string().min(1),
    role: ConceptPublicRoleSchema,
    claim: z.string().min(1),
    acceptedReviewEventIds: z.array(z.string().min(1)).min(1),
    evidenceIds: z.array(z.string().min(1)).min(1),
    sourceIds: z.array(z.string().min(1)).min(1),
    temporal: z
      .object({
        display: z.string().min(1),
        startYear: z.number().int().optional(),
        endYear: z.number().int().optional(),
        precision: z
          .enum(["exact", "year", "circa", "decade", "century", "range"])
          .optional(),
      })
      .strict()
      .optional(),
    caveat: z.string().min(1).optional(),
  })
  .strict();

export type PublishedConceptAssertion = z.infer<
  typeof PublishedConceptAssertionSchema
>;

export const PublishedConceptSourceSchema = z
  .object({
    sourceId: z.string().min(1),
    citation: z.string().min(1),
    url: z.string().url().optional(),
    publicationDate: z.string().min(1).optional(),
  })
  .strict();

export type PublishedConceptSource = z.infer<typeof PublishedConceptSourceSchema>;

export const PublishedProjectionSchema = z
  .object({
    slot: ConceptPublicRoleSchema,
    assertionIds: z.array(z.string().min(1)).min(1),
  })
  .strict();

export type PublishedProjection = z.infer<typeof PublishedProjectionSchema>;

export const PublicationReceiptSchema = z
  .object({
    packageId: z.string().min(1),
    workspaceDigest: Sha256HexSchema,
    requestDigest: Sha256HexSchema,
    planDigest: Sha256HexSchema,
    roleRegistryDigest: Sha256HexSchema,
    policyRegistryDigest: Sha256HexSchema,
    authorizationId: z.string().min(1),
    authorizedBy: z.string().min(1),
    authorizedAt: z.string().datetime({ offset: true }),
    authorityKeyId: z.string().min(1),
    signature: z.string().min(1),
  })
  .strict();

export type PublicationReceipt = z.infer<typeof PublicationReceiptSchema>;

export const PublishedConceptGenealogySchema = z
  .object({
    conceptId: ConceptIdSchema,
    slug: SlugSchema,
    label: z.string().min(1),
    aliases: z.array(z.string()),
    objectKind: ConceptObjectKindSchema,
    definitionScope: z.string().min(1),
    revision: z.number().int().positive(),
    publishedAt: z.string().datetime({ offset: true }),
    reviewedAt: z.string().datetime({ offset: true }),
    status: z.enum(["published", "superseded", "withdrawn"]),
    supersedesDossierDigest: Sha256HexSchema.optional(),
    finding: z.string().min(1),
    projectionSlots: z.array(PublishedProjectionSchema),
    assertions: z.array(PublishedConceptAssertionSchema).min(1),
    sources: z.array(PublishedConceptSourceSchema).min(1),
    searchScope: z.string().min(1),
    limitations: z.array(z.string()),
    publicationReceipt: PublicationReceiptSchema,
  })
  .strict();

export type PublishedConceptGenealogy = z.infer<
  typeof PublishedConceptGenealogySchema
>;

export const NormalizedIntervalSchema = z
  .object({
    assertionId: z.string().min(1),
    startYear: z.number().int(),
    endYear: z.number().int().optional(),
    precision: z
      .enum(["exact", "year", "circa", "decade", "century", "range"])
      .optional(),
  })
  .strict();

export type NormalizedInterval = z.infer<typeof NormalizedIntervalSchema>;

export const PublicationProjectionPlanSchema = z
  .object({
    conceptId: ConceptIdSchema,
    slug: SlugSchema,
    slot: ConceptPublicRoleSchema,
    templateVersion: z.literal(1),
    eligibleAssertionIds: z.array(z.string().min(1)).min(1),
    normalizedIntervals: z.array(NormalizedIntervalSchema).min(1),
    searchScopeId: z.string().min(1),
    searchScopeDigest: Sha256HexSchema,
    selectedAssertionIds: z.array(z.string().min(1)).min(1),
    disposition: z.enum(["unique", "contested"]),
    projectionTextDigest: Sha256HexSchema,
  })
  .strict();

export type PublicationProjectionPlan = z.infer<
  typeof PublicationProjectionPlanSchema
>;

export const AuthorizationEnvelopeSchema = z
  .object({
    authorizationId: z.string().min(1),
    authorizedBy: z.string().min(1),
    authorizedAt: z.string().datetime({ offset: true }),
    workspaceDigest: Sha256HexSchema,
    requestDigest: Sha256HexSchema,
    planDigest: Sha256HexSchema,
    authorityKeyId: z.string().min(1),
    signature: z.string().min(1),
  })
  .strict();

export type AuthorizationEnvelope = z.infer<typeof AuthorizationEnvelopeSchema>;

export const ReviewedWorkspaceSchema = z
  .object({
    workspaceKind: z.literal("origin_reviewed_workspace_v1"),
    conceptId: ConceptIdSchema,
    slug: SlugSchema,
    acceptedAssertionIds: z.array(z.string().min(1)).min(1),
    reviewEventIds: z.array(z.string().min(1)).min(1),
    reviewedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export type ReviewedWorkspace = z.infer<typeof ReviewedWorkspaceSchema>;

export const PublicationRequestSchema = z
  .object({
    requestKind: z.literal("origin_publication_request_v1"),
    requestId: z.string().min(1),
    conceptId: ConceptIdSchema,
    slug: SlugSchema,
    revision: z.number().int().positive(),
    requestedSlots: z.array(ConceptPublicRoleSchema).min(1),
    requestedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export type PublicationRequest = z.infer<typeof PublicationRequestSchema>;

export const UpstreamArtifactsSchema = z
  .object({
    conceptId: ConceptIdSchema,
    slug: SlugSchema,
    reviewedWorkspace: ReviewedWorkspaceSchema,
    publicationRequest: PublicationRequestSchema,
    derivedPlan: PublicationProjectionPlanSchema,
  })
  .strict();

export type UpstreamArtifacts = z.infer<typeof UpstreamArtifactsSchema>;

export const SITE_PUBLICATION_PACKAGE_KIND =
  "origin_site_concept_publication_v1" as const;

export const ConceptPublicationBundleSchema = z
  .object({
    packageKind: z.literal(SITE_PUBLICATION_PACKAGE_KIND),
    packageVersion: z.literal(1),
    repository: z.literal("uridolan77/origin-probe"),
    canonicalHost: z.string().min(1),
    generatedAt: z.string().datetime({ offset: true }),
    expiresAt: z.string().datetime({ offset: true }).optional(),
    revoked: z.boolean().optional(),
    signerKeyId: z.string().min(1),
    sourceCandidatePackageDigest: Sha256HexSchema,
    roleRegistryDigest: Sha256HexSchema,
    policyRegistryDigest: Sha256HexSchema,
    authorizationEnvelope: AuthorizationEnvelopeSchema,
    upstreamArtifacts: z.array(UpstreamArtifactsSchema).min(1),
    projectionPlans: z.array(PublicationProjectionPlanSchema).min(1),
    dossierDigests: z.array(
      z
        .object({
          conceptId: ConceptIdSchema,
          slug: SlugSchema,
          digest: Sha256HexSchema,
        })
        .strict(),
    ),
    dossiers: z.array(PublishedConceptGenealogySchema).min(1),
    signature: z.string().min(1),
  })
  .strict();

export type ConceptPublicationBundle = z.infer<
  typeof ConceptPublicationBundleSchema
>;

export const PublicationAuthoritySchema = z
  .object({
    keyId: z.string().min(1),
    algorithm: z.literal("Ed25519"),
    publicKeyBase64: z.string().min(1),
    purpose: z.string().min(1),
    repository: z.literal("uridolan77/origin-probe"),
    canonicalHost: z.string().min(1),
    expiresAt: z.string().datetime({ offset: true }).optional(),
    revoked: z.boolean().optional(),
    fingerprintSha256: Sha256HexSchema.optional(),
  })
  .strict();

export type PublicationAuthority = z.infer<typeof PublicationAuthoritySchema>;

export const PinnedPublicationPolicySchema = z
  .object({
    schemaVersion: z.literal(1),
    sourceCandidatePackageDigest: Sha256HexSchema,
    roleRegistryDigest: Sha256HexSchema,
    policyRegistryDigest: Sha256HexSchema,
    authorityFingerprintSha256: Sha256HexSchema,
  })
  .strict();

export type PinnedPublicationPolicy = z.infer<
  typeof PinnedPublicationPolicySchema
>;

export const AuthorityRotationEnvelopeSchema = z
  .object({
    envelopeKind: z.literal("origin_publication_authority_rotation_v1"),
    fromFingerprintSha256: Sha256HexSchema,
    toFingerprintSha256: Sha256HexSchema,
    toKeyId: z.string().min(1),
    authorizedAt: z.string().datetime({ offset: true }),
    rootKeyId: z.string().min(1),
    signature: z.string().min(1),
  })
  .strict();

export type AuthorityRotationEnvelope = z.infer<
  typeof AuthorityRotationEnvelopeSchema
>;

export const CatalogReceiptSchema = z
  .object({
    receiptKind: z.literal("origin_concept_catalog_receipt_v1"),
    sourcePackageId: z.string().min(1),
    sourceArtifactDigest: Sha256HexSchema,
    corpusAuditDigest: Sha256HexSchema,
    c092PilotDigest: Sha256HexSchema.nullable(),
    catalogDigest: Sha256HexSchema,
    catalogCount: z.literal(100),
    acceptedAssertionCount: z.number().int().nonnegative(),
    publishedDossierCount: z.number().int().nonnegative(),
    c092Maturity: z.literal("partially_verified"),
    transformationBoundary: z.string().min(1),
  })
  .strict();

export type CatalogReceipt = z.infer<typeof CatalogReceiptSchema>;

/** Fields that must never appear on a public catalog item. */
export const FORBIDDEN_CATALOG_CLAIM_KEYS = [
  "claim",
  "finding",
  "assertions",
  "earliest",
  "originator",
  "timeline",
  "candidateView",
  "legacyCandidate",
] as const;

/** Priority slots that require chronological derivation plans. */
export const PRIORITY_PROJECTION_SLOTS = [
  "earliest_accepted_formulation",
] as const satisfies readonly ConceptPublicRole[];
