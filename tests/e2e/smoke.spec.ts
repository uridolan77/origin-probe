import { test, expect } from "@playwright/test";

const SLUGS = [
  "culture-eats-strategy-for-breakfast",
  "move-fast-and-break-things",
  "information-wants-to-be-free",
  "be-the-change-you-wish-to-see",
  "the-medium-is-the-message",
  "insanity-doing-the-same-thing",
  "if-youre-not-paying-you-are-the-product",
];

test.describe.configure({ mode: "serial" });

test("home page loads with traced collection", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /Who coined it/i })).toBeVisible();
  await expect(page.getByText("Built by Uri Dolan")).toBeVisible();
  await expect(page.getByLabel("Search the collection")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Phrases" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Concepts" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Verdict" })).toBeVisible();
  await expect(page.locator('.phrase-index-table--desktop a[href="/g/culture-eats-strategy-for-breakfast/"]')).toBeVisible();
  await expect(page.locator(".phrase-index-table--desktop").getByRole("cell", { name: "1964" })).toBeVisible();
  await expect(page.locator(".phrase-index-table--desktop").getByRole("cell", { name: "Reported 1974" })).toBeVisible();
  await expect(page.locator(".phrase-index-table--desktop").getByRole("cell", { name: "Direct coinage" }).first()).toBeVisible();
  await expect(page.locator(".phrase-index-table--desktop").getByRole("cell", { name: "Claimed coinage" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("collection index rows are chronological", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const years = await page.locator(".phrase-index-table tbody tr td:first-child").allTextContents();
  expect(years).toEqual([
    "1964",
    "Reported 1974",
    "Reported 1980s",
    "1984",
    "2000",
    "2010",
    "2012",
  ]);
});

test("search matches year and non-alias author name", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  const input = page.getByLabel("Search the collection");

  await input.fill("1964");
  await expect(page.locator(".search-suggestions a").first()).toContainText(/medium is the message/i);

  await input.fill("Stewart Brand");
  await expect(page.locator(".search-suggestions a").first()).toContainText(/information wants to be free/i);
});

test("every result page renders evidence roles and scope", async ({ page }) => {
  for (const slug of SLUGS) {
    await page.goto(`/g/${slug}/`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Evidence roles" })).toBeVisible();
    await expect(page.getByText("Search scope.")).toBeVisible();
    await expect(page.getByText(/Revision:/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Copy link" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Submit a correction/i })).toBeVisible();
  }
});

test("reported occurrence timelines use historical dates not dossier years", async ({ page }) => {
  await page.goto("/g/be-the-change-you-wish-to-see/", { waitUntil: "domcontentloaded" });
  const btcOccurrence = page.locator(".timeline li").filter({
    hasText: /earliest reported occurrence/i,
  });
  await expect(btcOccurrence.locator(".timeline-date")).toHaveText("Reported 1974");
  await expect(btcOccurrence.locator(".timeline-date")).not.toHaveText("2017-10-23");

  await page.goto("/g/insanity-doing-the-same-thing/", { waitUntil: "domcontentloaded" });
  const insanityOccurrence = page.locator(".timeline li").filter({
    hasText: /earliest reported occurrence/i,
  });
  await expect(insanityOccurrence.locator(".timeline-date")).toHaveText("Reported 1980s");
  await expect(insanityOccurrence.locator(".timeline-date")).not.toHaveText("2017-03-23");
});

test("search autocomplete and unsupported phrase", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  const input = page.getByLabel("Search the collection");
  await input.fill("culture eats");
  await expect(page.locator(".search-suggestions a").first()).toBeVisible();

  await input.fill("completely unknown slogan xyzzy");
  await expect(page.locator(".search-empty")).toContainText(/No matches in the collection/);
  await expect(page.getByRole("link", { name: /Request this phrase/i })).toHaveCount(1);
});

test("keyboard navigation reaches search input", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  for (let i = 0; i < 8; i += 1) {
    if (await page.getByLabel("Search the collection").evaluate((el) => el === document.activeElement)) {
      break;
    }
    await page.keyboard.press("Tab");
  }
  await expect(page.getByLabel("Search the collection")).toBeFocused();
});

test("mobile viewport home has no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByLabel("Search the collection")).toBeVisible();
  await expect(page.locator(".phrase-index-cards--mobile li").first()).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
  expect(overflow).toBe(true);
});

test("desktop viewport result", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/g/move-fast-and-break-things/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Evidence roles" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sources" })).toBeVisible();
});

test("reduced motion does not break pages", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByLabel("Search the collection")).toBeVisible();
  await page.goto("/g/information-wants-to-be-free/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Evidence roles" })).toBeVisible();
});

test("method privacy corrections pages", async ({ page }) => {
  await page.goto("/method/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Method" })).toBeVisible();
  await page.goto("/privacy/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Privacy" })).toBeVisible();
  await expect(page.getByText(/No account/i)).toBeVisible();
  await expect(page.getByText(/authorized public decision window/i)).toBeVisible();
  await expect(page.getByText(/private durable ledger stores/i)).toBeVisible();
  await page.goto("/corrections/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Corrections" })).toBeVisible();
});

test("copy link updates status", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => undefined);
  await page.goto("/g/the-medium-is-the-message/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Copy link" }).click();
  await expect(page.getByRole("status")).toContainText(
    /copied|offline|unavailable|Could not/i,
  );
});

test("offline copy UX fails closed without fabricating a share token", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/g/culture-eats-strategy-for-breakfast/", {
    waitUntil: "networkidle",
  });
  await page.evaluate(() => navigator.clipboard.writeText("unchanged-sentinel"));

  await page.getByRole("button", { name: "Copy link" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Sharing is unavailable while measurement is offline.",
  );

  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe("unchanged-sentinel");
});

test("social card asset exists for each slug", async ({ request }) => {
  for (const slug of SLUGS) {
    const res = await request.get(`/og/${slug}.png`);
    expect(res.ok(), slug).toBeTruthy();
  }
});
