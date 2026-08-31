import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { GenealogySchema as TsGenealogySchema } from "@/lib/schema";
// @ts-expect-error shared guard schema
import { GenealogySchema as GuardGenealogySchema } from "../../tools/genealogy-schema.mjs";

const dataDir = path.join(process.cwd(), "data", "genealogies");

function loadJson(name: string) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, name), "utf8"));
}

describe("schema parity", () => {
  it("accepts all published genealogies through both schemas", () => {
    const files = fs.readdirSync(dataDir).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      const raw = loadJson(file);
      const ts = TsGenealogySchema.safeParse(raw);
      const guard = GuardGenealogySchema.safeParse(raw);
      expect(ts.success, file).toBe(true);
      expect(guard.success, file).toBe(true);
    }
  });

  it("rejects partial index projection in both schemas", () => {
    const raw = loadJson("the-medium-is-the-message.json");
    const broken = {
      ...raw,
      index: {
        shortFinding: "Incomplete",
      },
    };
    expect(TsGenealogySchema.safeParse(broken).success).toBe(false);
    expect(GuardGenealogySchema.safeParse(broken).success).toBe(false);
  });

  it("rejects unknown verdict in both schemas", () => {
    const raw = loadJson("the-medium-is-the-message.json");
    const broken = {
      ...raw,
      index: {
        ...raw.index,
        verdict: "unknown_verdict",
      },
    };
    expect(TsGenealogySchema.safeParse(broken).success).toBe(false);
    expect(GuardGenealogySchema.safeParse(broken).success).toBe(false);
  });
});
