import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const repositoryRoot = process.cwd();
const temporaryRoots: string[] = [];

function sha256(filePath: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function createFixture(): string {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "origin-og-cards-"));
  temporaryRoots.push(fixtureRoot);
  fs.mkdirSync(path.join(fixtureRoot, "tools"), { recursive: true });
  fs.mkdirSync(path.join(fixtureRoot, "data"), { recursive: true });
  fs.mkdirSync(path.join(fixtureRoot, "public"), { recursive: true });
  fs.copyFileSync(
    path.join(repositoryRoot, "tools", "gen-og-cards.mjs"),
    path.join(fixtureRoot, "tools", "gen-og-cards.mjs"),
  );
  fs.cpSync(path.join(repositoryRoot, "data", "genealogies"), path.join(fixtureRoot, "data", "genealogies"), {
    recursive: true,
  });
  fs.cpSync(path.join(repositoryRoot, "public", "og"), path.join(fixtureRoot, "public", "og"), {
    recursive: true,
  });
  return fixtureRoot;
}

function runGenerator(fixtureRoot: string) {
  return spawnSync(process.execPath, [path.join(fixtureRoot, "tools", "gen-og-cards.mjs")], {
    cwd: fixtureRoot,
    encoding: "utf8",
  });
}

function snapshotDirectory(directory: string): Record<string, string> {
  return Object.fromEntries(
    fs.readdirSync(directory).map((name) => [name, sha256(path.join(directory, name))]),
  );
}

afterEach(() => {
  for (const temporaryRoot of temporaryRoots.splice(0)) {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

describe("frozen OG cards", () => {
  it("accepts the exact tracked assets without requiring a build font", () => {
    const fixtureRoot = createFixture();
    const ogDirectory = path.join(fixtureRoot, "public", "og");
    const before = snapshotDirectory(ogDirectory);

    const result = runGenerator(fixtureRoot);

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("gen-og-cards: verified frozen assets (7)");
    expect(fs.existsSync(path.join(fixtureRoot, "tools", "fonts", "LiberationSerif-Regular.ttf"))).toBe(
      false,
    );
    expect(snapshotDirectory(ogDirectory)).toEqual(before);
  });

  it("rejects a changed tracked asset before font discovery and does not rewrite it", () => {
    const fixtureRoot = createFixture();
    const cardPath = path.join(
      fixtureRoot,
      "public",
      "og",
      "culture-eats-strategy-for-breakfast.png",
    );
    const changed = Buffer.from(fs.readFileSync(cardPath));
    changed[changed.length - 1] ^= 0xff;
    fs.writeFileSync(cardPath, changed);
    const changedSnapshot = snapshotDirectory(path.dirname(cardPath));

    const result = runGenerator(fixtureRoot);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "Frozen OG card digest changed for culture-eats-strategy-for-breakfast.",
    );
    expect(snapshotDirectory(path.dirname(cardPath))).toEqual(changedSnapshot);
    expect(fs.existsSync(path.join(fixtureRoot, "tools", "fonts", "LiberationSerif-Regular.ttf"))).toBe(
      false,
    );
  });

  it("fails closed when the genealogy directory is absent", () => {
    const fixtureRoot = createFixture();
    fs.rmSync(path.join(fixtureRoot, "data", "genealogies"), { recursive: true });

    const result = runGenerator(fixtureRoot);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Frozen OG card manifest does not match the genealogy set.");
    expect(fs.existsSync(path.join(fixtureRoot, "tools", "fonts", "LiberationSerif-Regular.ttf"))).toBe(
      false,
    );
  });

  it("fails closed when the nonempty genealogy slug set drifts", () => {
    const fixtureRoot = createFixture();
    const genealogyDirectory = path.join(fixtureRoot, "data", "genealogies");
    const removedFile = fs.readdirSync(genealogyDirectory).find((name) => name.endsWith(".json"));
    expect(removedFile).toBeDefined();
    fs.rmSync(path.join(genealogyDirectory, removedFile!));

    const result = runGenerator(fixtureRoot);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Frozen OG card manifest does not match the genealogy set.");
    expect(fs.existsSync(path.join(fixtureRoot, "tools", "fonts", "LiberationSerif-Regular.ttf"))).toBe(
      false,
    );
  });
});
