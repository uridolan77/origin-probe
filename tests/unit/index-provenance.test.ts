import { describe, expect, it } from "vitest";
// @ts-expect-error shared provenance helper
import { collectIndexProvenanceErrors } from "../../tools/index-provenance.mjs";

function mapsFrom(assertions: Array<Record<string, unknown>>, sources: Array<Record<string, unknown>>) {
  const assertionById = new Map(assertions.map((a) => [a.assertionId as string, a]));
  const sourceById = new Map(sources.map((s) => [s.sourceId as string, s]));
  return { assertionById, sourceById };
}

const date1900 = {
  display: "1900",
  startYear: 1900,
  precision: "year",
  calendar: "proleptic-gregorian",
};

const date1964 = {
  display: "1964",
  startYear: 1964,
  precision: "year",
  calendar: "proleptic-gregorian",
};

const date1974 = {
  display: "1974",
  startYear: 1974,
  precision: "year",
  calendar: "proleptic-gregorian",
};

const primary = {
  sourceId: "src-1",
  sourceType: "primary",
};

const secondary = {
  sourceId: "src-2",
  sourceType: "secondary",
};

function evo(overrides: Record<string, unknown> = {}) {
  return {
    assertionId: "a-earliest",
    evidenceRole: "EARLIEST_VERIFIED_OCCURRENCE",
    subject: "Ada Lovelace",
    publicStatement: "Verified Ada Lovelace occurrence.",
    supportKind: "direct",
    evidenceIds: ["src-1"],
    occurrenceDate: date1900,
    earlierUseStatus: "none_located_within_scope",
    originatorKey: "ada-lovelace",
    ...overrides,
  };
}

function coinage(overrides: Record<string, unknown> = {}) {
  return {
    assertionId: "a-coinage",
    evidenceRole: "CLAIMED_COINAGE",
    subject: "Ada Lovelace",
    publicStatement: "Commonly credited to Ada Lovelace.",
    supportKind: "direct",
    evidenceIds: ["src-1"],
    originatorKey: "ada-lovelace",
    ...overrides,
  };
}

describe("index provenance verdict binding", () => {
  it("rejects direct_coinage bound to incomplete CLAIMED_COINAGE", () => {
    const assertions = [
      evo(),
      coinage({ supportKind: "incomplete", evidenceIds: ["src-2"] }),
    ];
    const { assertionById, sourceById } = mapsFrom(assertions, [primary, secondary]);
    const errors = collectIndexProvenanceErrors(
      {
        status: "provisional",
        assertions,
        index: {
          earliest: { assertionId: "a-earliest", date: date1900 },
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
      evo({
        earlierUseStatus: "reported_unverified",
        caveat: "Earlier use reported but not inspected.",
      }),
      coinage(),
    ];
    const { assertionById, sourceById } = mapsFrom(assertions, [primary]);
    const errors = collectIndexProvenanceErrors(
      {
        status: "provisional",
        assertions,
        index: {
          earliest: { assertionId: "a-earliest", date: date1900 },
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

  it("rejects direct_coinage when earliest earlierUseStatus is not none_located_within_scope", () => {
    const assertions = [
      evo({
        earlierUseStatus: "reported_unverified",
        caveat: "Earlier 2009 use reported but not inspected.",
      }),
      coinage(),
    ];
    const { assertionById, sourceById } = mapsFrom(assertions, [primary]);
    const errors = collectIndexProvenanceErrors(
      {
        status: "provisional",
        assertions,
        index: {
          earliest: { assertionId: "a-earliest", date: date1900 },
          shortFinding: "x",
          verdict: "direct_coinage",
          verdictAssertionId: "a-coinage",
        },
      },
      assertionById,
      sourceById,
    );
    expect(errors.some((e: string) => e.includes("earlierUseStatus none_located_within_scope"))).toBe(
      true,
    );
  });

  it("rejects direct_coinage when earlierUseStatus is contested even without a caveat field", () => {
    const assertions = [
      evo({ earlierUseStatus: "contested" }),
      coinage(),
    ];
    const { assertionById, sourceById } = mapsFrom(assertions, [primary]);
    const errors = collectIndexProvenanceErrors(
      {
        status: "provisional",
        assertions,
        index: {
          earliest: { assertionId: "a-earliest", date: date1900 },
          shortFinding: "x",
          verdict: "direct_coinage",
          verdictAssertionId: "a-coinage",
        },
      },
      assertionById,
      sourceById,
    );
    expect(errors.some((e: string) => e.includes("earlierUseStatus none_located_within_scope"))).toBe(
      true,
    );
  });

  it("rejects direct_coinage on generic token overlap without matching originatorKey", () => {
    const assertions = [
      evo({
        subject: "Internal saying at a conference",
        publicStatement: "An internal saying appeared in print.",
        originatorKey: "unrelated-person",
      }),
      coinage({
        subject: "Mark Zuckerberg / Facebook internal saying",
        originatorKey: "mark-zuckerberg",
      }),
    ];
    const { assertionById, sourceById } = mapsFrom(assertions, [primary]);
    const errors = collectIndexProvenanceErrors(
      {
        status: "provisional",
        assertions,
        index: {
          earliest: { assertionId: "a-earliest", date: date1900 },
          shortFinding: "x",
          verdict: "direct_coinage",
          verdictAssertionId: "a-coinage",
        },
      },
      assertionById,
      sourceById,
    );
    expect(errors.some((e: string) => e.includes("originatorKey"))).toBe(true);
  });

  it("rejects direct_coinage when index earliest is EARLIEST_REPORTED_OCCURRENCE", () => {
    const assertions = [
      {
        assertionId: "a-earliest",
        evidenceRole: "EARLIEST_REPORTED_OCCURRENCE",
        subject: "Reported trail",
        publicStatement: "Reported only.",
        supportKind: "incomplete",
        evidenceIds: ["src-2"],
        occurrenceDate: date1974,
        earlierUseStatus: "reported_unverified",
        originatorKey: "ada-lovelace",
      },
      coinage({ evidenceIds: ["src-1"] }),
    ];
    const { assertionById, sourceById } = mapsFrom(assertions, [primary, secondary]);
    const errors = collectIndexProvenanceErrors(
      {
        status: "provisional",
        assertions,
        index: {
          earliest: { assertionId: "a-earliest", date: date1974 },
          shortFinding: "x",
          verdict: "direct_coinage",
          verdictAssertionId: "a-coinage",
        },
      },
      assertionById,
      sourceById,
    );
    expect(errors.some((e: string) => e.includes("EARLIEST_VERIFIED_OCCURRENCE"))).toBe(true);
  });

  it("rejects when index.earliest.date disagrees with assertion occurrenceDate", () => {
    const assertions = [evo({ occurrenceDate: date1964 }), coinage()];
    const { assertionById, sourceById } = mapsFrom(assertions, [primary]);
    const errors = collectIndexProvenanceErrors(
      {
        status: "provisional",
        assertions,
        index: {
          earliest: { assertionId: "a-earliest", date: date1900 },
          shortFinding: "x",
          verdict: "claimed_coinage",
          verdictAssertionId: "a-coinage",
        },
      },
      assertionById,
      sourceById,
    );
    expect(errors.some((e: string) => e.includes("must equal occurrenceDate"))).toBe(true);
  });

  it("rejects popularized bound to incomplete POPULARIZED_BY", () => {
    const assertions = [
      evo(),
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
          earliest: { assertionId: "a-earliest", date: date1900 },
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
      evo(),
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
          earliest: { assertionId: "a-earliest", date: date1900 },
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
        occurrenceDate: date1974,
        earlierUseStatus: "reported_unverified",
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
          earliest: { assertionId: "a-reported", date: date1974 },
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

  it("accepts valid direct_coinage with matching originatorKey and none_located_within_scope", () => {
    const assertions = [
      evo({
        assertionId: "a-earliest",
        subject: "Understanding Media (1964)",
        publicStatement: "Verified Marshall McLuhan occurrence in Understanding Media.",
        occurrenceDate: date1964,
        originatorKey: "marshall-mcluhan",
      }),
      coinage({
        subject: "Marshall McLuhan",
        publicStatement: "Commonly credited to Marshall McLuhan.",
        originatorKey: "marshall-mcluhan",
      }),
    ];
    const { assertionById, sourceById } = mapsFrom(assertions, [primary]);
    const errors = collectIndexProvenanceErrors(
      {
        status: "provisional",
        assertions,
        index: {
          earliest: { assertionId: "a-earliest", date: date1964 },
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
