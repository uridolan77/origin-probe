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
  await expect(page.getByLabel("Search the traced collection")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Available phrases" })).toBeVisible();
  await expect(page.locator('a[href="/g/culture-eats-strategy-for-breakfast/"]')).toBeVisible();
  expect(errors).toEqual([]);
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

test("search autocomplete and unsupported phrase", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  const input = page.getByLabel("Search the traced collection");
  await input.fill("culture eats");
  await expect(page.getByRole("listbox")).toBeVisible();
  await expect(page.getByRole("option").first()).toBeVisible();

  await input.fill("completely unknown slogan xyzzy");
  await expect(page.getByText(/Not traced yet/)).toBeVisible();
  await expect(page.getByRole("link", { name: /Request this phrase/i })).toBeVisible();
});

test("keyboard navigation reaches interactive control", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();
});

test("mobile viewport home", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByLabel("Search the traced collection")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Available phrases" })).toBeVisible();
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
  await expect(page.getByLabel("Search the traced collection")).toBeVisible();
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
