import { NextResponse } from "next/server";

function dropCookieByName(setCookies: string[], name: string): string[] {
  const n = String(name || "").toLowerCase();
  if (!n) return setCookies || [];
  return (setCookies || []).filter((c) => !String(c || "").toLowerCase().trim().startsWith(n + "="));
}

function applySetCookies(resp: NextResponse, setCookies: string[]) {
  for (const sc of setCookies || []) {
    if (!sc) continue;
    resp.headers.append("set-cookie", sc);
  }
}

function parseExpires(raw: any): Date | undefined {
  if (!raw) return undefined;
  try {
    const d = new Date(String(raw));
    if (!Number.isNaN(d.getTime())) return d;
  } catch {
    // ignore
  }
  return undefined;
}

/**
 * Apply backend cookies, but set the session cookie explicitly using data.session (sd_545 pattern).
 * Hardening: accept either `expires` or `expiresAt` naming, and always strip backend session cookie.
 */
export function applyProxyCookies(resp: NextResponse, data: any, setCookies: string[]) {
  const session = data?.session || {};
  const sessName = String(session?.name || "sessionid");
  const sessVal = String(session?.value || "");

  // Always forward non-session cookies only (e.g. csrftoken), never the backend's session cookie.
  applySetCookies(resp, dropCookieByName(setCookies || [], sessName));

  if (sessName && sessVal) {
    const maxAgeRaw = session?.maxAge ?? session?.max_age;
    const maxAge = typeof maxAgeRaw === "number" && Number.isFinite(maxAgeRaw) ? maxAgeRaw : undefined;

    const expires =
      parseExpires(session?.expires) ||
      parseExpires(session?.expiresAt) ||
      parseExpires(session?.expires_at);

    resp.cookies.set(sessName, sessVal, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      ...(maxAge !== undefined ? { maxAge } : {}),
      ...(expires ? { expires } : {}),
    });
  }
}
