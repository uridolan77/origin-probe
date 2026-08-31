import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Vercel packaging", () => {
  it("lets the Next.js framework preset own its output directory", () => {
    const config = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "vercel.json"), "utf8"),
    ) as Record<string, unknown>;

    expect(config.framework).toBe("nextjs");
    expect(config.buildCommand).toBe("npm run build");
    expect(config.installCommand).toBe("npm ci");
    expect(config).not.toHaveProperty("outputDirectory");
  });
});
