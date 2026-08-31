import { describe, expect, it } from "vitest";
// @ts-expect-error shared provenance helper
import { collectIndexProvenanceErrors } from "../../tools/index-provenance.mjs";

function mapsFrom(assertions: Array<Record<string, unknown>>, sources: Array<Record<string, unknown>>) {
  const assertionById = new Map(assertions.map((a) => [a.assertionId as string, a]));
  const sourceById = new Map(sources.map((s) => [s.sourceId as string, s]));
  return { assertionById, sourceById };
}

const primary = {
  sourceId: "src-1",
  sourceType: "primary",
};

const secondary = {
  sourceId: "src-2",
  sourceType: "secondary",
};

describe("index provenance verdict binding", () => {
  it("rejects direct_coinage bound to incomplete CLAIMED_COINAGE", () => {
    const assertions = [
      {
        assertionId: "a-earliest",
        evidenceRole: "EARLIEST_VERIFIED_OCCURRENCE",
        subject: "Ada Lovelace",
        publicStatement: "Verified Ada Lovelace occurrence.",
        supportKind: "direct",
        evidenceIds: ["src-1"],
      },
      {
        assertionId: "a-coinage",
        evidenceRole: "CLAIMED_COINAGE",
        subject: "Ada Lovelace",
        publicStatement: "Claimed coinage by Ada Lovelace.",
        supportKind: "incomplete",
        evidenceIds: ["src-2"],
      },
    ];
    const { assertionById, sourceById } = mapsFrom(assertions, [primary, secondary]);
    const errors = collectIndexProvenanceErrors(
      {
        status: "provisional",
        assertions,
        index: {
          earliest: { assertionId: "a-earliest", date: { startYear: 1900 } },
          shortFinding: "x",
          verdict: "direct_coinage",
          verdictAssertionId: "a-coinage",
        },
      },
      assertionById,
      sourceById,
    );
    expect(errors.some((e: string) => e.includes("supportKind direct"))).toBe(true);
  });

  it("accepts claimed_coinage with direct support strength", () => {
    const assertions = [
      {
        assertionId: "a-earliest",
        evidenceRole: "EARLIEST_VERIFIED_OCCURRENCE",
        subject: "Ada Lovelace",
        publicStatement: "Verified Ada Lovelace occurrence.",
        supportKind: "direct",
        evidenceIds: ["src-1"],
        caveat: "Earlier use reported but not inspected.",
      },
      {
        assertionId: "a-coinage",
        evidenceRole: "CLAIMED_COINAGE",
        subject: "Ada Lovelace",
        publicStatement: "Commonly credited to Ada Lovelace.",
        supportKind: "direct",
        evidenceIds: ["src-1"],
      },
    ];
    const { assertionById, sourceById } = mapsFrom(assertions, [primary]);
    const errors = collectIndexProvenanceErrors(
      {
        status: "provisional",
        assertions,
        index: {
          earliest: { assertionId: "a-earliest", date: { startYear: 1900 } },
          shortFinding: "x",
          verdict: "claimed_coinage",
          verdictAssertionId: "a-coinage",
        },
      },
      assertionById,
      sourceById,
    );
    expect(errors).toEqual([]);
  });

  it("rejects direct_coinage when earliest has unresolved earlier-use caveat", () => {
    const assertions = [
      {
        assertionId: "a-earliest",
        evidenceRole: "EARLIEST_VERIFIED_OCCURRENCE",
        subject: "Ada Lovelace",
        publicStatement: "Verified Ada Lovelace occurrence.",
        supportKind: "direct",
        evidenceIds: ["src-1"],
        caveat: "Earlier 2009 use reported but not inspected.",
      },
      {
        assertionId: "a-coinage",
        evidenceRole: "CLAIMED_COINAGE",
        subject: "Ada Lovelace",
        publicStatement: "Commonly credited to Ada Lovelace.",
        supportKind: "direct",
        evidenceIds: ["src-1"],
      },
    ];
    const { assertionById, sourceById } = mapsFrom(assertions, [primary]);
    const errors = collectIndexProvenanceErrors(
      {
        status: "provisional",
        assertions,
        index: {
          earliest: { assertionId: "a-earliest", date: { startYear: 1900 } },
          shortFinding: "x",
          verdict: "direct_coinage",
          verdictAssertionId: "a-coinage",
        },
      },
      assertionById,
      sourceById,
    );
    expect(errors.some((e: string) => e.includes("unresolved earlier-use caveat"))).toBe(true);
  });

  it("rejects popularized bound to incomplete POPULARIZED_BY", () => {
    const assertions = [
      {
        assertionId: "a-earliest",
        evidenceRole: "EARLIEST_VERIFIED_OCCURRENCE",
        subject: "Ada Lovelace",
        publicStatement: "Verified Ada Lovelace occurrence.",
        supportKind: "direct",
        evidenceIds: ["src-1"],
      },
      {
        assertionId: "a-pop",
        evidenceRole: "POPULARIZED_BY",
        subject: "Later press",
        publicStatement: "Popularized later.",
        supportKind: "incomplete",
        evidenceIds: ["src-2"],
      },
    ];
    const { assertionById, sourceById } = mapsFrom(assertions, [primary, secondary]);
    const errors = collectIndexProvenanceErrors(
      {
        status: "provisional",
        assertions,
        index: {
          earliest: { assertionId: "a-earliest", date: { startYear: 1900 } },
          shortFinding: "x",
          verdict: "popularized",
          verdictAssertionId: "a-pop",
        },
      },
      assertionById,
      sourceById,
    );
    expect(errors.some((e: string) => e.includes("incomplete"))).toBe(true);
  });

  it("rejects misattributed bound to wrong role", () => {
    const assertions = [
      {
        assertionId: "a-earliest",
        evidenceRole: "EARLIEST_VERIFIED_OCCURRENCE",
        subject: "Ada Lovelace",
        publicStatement: "Verified Ada Lovelace occurrence.",
        supportKind: "direct",
        evidenceIds: ["src-1"],
      },
      {
        assertionId: "a-pop",
        evidenceRole: "POPULARIZED_BY",
        subject: "Later press",
        publicStatement: "Popularized later.",
        supportKind: "supporting",
        evidenceIds: ["src-2"],
      },
    ];
    const { assertionById, sourceById } = mapsFrom(assertions, [primary, secondary]);
    const errors = collectIndexProvenanceErrors(
      {
        status: "provisional",
        assertions,
        index: {
          earliest: { assertionId: "a-earliest", date: { startYear: 1900 } },
          shortFinding: "x",
          verdict: "misattributed",
          verdictAssertionId: "a-pop",
        },
      },
      assertionById,
      sourceById,
    );
    expect(errors.some((e: string) => e.includes("MISATTRIBUTED_TO"))).toBe(true);
  });

  it("rejects earliest bound to POPULARIZED_BY", () => {
    const assertions = [
      {
        assertionId: "a-pop",
        evidenceRole: "POPULARIZED_BY",
        subject: "Later press",
        publicStatement: "Popularized later.",
        supportKind: "supporting",
        evidenceIds: ["src-2"],
      },
      {
        assertionId: "a-mis",
        evidenceRole: "MISATTRIBUTED_TO",
        subject: "Wrong person",
        publicStatement: "Misattributed.",
        supportKind: "supporting",
        evidenceIds: ["src-2"],
      },
    ];
    const { assertionById, sourceById } = mapsFrom(assertions, [secondary]);
    const errors = collectIndexProvenanceErrors(
      {
        status: "provisional",
        assertions,
        index: {
          earliest: { assertionId: "a-pop", date: { startYear: 1980 } },
          shortFinding: "x",
          verdict: "misattributed",
          verdictAssertionId: "a-mis",
        },
      },
      assertionById,
      sourceById,
    );
    expect(errors.some((e: string) => e.includes("disallowed role"))).toBe(true);
  });

  it("accepts earliest bound to EARLIEST_REPORTED_OCCURRENCE", () => {
    const assertions = [
      {
        assertionId: "a-reported",
        evidenceRole: "EARLIEST_REPORTED_OCCURRENCE",
        subject: "1974 trail",
        publicStatement: "Reported in secondary dossier.",
        supportKind: "incomplete",
        evidenceIds: ["src-2"],
      },
      {
        assertionId: "a-mis",
        evidenceRole: "MISATTRIBUTED_TO",
        subject: "Wrong person",
        publicStatement: "Misattributed.",
        supportKind: "supporting",
        evidenceIds: ["src-2"],
      },
    ];
    const { assertionById, sourceById } = mapsFrom(assertions, [secondary]);
    const errors = collectIndexProvenanceErrors(
      {
        status: "provisional",
        assertions,
        index: {
          earliest: { assertionId: "a-reported", date: { startYear: 1974 } },
          shortFinding: "x",
          verdict: "misattributed",
          verdictAssertionId: "a-mis",
        },
      },
      assertionById,
      sourceById,
    );
    expect(errors).toEqual([]);
  });

  it("accepts valid direct_coinage with matching primary EVO and no caveat", () => {
    const assertions = [
      {
        assertionId: "a-earliest",
        evidenceRole: "EARLIEST_VERIFIED_OCCURRENCE",
        subject: "Understanding Media (1964)",
        publicStatement: "Verified Marshall McLuhan occurrence in Understanding Media.",
        supportKind: "direct",
        evidenceIds: ["src-1"],
      },
      {
        assertionId: "a-coinage",
        evidenceRole: "CLAIMED_COINAGE",
        subject: "Marshall McLuhan",
        publicStatement: "Commonly credited to Marshall McLuhan.",
        supportKind: "direct",
        evidenceIds: ["src-1"],
      },
    ];
    const { assertionById, sourceById } = mapsFrom(assertions, [primary]);
    const errors = collectIndexProvenanceErrors(
      {
        status: "provisional",
        assertions,
        index: {
          earliest: { assertionId: "a-earliest", date: { startYear: 1964 } },
          shortFinding: "x",
          verdict: "direct_coinage",
          verdictAssertionId: "a-coinage",
        },
      },
      assertionById,
      sourceById,
    );
    expect(errors).toEqual([]);
  });
});
