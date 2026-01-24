import { test, expect } from "@playwright/test";
import {
  seedClientPrefs,
  assertBackendReady,
  signupAndOnboard,
  logout,
  requestMagicLink,
  consumeMagicLink,
  me,
} from "./utils";

test.describe("Magic link auth", () => {
  test("request → consume → authenticated", async ({ page }) => {
    await seedClientPrefs(page);
    await assertBackendReady(page);

    // Magic links only issue tokens for existing accounts.
    const creds = await signupAndOnboard(page, "magic");
    await logout(page);

    const r1: any = await requestMagicLink(page, creds.email);
    const token = String(r1?.debugToken || "").trim();
    if (!token) {
      throw new Error(
        "Magic link request did not return debugToken. Ensure backend DEBUG=1 (DJANGO_DEBUG=1) and SD_EMAIL_PROVIDER=console in dev."
      );
    }

    const r2: any = await consumeMagicLink(page, token);
    expect(!!r2?.ok).toBeTruthy();

    const m = await me(page);
    expect(!!m?.authenticated).toBeTruthy();
    expect(!!m?.onboarding?.completed).toBeTruthy();
  });
});
