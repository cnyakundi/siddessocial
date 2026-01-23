import { test, expect } from "@playwright/test";
import { seedClientPrefs, assertBackendReady, signupAndOnboard, dismissFtueIfPresent } from "./utils";

test.describe("Compose", () => {
  test("text post appears in feed", async ({ page }) => {
    await seedClientPrefs(page);
    await assertBackendReady(page);
    await signupAndOnboard(page, "post");

    const text = `e2e post ${Date.now()}`;

    await page.goto("/siddes-compose", { waitUntil: "domcontentloaded" });
    await dismissFtueIfPresent(page);

    await page.locator("textarea").first().fill(text);
    await page.locator('button[aria-label="Post"]').click();

    await page.waitForURL(/\/siddes-feed/);

    // Force a fresh mount (avoids stale feed illusions)
    await page.goto(`/siddes-feed?r=${Date.now()}`, { waitUntil: "domcontentloaded" });
    await dismissFtueIfPresent(page);

    await expect(page.getByText(text).first()).toBeVisible({ timeout: 20_000 });
  });
});
