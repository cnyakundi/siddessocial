import { test, expect } from "@playwright/test";
import { seedClientPrefs, assertBackendReady, signupAndOnboard, dismissFtueIfPresent } from "./utils";

test.describe("Feed", () => {
  test("scroll restore: returning from post detail restores list position", async ({ page }) => {
    await seedClientPrefs(page);
    await assertBackendReady(page);
    await signupAndOnboard(page, "feedscroll");

    const run = `${Date.now()}_${Math.random().toString(16).slice(2, 6)}`;

    // Seed many posts so we can scroll meaningfully.
    for (let i = 0; i < 40; i++) {
      const text = `e2e feed scroll ${run} #${i}`;
      const r = await page.request.post("/api/post", {
        data: { side: "friends", text, urgent: false },
        timeout: 15_000,
      });
      const j: any = await r.json().catch(() => ({}));
      if (!r.ok() || !j?.ok) {
        throw new Error(`seed post failed (${r.status()}): ${JSON.stringify(j)}`);
      }
    }

    await page.goto(`/siddes-feed?r=${Date.now()}`, { waitUntil: "domcontentloaded" });
    await dismissFtueIfPresent(page);

    // Scroll down to a deep position.
    for (let i = 0; i < 6; i++) {
      await page.mouse.wheel(0, 1400);
      await page.waitForTimeout(80);
    }

    await expect
      .poll(async () => {
        const y = await page.evaluate(() => window.scrollY);
        return y;
      }, { timeout: 10_000 })
      .toBeGreaterThan(700);

    // Pick a post currently visible at this scroll position.
    const card = page.locator("[data-post-id]").nth(2);
    await expect(card).toBeVisible({ timeout: 20_000 });
    const pid = await card.getAttribute("data-post-id");
    if (!pid) throw new Error("could not read data-post-id");

    // Open post detail from the card.
    await page.locator(`[data-post-id="${pid}"] [aria-label="Open post"]`).first().click();
    await page.waitForURL(/\/siddes-post\//, { timeout: 20_000 });

    await page.goBack({ waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/siddes-feed/, { timeout: 20_000 });
    await dismissFtueIfPresent(page);

    // Should restore to a non-top position and render the anchor card.
    await expect
      .poll(async () => {
        const y = await page.evaluate(() => window.scrollY);
        return y;
      }, { timeout: 20_000 })
      .toBeGreaterThan(200);

    await expect(page.locator(`[data-post-id="${pid}"]`).first()).toBeVisible({ timeout: 20_000 });
  });
});
