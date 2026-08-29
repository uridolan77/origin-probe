import { describe, expect, it } from "vitest";
import { computeSourceSetHash } from "@/lib/hash";
import { GenealogySchema } from "@/lib/schema";
import {
  classifyShareArrival,
  generateShareToken,
  LIVE_ANALYTICS,
  CRAWLER_EXCLUSION_NOTE,
} from "@/lib/events";
import { sanitizeQueryParam, buildShareUrl } from "@/lib/share";

describe("computeSourceSetHash", () => {
  it("is deterministic and order-independent", () => {
    const a = [
      { sourceId: "s2", url: "https://example.com/b", publicationDate: "1960" },
      { sourceId: "s1", url: "https://example.com/a", publicationDate: "1950" },
    ];
    const b = [...a].reverse();
    expect(computeSourceSetHash(a)).toBe(computeSourceSetHash(b));
    expect(computeSourceSetHash(a)).toMatch(/^sha256:[0-9a-f]{16}$/);
  });
});

describe("GenealogySchema", () => {
  it("accepts a minimal valid record", () => {
    const hash = computeSourceSetHash([
      {
        sourceId: "src-1",
        url: "https://example.com/work",
        publicationDate: "1901-01-01",
      },
    ]);
    const parsed = GenealogySchema.safeParse({
      genealogyId: "g1",
      slug: "sample-phrase",
      phrase: "sample phrase",
      aliases: [],
      revision: 1,
      reviewedAt: "2026-01-01",
      status: "provisional",
      finding: "A provisional finding with sources.",
      searchScope: "English-language digitized books, 1800–1950.",
      evidenceReviewed: "Two candidate editions checked.",
      sourceSetHash: hash,
      supersedesRevision: null,
      correctionHistory: [],
      assertions: [
        {
          assertionId: "a1",
          evidenceRole: "EARLIEST_VERIFIED_OCCURRENCE",
          subject: "Example Author",
          publicStatement: "Verified in the cited edition within scope.",
          evidenceIds: ["src-1"],
          supportKind: "direct",
        },
      ],
      sources: [
        {
          sourceId: "src-1",
          title: "Example Work",
          author: "Example Author",
          publisher: "Example Press",
          publicationDate: "1901-01-01",
          sourceType: "primary",
          url: "https://example.com/work",
          accessedAt: "2026-01-01",
          supportsAssertionIds: ["a1"],
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });
});

describe("events", () => {
  it("keeps live analytics off", () => {
    expect(LIVE_ANALYTICS).toBe(false);
  });

  it("documents crawler exclusion", () => {
    expect(CRAWLER_EXCLUSION_NOTE.toLowerCase()).toContain("crawler");
  });

  it("generates opaque share tokens", () => {
    const t = generateShareToken();
    expect(t.length).toBeGreaterThanOrEqual(16);
  });

  it("classifies originating vs arriving clients", () => {
    expect(classifyShareArrival("abcd1234", "client-a", "client-a")).toBe("originating");
    expect(classifyShareArrival("abcd1234", "client-b", "client-a")).toBe("arriving");
    expect(classifyShareArrival(null, "client-a", null)).toBe("unknown");
  });

  it("never treats share_created as propagation in classification", () => {
    // Same client as stored originator → originating (not arriving/propagation).
    expect(classifyShareArrival("tokentoken", "client-aa", "client-aa")).toBe("originating");
  });
});

describe("share helpers", () => {
  it("sanitizes query params", () => {
    expect(sanitizeQueryParam("hello world!!")).toBe("helloworld");
  });

  it("builds share urls", () => {
    const url = buildShareUrl("sample-phrase", "deadbeefcafebabe");
    expect(url).toContain("/g/sample-phrase/");
    expect(url).toContain("s=deadbeefcafebabe");
  });
});
