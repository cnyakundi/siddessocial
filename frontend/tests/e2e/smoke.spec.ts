import { test, expect } from "@playwright/test";

test.describe("Siddes smoke", () => {
  test("Feed loads or redirects to login", async ({ page }) => {
    await page.goto("/siddes-feed", { waitUntil: "domcontentloaded" });

    if (page.url().includes("/login")) {
      // Auth gate working is acceptable for smoke.
      return;
    }

    const ok = page
      .locator(
        '[data-testid="feed-restricted"]:visible, [data-testid="feed-loading"]:visible, [data-testid="feed-load-more"]:visible, [data-testid="feed-error"]:visible'
      )
      .first();

    await expect(ok).toBeVisible();
  });

  test("Search renders input", async ({ page }) => {
    await page.goto("/search?q=sarah", { waitUntil: "domcontentloaded" });

    const input = page
      .locator('input[placeholder="Search people, sets, or public takes…"]:visible')
      .first();

    await expect(input).toBeVisible();
  });

  test("Outbox page renders or redirects to login", async ({ page }) => {
    await page.goto("/siddes-outbox", { waitUntil: "domcontentloaded" });

    if (page.url().includes("/login")) {
      return;
    }

    const title = page.locator('div:text-is("Outbox"):visible').first();
    await expect(title).toBeVisible();
  });

  test("Prism page loads or redirects to login", async ({ page }) => {
    await page.goto("/siddes-profile/prism", { waitUntil: "domcontentloaded" });

    const deadline = Date.now() + 15_000;

    while (Date.now() < deadline) {
      const url = page.url();

      // If we reached login, the auth gate works -> pass.
      if (url.includes("/login")) return;

      // If Prism UI is visible, pass.
      const prismAny = page.locator('text=/Prism|Identity Prism|Edit Persona/i:visible').first();
      if (await prismAny.isVisible().catch(() => false)) {
        await expect(prismAny).toBeVisible();
        return;
      }

      await page.waitForTimeout(250);
    }

    throw new Error(`Neither Prism UI nor /login redirect occurred within timeout. Final URL: ${page.url()}`);
  });
});
