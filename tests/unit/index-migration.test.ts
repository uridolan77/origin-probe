import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const dataDir = path.join(process.cwd(), "data", "genealogies");
const baselineDir = path.join(process.cwd(), "tests", "fixtures", "genealogies-baseline");
const manifestPath = path.join(baselineDir, "MANIFEST.json");

function stripAssertionAdditions(assertions: Array<Record<string, unknown>>) {
  return assertions.map((a) => {
    const next = { ...a };
    delete next.occurrenceDate;
    delete next.earlierUseStatus;
    delete next.originatorKey;
    return next;
  });
}

function stripIndexProjection(record: Record<string, unknown>) {
  const rest = { ...record };
  delete rest.index;
  delete rest.earliestLabel;
  delete rest.earliestSortYear;
  delete rest.shortFinding;
  delete rest.verdict;
  if (Array.isArray(rest.assertions)) {
    rest.assertions = stripAssertionAdditions(
      rest.assertions as Array<Record<string, unknown>>,
    );
  }
  return rest;
}

function sha256File(filePath: string) {
  return createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

describe("genealogy baseline custody", () => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
    baseCommit: string;
    files: Record<string, string>;
  };

  it("locks immutable baseline fixture hashes", () => {
    expect(manifest.baseCommit).toBe("c29a5679d11b95dd771f63f9676b74d45dd3bcec");
    for (const [file, expected] of Object.entries(manifest.files)) {
      expect(sha256File(path.join(baselineDir, file))).toBe(expected);
    }
  });

  const files = fs.readdirSync(dataDir).filter((f) => f.endsWith(".json"));

  for (const file of files) {
    it(`records custody for ${file}`, () => {
      const current = JSON.parse(fs.readFileSync(path.join(dataDir, file), "utf8"));
      const baseline = JSON.parse(fs.readFileSync(path.join(baselineDir, file), "utf8"));
      expect(current.index).toBeDefined();
      expect(manifest.files[file]).toBeDefined();

      if (current.revision === 1) {
        expect(current.supersedesRevision).toBeNull();
        expect(stripIndexProjection(current)).toEqual(baseline);
        return;
      }

      expect(current.revision).toBeGreaterThan(1);
      expect(current.supersedesRevision).toBe(current.revision - 1);
      expect(current.correctionHistory.length).toBeGreaterThan(0);
      expect(current.correctionHistory.at(-1)?.toRevision).toBe(current.revision);

      const baselineAssertionIds = new Set(
        baseline.assertions.map((a: { assertionId: string }) => a.assertionId),
      );
      const currentAssertionIds = new Set(
        current.assertions.map((a: { assertionId: string }) => a.assertionId),
      );
      for (const id of baselineAssertionIds) {
        expect(currentAssertionIds.has(id)).toBe(true);
      }

      const withoutNewAssertions = {
        ...stripIndexProjection(current),
        revision: baseline.revision,
        reviewedAt: baseline.reviewedAt,
        supersedesRevision: baseline.supersedesRevision,
        correctionHistory: baseline.correctionHistory,
        assertions: current.assertions.filter((a: { assertionId: string }) =>
          baselineAssertionIds.has(a.assertionId),
        ),
        sources: current.sources.map((s: { supportsAssertionIds: string[] }) => ({
          ...s,
          supportsAssertionIds: s.supportsAssertionIds.filter((id) =>
            baselineAssertionIds.has(id),
          ),
        })),
      };
      expect(withoutNewAssertions).toEqual(baseline);
    });
  }
});
