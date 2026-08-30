import test from "node:test";
import assert from "node:assert/strict";
import { issueShareToken, verifyShareToken } from "../lib/tokens.js";
import { hashClientId } from "../lib/config.js";
import { reduceEvents } from "../lib/reducer.js";

test("hmac token round-trip", () => {
  const secret = "test-secret";
  const token = issueShareToken({
    slug: "culture-eats-strategy-for-breakfast",
    creatorHash: hashClientId("abc", "salt"),
    seed: false,
    hmacSecret: secret,
    ttlSeconds: 3600,
  });
  const v = verifyShareToken(token, secret);
  assert.equal(v.ok, true);
  assert.equal(v.payload.slug, "culture-eats-strategy-for-breakfast");
  assert.equal(v.payload.seed, false);
});

test("tampered token fails", () => {
  const secret = "test-secret";
  const token = issueShareToken({
    slug: "culture-eats-strategy-for-breakfast",
    creatorHash: "x",
    seed: false,
    hmacSecret: secret,
    ttlSeconds: 3600,
  });
  const v = verifyShareToken(token + "x", secret);
  assert.equal(v.ok, false);
});

test("reducer hold when below thresholds", () => {
  const r = reduceEvents(
    [
      {
        id: "1",
        type: "qualified_result_view",
        runId: "r",
        at: new Date().toISOString(),
      },
    ],
    "r",
  );
  assert.equal(r.disposition, "HOLD_ONCE");
});
