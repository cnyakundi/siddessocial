import { test, expect } from "@playwright/test";
import { seedClientPrefs, assertBackendReady, signupAndOnboard, dismissFtueIfPresent } from "./utils";

test.describe("Feed", () => {
  test("pagination: Load more issues a cursor request (no dead-feed regressions)", async ({ page }) => {
    await seedClientPrefs(page);
    await assertBackendReady(page);
    await signupAndOnboard(page, "feedpage");

    const run = `${Date.now()}_${Math.random().toString(16).slice(2, 6)}`;

    // Seed enough posts to guarantee paging.
    for (let i = 0; i < 26; i++) {
      const text = `e2e feed page ${run} #${i}`;
      const r = await page.request.post("/api/post", {
        data: { side: "friends", text, urgent: false },
        timeout: 15_000,
      });
      const j: any = await r.json().catch(() => ({}));
      if (!r.ok() || !j?.ok) {
        throw new Error(`seed post failed (${r.status()}): ${JSON.stringify(j)}`);
      }
    }

    const feedReqs: string[] = [];
    await page.route(/\/api\/feed(\?|$)/, async (route) => {
      feedReqs.push(route.request().url());
      await route.continue();
    });

    await page.goto(`/siddes-feed?r=${Date.now()}`, { waitUntil: "domcontentloaded" });
    await dismissFtueIfPresent(page);

    const loadMoreBox = page.locator('[data-testid="feed-load-more"]');
    await expect(loadMoreBox).toBeVisible({ timeout: 20_000 });

    // Some runs may auto-trigger load more via IntersectionObserver; clicking is still safe.
    const btn = loadMoreBox.getByRole("button", { name: /load more/i }).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click();
    }

    // Must see a cursor request at least once.
    await expect
      .poll(() => feedReqs.some((u) => u.includes("cursor=")), { timeout: 20_000 })
      .toBeTruthy();

    // Must not surface a load-more error.
    await expect(loadMoreBox.getByText(/couldn\u2019t load more|couldn't load more/i)).toHaveCount(0);
  });
});
