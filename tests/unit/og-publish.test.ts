import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
// @ts-expect-error og publish helpers
import { loadPublishedGenealogies, pruneStaleOgCards } from "../../tools/og-publish.mjs";

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function tempDir(prefix: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempRoots.push(dir);
  return dir;
}

describe("OG publication membrane", () => {
  it("loads only published genealogies and ignores draft records", () => {
    const dir = tempDir("og-data-");
    const published = JSON.parse(
      fs.readFileSync(
        path.join(process.cwd(), "data/genealogies/the-medium-is-the-message.json"),
        "utf8",
      ),
    );
    const draft = {
      ...published,
      genealogyId: "gen-draft-phrase",
      slug: "draft-phrase",
      status: "draft",
    };
    delete draft.index;
    fs.writeFileSync(path.join(dir, "the-medium-is-the-message.json"), JSON.stringify(published));
    fs.writeFileSync(path.join(dir, "draft-phrase.json"), JSON.stringify(draft));

    const loaded = loadPublishedGenealogies(dir);
    expect(loaded.map((g: { slug: string }) => g.slug)).toEqual(["the-medium-is-the-message"]);
  });

  it("prunes stale OG cards that are not in the published set", () => {
    const dir = tempDir("og-out-");
    fs.writeFileSync(path.join(dir, "the-medium-is-the-message.png"), "keep");
    fs.writeFileSync(path.join(dir, "withdrawn-old-phrase.png"), "stale");

    const removed = pruneStaleOgCards(dir, ["the-medium-is-the-message"]);
    expect(removed).toEqual(["withdrawn-old-phrase"]);
    expect(fs.existsSync(path.join(dir, "the-medium-is-the-message.png"))).toBe(true);
    expect(fs.existsSync(path.join(dir, "withdrawn-old-phrase.png"))).toBe(false);
  });
});
