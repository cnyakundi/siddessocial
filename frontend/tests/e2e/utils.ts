import { expect, Page } from "@playwright/test";

export type Creds = { username: string; email: string; password: string };

function sanitizeUsername(raw: string): string {
  const t = String(raw || "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_+|_+$/g, "");
  const s = (t || "e2euser").slice(0, 24);
  return s.length >= 3 ? s : (s + "___").slice(0, 3);
}

export function makeCreds(prefix = "e2e"): Creds {
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 6);
  const username = sanitizeUsername(`${prefix}_${ts}_${rnd}`);
  const email = `${username}@example.com`;
  const password = `SiddesTest!${Date.now()}_${rnd}`;
  return { username, email, password };
}

export async function seedClientPrefs(page: Page) {
  // Avoid first-run side picker + keep tests deterministic.
  await page.addInitScript(() => {
    try {
      localStorage.setItem("sd.activeSide", "friends");
      localStorage.setItem("sd.lastNonPublicSide", "friends");
    } catch {}
    try {
      sessionStorage.removeItem("__sd_onb_redirected_v1");
    } catch {}
  });
}

export async function dismissFtueIfPresent(page: Page) {
  const ftue = page.locator('[data-testid="ftue-side-picker"]');
  if (await ftue.isVisible().catch(() => false)) {
    const startBtn = page.getByRole("button", { name: /start in friends/i }).first();
    if (await startBtn.isVisible().catch(() => false)) {
      await startBtn.click().catch(() => {});
    } else {
      await page.locator('[data-testid="ftue-side-picker"] button[aria-label="Close"]').first().click().catch(() => {});
    }
    await ftue.waitFor({ state: "detached", timeout: 10_000 }).catch(() => {});
  }
}

function fmtJson(x: any): string {
  try {
    return JSON.stringify(x);
  } catch {
    return String(x);
  }
}

export async function assertBackendReady(page: Page) {
  // Prefer /api/_diag (Brick 1.2). It returns ok:false + hint when misconfigured.
  try {
    const r = await page.request.get("/api/_diag", { timeout: 10_000 });
    if (r.status() !== 404) {
      const j: any = await r.json().catch(() => null);
      if (j && j.ok) return;
      const hint = j?.hint || j?.healthz?.error || j?.configured?.rawHint || "";
      throw new Error(
        `Backend not ready (via /api/_diag). ${hint || "Check SD_INTERNAL_API_BASE and backend /healthz."}`
      );
    }
  } catch (e: any) {
    // If diag explicitly reported failure, surface it.
    if (String(e?.message || "").includes("Backend not ready")) throw e;
  }

  // Fallback probe (works even without Brick 1.2)
  const me = await page.request.get("/api/auth/me", { timeout: 10_000 });
  const j: any = await me.json().catch(() => null);

  if (!me.ok()) {
    throw new Error(
      `Backend not ready: /api/auth/me -> ${me.status()}. ` +
        `Start backend from repo root: ./scripts/dev/start_backend_docker.sh (or: docker compose -f ops/docker/docker-compose.dev.yml up -d backend). ` +
        `Body: ${fmtJson(j)}`
    );
  }

  if (j?.error === "backend_not_configured") {
    throw new Error(
      "Backend not configured: set SD_INTERNAL_API_BASE (or run backend on 127.0.0.1:8000)."
    );
  }
}

export async function signupAndOnboard(page: Page, prefix = "e2e"): Promise<Creds> {
  let lastErr: any = null;

  for (let i = 0; i < 5; i++) {
    const creds = makeCreds(prefix);

    const res = await page.request.post("/api/auth/signup", {
      data: { email: creds.email, username: creds.username, password: creds.password, ageConfirmed: true },
      timeout: 15_000,
    });

    const data: any = await res.json().catch(() => ({}));

    if (res.ok() && data?.ok) {
      // Mark onboarding complete (avoids redirect loops).
      const r2 = await page.request.post("/api/auth/onboarding/complete", { data: {}, timeout: 15_000 });
      const d2: any = await r2.json().catch(() => ({}));
      if (!r2.ok() || !d2?.ok) {
        throw new Error(`onboarding/complete failed (${r2.status()}): ${fmtJson(d2)}`);
      }
      return creds;
    }

    if (data?.error === "signup_unavailable") {
      lastErr = { status: res.status(), data };
      continue; // collision; try again
    }

    lastErr = { status: res.status(), data };
    break;
  }

  throw new Error(`signup failed: ${fmtJson(lastErr)}`);
}

export async function logout(page: Page) {
  const r = await page.request.post("/api/auth/logout", { data: {}, timeout: 10_000 });
  await r.json().catch(() => ({}));
}

export async function login(page: Page, identifier: string, password: string) {
  const r = await page.request.post("/api/auth/login", { data: { identifier, password }, timeout: 10_000 });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok() || !j?.ok) {
    throw new Error(`login failed (${r.status()}): ${fmtJson(j)}`);
  }
}

export async function me(page: Page): Promise<any> {
  const r = await page.request.get("/api/auth/me", { timeout: 10_000 });
  const j = await r.json().catch(() => ({}));
  return j;
}

export async function requestMagicLink(page: Page, email: string, next?: string | null): Promise<any> {
  const payload: any = { email: String(email || "").trim() };
  const n = String(next || "").trim();
  if (n) payload.next = n;

  const r = await page.request.post("/api/auth/magic/request", { data: payload, timeout: 15_000 });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok() || !j?.ok) {
    throw new Error(`magic/request failed (${r.status()}): ${fmtJson(j)}`);
  }
  return j;
}

export async function consumeMagicLink(page: Page, token: string): Promise<any> {
  const r = await page.request.post("/api/auth/magic/consume", { data: { token }, timeout: 15_000 });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok() || !j?.ok) {
    throw new Error(`magic/consume failed (${r.status()}): ${fmtJson(j)}`);
  }
  return j;
}

export async function requestPhoneOtp(page: Page, phone: string, region: string = "KE"): Promise<any> {
  const r = await page.request.post("/api/auth/phone/request", { data: { phone, region }, timeout: 15_000 });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok() || !j?.ok) {
    throw new Error(`phone/request failed (${r.status()}): ${fmtJson(j)}`);
  }
  return j;
}

export async function confirmPhoneOtp(page: Page, phone: string, code: string, region: string = "KE"): Promise<any> {
  const r = await page.request.post("/api/auth/phone/confirm", { data: { phone, code, region }, timeout: 15_000 });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok() || !j?.ok) {
    throw new Error(`phone/confirm failed (${r.status()}): ${fmtJson(j)}`);
  }
  return j;
}

