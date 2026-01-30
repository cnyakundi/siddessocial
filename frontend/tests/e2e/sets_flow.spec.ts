import { test, expect } from "@playwright/test";
import { seedClientPrefs, assertBackendReady, signupAndOnboard, dismissFtueIfPresent } from "./utils";

test.describe("Sets", () => {
  test("create a Circle (API) and see it in Sets list", async ({ page }) => {
    await seedClientPrefs(page);
    await assertBackendReady(page);
    await signupAndOnboard(page, "set");

    const label = `E2E Set ${Date.now()}`;

    const res = await page.request.post("/api/circles", {
      data: { side: "friends", label, members: [], color: "emerald" },
      timeout: 15_000,
    });

    const data: any = await res.json().catch(() => ({}));
    expect(res.ok(), `sets create failed (${res.status()}): ${JSON.stringify(data)}`).toBeTruthy();
    expect(!!data?.ok).toBeTruthy();

    await page.goto("/siddes-circles", { waitUntil: "domcontentloaded" });
    await dismissFtueIfPresent(page);

    await expect(page.getByText(label).first()).toBeVisible({ timeout: 20_000 });
  });
});
