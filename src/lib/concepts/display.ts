import type { ConceptObjectKind, ResearchMaturity } from "./schema";

export const MATURITY_DISPLAY: Record<
  ResearchMaturity,
  { label: string; shortLabel: string; tone: "neutral" | "info" | "warn" | "ok" }
> = {
  research_queue: {
    label: "Research queued",
    shortLabel: "Queued",
    tone: "neutral",
  },
  source_leads_mapped: {
    label: "Source leads mapped",
    shortLabel: "Leads mapped",
    tone: "info",
  },
  partially_verified: {
    label: "Sources inspected — no public finding yet",
    shortLabel: "Inspected",
    tone: "warn",
  },
  published: {
    label: "Published genealogy",
    shortLabel: "Published",
    tone: "ok",
  },
};

export const OBJECT_KIND_DISPLAY: Record<ConceptObjectKind, string> = {
  argument: "Argument",
  case_family: "Case family",
  distinction: "Distinction",
  doctrine: "Doctrine",
  framework: "Framework",
  lexeme_concept: "Lexeme / concept",
  method: "Method",
  paradox: "Paradox",
  principle: "Principle",
  problem_family: "Problem family",
  reception_formula: "Reception formula",
  theory: "Theory",
  thought_experiment: "Thought experiment",
};

export const PUBLIC_ROLE_DISPLAY: Record<
  string,
  { heading: string; order: number }
> = {
  lexical_history: { heading: "Lexical history", order: 1 },
  conceptual_antecedent: { heading: "Conceptual antecedents", order: 2 },
  earliest_accepted_formulation: {
    heading: "Earliest accepted formulation",
    order: 3,
  },
  technical_use_or_naming: { heading: "Technical use or naming", order: 4 },
  canonical_systematization: {
    heading: "Canonical systematization",
    order: 5,
  },
  transmission_and_translation: {
    heading: "Transmission and translation",
    order: 6,
  },
  semantic_change: { heading: "Semantic change", order: 7 },
  reception_and_popularization: {
    heading: "Reception and popularization",
    order: 8,
  },
  contested_or_unresolved: {
    heading: "Contested or unresolved points",
    order: 9,
  },
};
