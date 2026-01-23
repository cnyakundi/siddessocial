import { test, expect } from "@playwright/test";
import { seedClientPrefs, assertBackendReady, signupAndOnboard } from "./utils";

test.describe("Media (optional)", () => {
  test("sign-upload supports video when R2 is configured", async ({ page }) => {
    await seedClientPrefs(page);
    await assertBackendReady(page);
    await signupAndOnboard(page, "media");

    const res = await page.request.post("/api/media/sign-upload", {
      data: { kind: "video", contentType: "video/mp4", bytes: 16, ext: "mp4" },
      timeout: 15_000,
    });

    if (res.status() === 404) {
      test.skip(true, "Media BFF routes missing (Brick 1.1 not applied)");
    }

    const data: any = await res.json().catch(() => ({}));

    // If R2 isn't configured locally, this is expected; skip rather than fail.
    if (!res.ok() && data?.error === "r2_not_configured") {
      test.skip(true, "R2 not configured on backend (SIDDES_R2_* env vars)");
    }

    expect(res.ok(), `media sign-upload failed (${res.status()}): ${JSON.stringify(data)}`).toBeTruthy();
    expect(!!data?.ok).toBeTruthy();
    expect(String(data?.media?.kind || "")).toBe("video");
  });
});
