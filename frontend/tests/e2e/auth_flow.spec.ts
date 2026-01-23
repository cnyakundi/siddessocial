import { test, expect } from "@playwright/test";
import { seedClientPrefs, assertBackendReady, signupAndOnboard, logout, login, me } from "./utils";

test.describe("Auth flow", () => {
  test("signup → onboarding complete → logout → login", async ({ page }) => {
    await seedClientPrefs(page);
    await assertBackendReady(page);

    const creds = await signupAndOnboard(page, "auth");

    let m = await me(page);
    expect(!!m?.authenticated).toBeTruthy();

    await logout(page);
    m = await me(page);
    expect(!!m?.authenticated).toBeFalsy();

    await login(page, creds.username, creds.password);
    m = await me(page);
    expect(!!m?.authenticated).toBeTruthy();
    expect(!!m?.onboarding?.completed).toBeTruthy();
  });
});
