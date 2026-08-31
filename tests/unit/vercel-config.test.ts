import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Vercel packaging", () => {
  it("lets Next.js own its output and disables main auto-deployment", () => {
    const config = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "vercel.json"), "utf8"),
    ) as Record<string, unknown>;

    expect(config).toEqual({
      framework: "nextjs",
      buildCommand: "npm run build",
      installCommand: "npm ci",
      git: { deploymentEnabled: { main: false } },
    });
  });
});
