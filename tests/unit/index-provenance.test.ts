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
        supportKind: "direct",
        evidenceIds: ["src-1"],
      },
      {
        assertionId: "a-coinage",
        evidenceRole: "CLAIMED_COINAGE",
        supportKind: "incomplete",
        evidenceIds: ["src-2"],
      },
    ];
    const sources = [primary, secondary];
    const { assertionById, sourceById } = mapsFrom(assertions, sources);
    const errors = collectIndexProvenanceErrors(
      {
        status: "provisional",
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

  it("rejects claimed_coinage bound to direct CLAIMED_COINAGE", () => {
    const assertions = [
      {
        assertionId: "a-earliest",
        evidenceRole: "EARLIEST_VERIFIED_OCCURRENCE",
        supportKind: "direct",
        evidenceIds: ["src-1"],
      },
      {
        assertionId: "a-coinage",
        evidenceRole: "CLAIMED_COINAGE",
        supportKind: "direct",
        evidenceIds: ["src-1"],
      },
    ];
    const { assertionById, sourceById } = mapsFrom(assertions, [primary]);
    const errors = collectIndexProvenanceErrors(
      {
        status: "provisional",
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
    expect(errors.some((e: string) => e.includes("supporting|contested|incomplete"))).toBe(
      true,
    );
  });

  it("rejects popularized bound to incomplete POPULARIZED_BY", () => {
    const assertions = [
      {
        assertionId: "a-earliest",
        evidenceRole: "EARLIEST_VERIFIED_OCCURRENCE",
        supportKind: "direct",
        evidenceIds: ["src-1"],
      },
      {
        assertionId: "a-pop",
        evidenceRole: "POPULARIZED_BY",
        supportKind: "incomplete",
        evidenceIds: ["src-2"],
      },
    ];
    const { assertionById, sourceById } = mapsFrom(assertions, [primary, secondary]);
    const errors = collectIndexProvenanceErrors(
      {
        status: "provisional",
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
        supportKind: "direct",
        evidenceIds: ["src-1"],
      },
      {
        assertionId: "a-pop",
        evidenceRole: "POPULARIZED_BY",
        supportKind: "supporting",
        evidenceIds: ["src-2"],
      },
    ];
    const { assertionById, sourceById } = mapsFrom(assertions, [primary, secondary]);
    const errors = collectIndexProvenanceErrors(
      {
        status: "provisional",
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
        supportKind: "supporting",
        evidenceIds: ["src-2"],
      },
      {
        assertionId: "a-mis",
        evidenceRole: "MISATTRIBUTED_TO",
        supportKind: "supporting",
        evidenceIds: ["src-2"],
      },
    ];
    const { assertionById, sourceById } = mapsFrom(assertions, [secondary]);
    const errors = collectIndexProvenanceErrors(
      {
        status: "provisional",
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

  it("rejects direct_coinage without primary source", () => {
    const assertions = [
      {
        assertionId: "a-earliest",
        evidenceRole: "EARLIEST_VERIFIED_OCCURRENCE",
        supportKind: "incomplete",
        evidenceIds: ["src-2"],
      },
      {
        assertionId: "a-coinage",
        evidenceRole: "CLAIMED_COINAGE",
        supportKind: "direct",
        evidenceIds: ["src-2"],
      },
    ];
    const { assertionById, sourceById } = mapsFrom(assertions, [secondary]);
    const errors = collectIndexProvenanceErrors(
      {
        status: "provisional",
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
    expect(errors.some((e: string) => e.includes("primary source"))).toBe(true);
  });

  it("rejects unpublished status carrying an index", () => {
    const errors = collectIndexProvenanceErrors(
      {
        status: "draft",
        index: {
          earliest: { assertionId: "a-earliest", date: { startYear: 1900 } },
          shortFinding: "x",
          verdict: "misattributed",
          verdictAssertionId: "a-mis",
        },
      },
      new Map(),
      new Map(),
    );
    expect(errors.some((e: string) => e.includes("not allowed"))).toBe(true);
  });

  it("accepts valid direct_coinage binding", () => {
    const assertions = [
      {
        assertionId: "a-earliest",
        evidenceRole: "EARLIEST_VERIFIED_OCCURRENCE",
        supportKind: "direct",
        evidenceIds: ["src-1"],
      },
      {
        assertionId: "a-coinage",
        evidenceRole: "CLAIMED_COINAGE",
        supportKind: "direct",
        evidenceIds: ["src-1"],
      },
    ];
    const { assertionById, sourceById } = mapsFrom(assertions, [primary]);
    const errors = collectIndexProvenanceErrors(
      {
        status: "provisional",
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
    expect(errors).toEqual([]);
  });
});
