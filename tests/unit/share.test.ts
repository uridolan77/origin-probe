import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  buildShareUrl,
  isValidSignedShareToken,
  MAX_SIGNED_SHARE_TOKEN_LENGTH,
} from "@/lib/share";

describe("signed share tokens", () => {
  it("preserves a real maximum-length signed token in the share URL", () => {
    const payload = {
      v: 2,
      runId: "ORIGIN-G2-PUBLIC-PROBE-AUTH-002",
      slug: "culture-eats-strategy-for-breakfast",
      creatorHash: "c".repeat(64),
      seed: false,
      iat: 1_788_091_200,
      exp: 1_789_300_800,
      nonce: "",
    };
    const targetPayloadBytes = 3039;
    payload.nonce = "n".repeat(
      targetPayloadBytes - Buffer.byteLength(JSON.stringify(payload), "utf8"),
    );
    const body = Buffer.from(JSON.stringify(payload), "utf8").toString(
      "base64url",
    );
    const signature = createHmac("sha256", "test-only-hmac-secret")
      .update(body)
      .digest("base64url");
    const token = `${body}.${signature}`;
    expect(token).toHaveLength(MAX_SIGNED_SHARE_TOKEN_LENGTH);
    expect(isValidSignedShareToken(token)).toBe(true);

    const url = buildShareUrl(
      "culture-eats-strategy-for-breakfast",
      token,
      "https://example.test",
    );

    expect(new URL(url).searchParams.get("s")).toBe(token);
  });

  it.each([
    "",
    "unsigned",
    "a.b",
    ".signature",
    "payload.",
    "payload.signature.extra",
    "payload+.signature",
    "payload.signature/",
    "payload=.signature",
    " payload.signature",
    `${"a".repeat(4095)}.b`,
  ])("rejects malformed or oversized tokens without rewriting them: %s", (token) => {
    expect(isValidSignedShareToken(token)).toBe(false);
    expect(() => buildShareUrl("sample-phrase", token, "https://example.test")).toThrow(
      TypeError,
    );
  });
});
