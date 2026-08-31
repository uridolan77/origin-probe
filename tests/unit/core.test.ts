import { describe, expect, it } from "vitest";
import { computeSourceSetHash } from "@/lib/hash";
import { GenealogySchema } from "@/lib/schema";
import { clearGenealogyCache, getAll, listForIndex } from "@/lib/genealogies";
import {
  classifyShareArrival,
  generateShareToken,
  LIVE_ANALYTICS,
  CRAWLER_EXCLUSION_NOTE,
  isCrawlerUserAgent,
  shouldEmitAnalyticsEvent,
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

  it("accepts nested index projection", () => {
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
      index: {
        earliest: {
          date: {
            display: "1901",
            startYear: 1901,
            precision: "year",
            calendar: "proleptic-gregorian",
          },
          assertionId: "a1",
        },
        shortFinding: "Verified in the cited edition.",
        verdict: "direct_coinage",
        verdictAssertionId: "a-coinage",
      },
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
        {
          assertionId: "a-coinage",
          evidenceRole: "CLAIMED_COINAGE",
          subject: "Example Author",
          publicStatement: "Claimed as coinage by the cited author.",
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
          supportsAssertionIds: ["a1", "a-coinage"],
        },
      ],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.index?.verdict).toBe("direct_coinage");
      expect(parsed.data.index?.earliest.date.display).toBe("1901");
      expect(parsed.data.index?.verdictAssertionId).toBe("a-coinage");
    }
  });

  it("rejects an unknown verdict in index projection", () => {
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
      index: {
        earliest: {
          date: {
            display: "1901",
            startYear: 1901,
            precision: "year",
            calendar: "proleptic-gregorian",
          },
          assertionId: "a1",
        },
        shortFinding: "Verified in the cited edition.",
        verdict: "unknown_verdict",
      },
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
    expect(parsed.success).toBe(false);
  });
});

describe("listForIndex cache safety", () => {
  it("does not mutate canonical getAll order", () => {
    clearGenealogyCache();
    const before = getAll().map((g) => g.slug);
    listForIndex();
    listForIndex();
    const after = getAll().map((g) => g.slug);
    expect(after).toEqual(before);
  });

  it("sorts chronologically with phrase tie-breakers", () => {
    clearGenealogyCache();
    const ordered = listForIndex().map((g) => g.index.earliest.date.startYear);
    expect(ordered).toEqual([...ordered].sort((a, b) => a - b));
    expect(listForIndex()[0]?.slug).toBe("the-medium-is-the-message");
    expect(listForIndex().at(-1)?.slug).toBe("move-fast-and-break-things");
  });
});

describe("events", () => {
  it("keeps live analytics off by default in unit tests", () => {
    expect(LIVE_ANALYTICS).toBe(false);
  });

  it("documents crawler exclusion", () => {
    expect(CRAWLER_EXCLUSION_NOTE.toLowerCase()).toContain("crawler");
  });

  it("detects crawler and preview user agents", () => {
    expect(isCrawlerUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(isCrawlerUserAgent("Twitterbot/1.0")).toBe(true);
    expect(isCrawlerUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe(false);
  });

  it("drops qualified events for crawlers but keeps share_created", () => {
    expect(shouldEmitAnalyticsEvent("qualified_result_view", "Slackbot")).toBe(false);
    expect(shouldEmitAnalyticsEvent("share_created", "Slackbot")).toBe(true);
    expect(shouldEmitAnalyticsEvent("qualified_propagation", "Mozilla/5.0")).toBe(true);
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
    const token = `${Buffer.from("payload", "utf8").toString(
      "base64url",
    )}.${Buffer.alloc(32).toString("base64url")}`;
    const url = buildShareUrl("sample-phrase", token);
    expect(url).toContain("/g/sample-phrase/");
    expect(new URL(url, "https://example.test").searchParams.get("s")).toBe(token);
  });
});
