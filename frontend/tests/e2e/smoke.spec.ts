import { test, expect } from "@playwright/test";

async function seed(page: any) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("sd.activeSide", "friends");
      localStorage.setItem("sd.lastNonPublicSide", "friends");
    } catch {}
  });
}

test.describe("Siddes smoke", () => {
  test("Feed loads or redirects to login", async ({ page }) => {
  await seed(page);
  await page.goto("/siddes-feed", { waitUntil: "domcontentloaded" });

  const deadline = Date.now() + 15_000;

  while (Date.now() < deadline) {
    const url = page.url();

    // Client-side redirects can happen after initial load.
    if (url.includes("/login")) return;

    const ok = page
      .locator(
        '[data-testid="feed-restricted"]:visible, [data-testid="feed-loading"]:visible, [data-testid="feed-load-more"]:visible, [data-testid="feed-error"]:visible'
      )
      .first();

    if (await ok.isVisible().catch(() => false)) {
      await expect(ok).toBeVisible();
      return;
    }

    await page.waitForTimeout(250);
  }

  throw new Error(`Neither feed UI nor /login redirect occurred within timeout. Final URL: ${page.url()}`);
});

  test("Search renders input", async ({ page }) => {
  await seed(page);
  await page.goto("/search?q=sarah", { waitUntil: "domcontentloaded" });

  const deadline = Date.now() + 15_000;

  while (Date.now() < deadline) {
    const url = page.url();
    if (url.includes("/login")) return;

    const exact = page
      .locator('input[placeholder="Search people, sets, or public takes…"]:visible')
      .first();
    if (await exact.isVisible().catch(() => false)) {
      await expect(exact).toBeVisible();
      return;
    }

    const anySearch = page.locator('input[placeholder*="Search"]:visible').first();
    if (await anySearch.isVisible().catch(() => false)) {
      await expect(anySearch).toBeVisible();
      return;
    }

    const textbox = page.getByRole("textbox").first();
    if (await textbox.isVisible().catch(() => false)) {
      await expect(textbox).toBeVisible();
      return;
    }

    await page.waitForTimeout(250);
  }

  throw new Error(`Search input did not appear (and no /login redirect). Final URL: ${page.url()}`);
});

  test("Outbox page renders or redirects to login", async ({ page }) => {
  await seed(page);
  await page.goto("/siddes-outbox", { waitUntil: "domcontentloaded" });

  const deadline = Date.now() + 15_000;

  while (Date.now() < deadline) {
    const url = page.url();
    if (url.includes("/login")) return;

    const title = page.locator('div:text-is("Outbox"):visible').first();
    if (await title.isVisible().catch(() => false)) {
      await expect(title).toBeVisible();
      return;
    }

    await page.waitForTimeout(250);
  }

  throw new Error(`Neither Outbox UI nor /login redirect occurred within timeout. Final URL: ${page.url()}`);
});

  test("Prism page loads or redirects to login", async ({ page }) => {
    await seed(page);
    await page.goto("/siddes-profile/prism", { waitUntil: "domcontentloaded" });

    const deadline = Date.now() + 15_000;

    while (Date.now() < deadline) {
      const url = page.url();

      // If we reached login, the auth gate works -> pass.
      if (url.includes("/login")) return;

      // If Prism UI is visible, pass.
      const prismAny = page.locator("text=/Prism|Identity Prism|Edit Persona/i:visible").first();
      if (await prismAny.isVisible().catch(() => false)) {
        await expect(prismAny).toBeVisible();
        return;
      }

      await page.waitForTimeout(250);
    }

    throw new Error(`Neither Prism UI nor /login redirect occurred within timeout. Final URL: ${page.url()}`);
  });
});
