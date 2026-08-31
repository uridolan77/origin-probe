import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const BASE_COMMIT = "f460b03";
const dataDir = path.join(process.cwd(), "data", "genealogies");

function stripIndexProjection(record: Record<string, unknown>) {
  const rest = { ...record };
  delete rest.index;
  delete rest.earliestLabel;
  delete rest.earliestSortYear;
  delete rest.shortFinding;
  delete rest.verdict;
  return rest;
}

describe("index migration additive-only proof", () => {
  const files = fs.readdirSync(dataDir).filter((f) => f.endsWith(".json"));

  for (const file of files) {
    it(`preserves canonical fields in ${file}`, () => {
      const current = JSON.parse(fs.readFileSync(path.join(dataDir, file), "utf8"));
      const baselineRaw = execSync(`git show ${BASE_COMMIT}:data/genealogies/${file}`, {
        encoding: "utf8",
      });
      const baseline = JSON.parse(baselineRaw);
      expect(stripIndexProjection(current)).toEqual(baseline);
      expect(current.index).toBeDefined();
    });
  }
});
