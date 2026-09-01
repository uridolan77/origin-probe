import { createHash } from "node:crypto";
import type {
  ConceptPublicRole,
  PublicationProjectionPlan,
  PublishedConceptAssertion,
  PublishedConceptGenealogy,
  PublishedConceptSource,
} from "./schema";

/** Pinned public-finding template; membrane rejects unknown versions. */
export const FINDING_TEMPLATE_VERSION = 1 as const;

export type FindingProjectionInput = {
  templateVersion: typeof FINDING_TEMPLATE_VERSION;
  searchScope: string;
  slot: ConceptPublicRole;
  disposition: "unique" | "contested";
  selectedAssertionIds: readonly string[];
  assertions: readonly PublishedConceptAssertion[];
  sources: readonly PublishedConceptSource[];
};

function sourceCitations(
  assertion: PublishedConceptAssertion,
  sources: readonly PublishedConceptSource[],
): string {
  const byId = new Map(sources.map((s) => [s.sourceId, s]));
  return assertion.sourceIds
    .map((id) => byId.get(id)?.citation)
    .filter((c): c is string => Boolean(c))
    .join("; ");
}

function sha256Hex(buf: Buffer | string): string {
  return createHash("sha256").update(buf).digest("hex");
}

/**
 * Deterministic public finding from selected accepted assertions and pinned fragments.
 * Every sentence is attributable to a selected assertion or fixed template text.
 */
export function regeneratePublicFinding(input: FindingProjectionInput): string {
  if (input.templateVersion !== FINDING_TEMPLATE_VERSION) {
    throw new Error(`Unsupported finding template version: ${input.templateVersion}`);
  }

  const byId = new Map(input.assertions.map((a) => [a.assertionId, a]));
  const selected = input.selectedAssertionIds.map((id) => {
    const a = byId.get(id);
    if (!a) throw new Error(`Selected assertion ${id} missing from dossier`);
    return a;
  });

  const scopePrefix = `Within ${input.searchScope}, `;

  if (input.disposition === "contested") {
    const lines = selected.map((a) => {
      const temporal = a.temporal?.display ?? "undated";
      const sources = sourceCitations(a, input.sources);
      return `- ${a.claim} (${temporal}; ${sources})`;
    });
    return `${scopePrefix}the earliest accepted formulation for ${input.slot} is contested among:\n${lines.join("\n")}`;
  }

  const winner = selected[0]!;
  const temporal = winner.temporal?.display ?? "undated";
  const sources = sourceCitations(winner, input.sources);
  return `${scopePrefix}the earliest accepted formulation for ${input.slot} is attested as follows: ${winner.claim} (${temporal}; ${sources}).`;
}

/**
 * Unconditional public-finding check for every published dossier.
 * Finding bytes and projection digest must match regeneration from the
 * governing verified plan's selected accepted assertions.
 */
export function verifyFindingProjection(
  dossier: PublishedConceptGenealogy,
  plan: PublicationProjectionPlan,
): void {
  if (plan.templateVersion !== FINDING_TEMPLATE_VERSION) {
    throw new Error(`Unsupported finding template version: ${plan.templateVersion}`);
  }
  const regenerated = regeneratePublicFinding({
    templateVersion: FINDING_TEMPLATE_VERSION,
    searchScope: dossier.searchScope,
    slot: plan.slot,
    disposition: plan.disposition,
    selectedAssertionIds: plan.selectedAssertionIds,
    assertions: dossier.assertions,
    sources: dossier.sources,
  });
  if (dossier.finding !== regenerated) {
    throw new Error(
      "Public finding is not a deterministic projection of selected assertions",
    );
  }
  const findingDigest = sha256Hex(regenerated);
  if (plan.projectionTextDigest !== findingDigest) {
    throw new Error("Projection text digest mismatch");
  }
}
