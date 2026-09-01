import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import { cleanup, render, screen } from "@testing-library/react";
import { ConceptUnpublishedView, ConceptPublishedView } from "@/components/ConceptDetail";
import {
  PublishedConceptGenealogySchema,
  type ConceptCatalogItem,
} from "@/lib/concepts/schema";

afterEach(() => cleanup());

const unpublished: ConceptCatalogItem = {
  conceptId: "C092",
  slug: "trolley-problem",
  label: "Trolley problem",
  aliases: [],
  objectKind: "case_family",
  domains: ["Contemporary justice, identity, and mind"],
  researchMaturity: "partially_verified",
  publicFindingAvailable: false,
  openTaskCount: 19,
  sourceLeadCount: 2,
  evidenceLeadCount: 6,
  acceptedAssertionCount: 0,
  publicationSlug: null,
  sourcePackageId: "ORIGIN-CONCEPT-GENEALOGIES-100-CANDIDATE-005",
  sourceRecordDigest: "a".repeat(64),
};

describe("concept detail UI", () => {
  it("renders unpublished boundary copy without candidate claims", () => {
    render(<ConceptUnpublishedView item={unpublished} />);
    expect(screen.getByText("No public genealogy yet")).toBeTruthy();
    expect(screen.getByText(/claim-level publication gate/i)).toBeTruthy();
    expect(screen.queryByText(/Philippa Foot/i)).toBeNull();
  });

  it("renders published projection sections from schema-parsed dossier only", () => {
    const dossier = PublishedConceptGenealogySchema.parse(
      JSON.parse(
        fs.readFileSync("tests/fixtures/concepts/publication-bundle-valid.json", "utf8"),
      ).dossiers[0],
    );

    render(<ConceptPublishedView dossier={dossier} />);
    expect(screen.getAllByText(dossier.finding).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: /Earliest accepted formulation/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Sources and review scope/i })).toBeTruthy();
  });
});
