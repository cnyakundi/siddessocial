import { test, expect } from "@playwright/test";
import { seedClientPrefs, assertBackendReady, signupAndOnboard, dismissFtueIfPresent, csrfPost } from "./utils";

test.describe("Feed scope sync", () => {
  test("selecting a Set triggers /api/feed?set=... (TopBar -> Feed)", async ({ page }) => {
    await seedClientPrefs(page);
    await assertBackendReady(page);
    await signupAndOnboard(page, "feedscope");

    const label = `E2E Scope Set ${Date.now()}`;
    const res = await csrfPost(page, "/api/sets", {
      data: { side: "friends", label, members: [], color: "emerald" },
      timeout: 15_000,
    });

    const data: any = await res.json().catch(() => ({}));
    expect(res.ok(), `sets create failed (${res.status()}): ${JSON.stringify(data)}`).toBeTruthy();
    expect(!!data?.ok).toBeTruthy();

    const setId: string = String(data?.item?.id || "");
    expect(setId, `no set id in response: ${JSON.stringify(data)}`).toBeTruthy();

    await page.goto("/siddes-feed", { waitUntil: "domcontentloaded" });
    await dismissFtueIfPresent(page);

    const waitFeedReq = page.waitForRequest((req) => {
      const u = req.url();
      return u.includes("/api/feed") && u.includes("set=" + encodeURIComponent(setId));
    });

    await page.getByRole("button", { name: /choose set/i }).click();
    await page.getByRole("button", { name: new RegExp(label) }).click();

    const req = await waitFeedReq;
    expect(req.url()).toContain("set=" + encodeURIComponent(setId));
  });
});
