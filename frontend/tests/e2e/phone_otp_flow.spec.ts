import { test, expect } from "@playwright/test";
import { seedClientPrefs, assertBackendReady, requestPhoneOtp, confirmPhoneOtp, me, logout } from "./utils";

function makeKePhone(): string {
  // +2547XXXXXXXX (KE mobile)
  const ts = Date.now().toString();
  const tail = (ts + Math.floor(Math.random() * 1e9).toString()).slice(-8);
  return `+2547${tail}`;
}

test.describe("Phone OTP auth", () => {
  test("request → confirm → authenticated", async ({ page }) => {
    await seedClientPrefs(page);
    await assertBackendReady(page);

    const phone = makeKePhone();

    const r1: any = await requestPhoneOtp(page, phone, "KE");
    const code = String(r1?.debugCode || "").trim();
    if (!code) {
      throw new Error(
        "Phone OTP request did not return debugCode. Ensure backend DEBUG=1 (DJANGO_DEBUG=1) and SD_SMS_PROVIDER=console in dev."
      );
    }

    const r2: any = await confirmPhoneOtp(page, phone, code, "KE");
    expect(!!r2?.ok).toBeTruthy();

    const m = await me(page);
    expect(!!m?.authenticated).toBeTruthy();

    await logout(page);
    const m2 = await me(page);
    expect(!!m2?.authenticated).toBeFalsy();
  });
});
