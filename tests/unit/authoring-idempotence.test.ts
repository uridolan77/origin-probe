import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const dataDir = path.join(process.cwd(), "data", "genealogies");
const script = path.join(process.cwd(), "scripts", "write-genealogies.mjs");

function corpusFingerprint() {
  return fs
    .readdirSync(dataDir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((file) => {
      const raw = fs.readFileSync(path.join(dataDir, file));
      return `${file}:${createHash("sha256").update(raw).digest("hex")}`;
    })
    .join("\n");
}

describe("genealogy authoring path", () => {
  it("is idempotent: check mode rewrites nothing", () => {
    const before = corpusFingerprint();
    const output = execFileSync(process.execPath, [script, "--check"], {
      encoding: "utf8",
    });
    const after = corpusFingerprint();
    expect(after).toBe(before);
    expect(output).toMatch(/no files rewritten/);
  });
});
