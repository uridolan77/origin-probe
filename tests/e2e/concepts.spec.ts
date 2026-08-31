import { test, expect } from "@playwright/test";

test.describe("concepts collection", () => {
  test("concepts index renders catalog with filters", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/concepts/", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", {
        name: /How philosophical ideas acquired their words/i,
      }),
    ).toBeVisible();
    await expect(page.getByText(/of 100 concepts/i)).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Concept" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Research status" })).toBeVisible();

    const rows = page.locator(".concept-index-table tbody tr");
    await expect(rows).toHaveCount(100);

    await page.getByLabel("Search concepts").fill("Trolley");
    await expect(page.locator(".search-suggestions .search-type").first()).toHaveText(
      "Concept",
    );
    await expect(page.locator(".search-suggestions a").first()).toContainText(/Trolley/i);

    await page.goto("/concepts/", { waitUntil: "domcontentloaded" });
    await page.locator("#concept-domain").selectOption({ label: "Ethics" });
    const filtered = page.locator(".concept-index-table tbody tr");
    const count = await filtered.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(100);
  });

  test("unpublished concept detail is honest and has no measurement beacon", async ({
    page,
  }) => {
    await page.goto("/concepts/trolley-problem/", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Trolley problem" })).toBeVisible();
    await expect(page.getByText("No public genealogy yet")).toBeVisible();
    await expect(
      page.getByText(/Candidate assertions are not shown as findings/i),
    ).toBeVisible();
    await expect(page.getByText(/Philippa Foot/i)).toHaveCount(0);
    await expect(page.locator("[data-result-view-beacon]")).toHaveCount(0);

    const robots = await page.locator('meta[name="robots"]').getAttribute("content");
    // Next may emit robots via HTTP headers in static export; also check noindex in meta if present
    if (robots) {
      expect(robots.toLowerCase()).toContain("noindex");
    }
  });

  test("mobile concept cards expose the same fields", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/concepts/", { waitUntil: "domcontentloaded" });
    const card = page.locator(".phrase-index-cards--mobile li").first();
    await expect(card).toBeVisible();
    await expect(card.getByText("Research status", { exact: true })).toBeVisible();
    await expect(card.getByText("Public dossier", { exact: true })).toBeVisible();
  });

  test("method page includes concept genealogies lifecycle", async ({ page }) => {
    await page.goto("/method/", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Concept genealogies" })).toBeVisible();
    await expect(page.locator(".concept-lifecycle")).toContainText("Research queued");
    await expect(page.locator(".concept-lifecycle")).toContainText(
      "Separately authorized publication",
    );
  });

  test("corrections accepts concept query params", async ({ page }) => {
    await page.goto("/corrections/?kind=concept&subject=trolley-problem", {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByLabel(/Concept label or slug/i)).toHaveValue("trolley-problem");
  });

  test("sitemap excludes unpublished concept pages", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.ok()).toBeTruthy();
    const body = await res.text();
    expect(body).toContain("/concepts/");
    expect(body).not.toContain("/concepts/trolley-problem/");
  });
});
