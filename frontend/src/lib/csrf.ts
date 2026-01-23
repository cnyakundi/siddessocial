"use client";

// CSRF helper (sd_237a)
// - Ensures csrftoken cookie exists (same-origin) via GET /api/auth/csrf
// - Patches window.fetch to add X-CSRFToken for unsafe /api/* requests

let patched = false;

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = name + "=";
  const parts = String(document.cookie || "").split(";");
  for (const part of parts) {
    const c = part.trim();
    if (!c) continue;
    if (c.startsWith(prefix)) {
      try {
        return decodeURIComponent(c.slice(prefix.length));
      } catch {
        return c.slice(prefix.length);
      }
    }
  }
  return null;
}

function isSafeMethod(method: string): boolean {
  const m = String(method || "GET").toUpperCase();
  return m === "GET" || m === "HEAD" || m === "OPTIONS" || m === "TRACE";
}

function isApiUrl(u: string): boolean {
  const s = String(u || "");
  if (!s) return false;
  if (s.startsWith("/api/")) return true;
  try {
    if (typeof window !== "undefined") {
      const origin = window.location.origin;
      if (s.startsWith(origin + "/api/")) return true;
    }
  } catch {}
  return false;
}

export function getCsrfToken(): string | null {
  const t = getCookie("csrftoken");
  return t ? String(t) : null;
}

async function ensureCsrfToken(origFetch: typeof fetch): Promise<string | null> {
  let t = getCsrfToken();
  if (t) return t;

  // Same-origin bootstrap route sets csrftoken cookie if missing.
  try {
    await origFetch("/api/auth/csrf", { method: "GET", cache: "no-store" });
  } catch {
    // ignore
  }

  t = getCsrfToken();
  return t;
}

export function patchFetchForCsrf(): void {
  if (patched) return;
  if (typeof window === "undefined") return;

  const w: any = window as any;
  if (!w.fetch || typeof w.fetch !== "function") return;

  const origFetch: typeof fetch = w.fetch.bind(w);

  w.fetch = async (input: any, init?: RequestInit) => {
    let url = "";
    let method = "GET";
    try {
      // Determine URL
      if (typeof input === "string") url = input;
      else if (input && typeof input.url === "string") url = input.url;
      else url = String(input || "");

      // Determine method
      method =
        (init && (init as any).method) ||
        (input && typeof input.method === "string" ? input.method : "GET") ||
        "GET";

      if (!isSafeMethod(method) && isApiUrl(url)) {
        const token = await ensureCsrfToken(origFetch);
        if (token) {
          const headers = new Headers(
            (init && (init as any).headers) ||
              (input && input.headers ? input.headers : undefined) ||
              undefined
          );
          if (!headers.has("x-csrftoken")) headers.set("x-csrftoken", token);

          try {
            return await origFetch(input, { ...(init || {}), headers });
          } catch (e: any) {
            // For same-origin API calls, return a JSON error response instead of crashing the app.
            try {
              if (isApiUrl(url)) {
                const detail = String(e?.message || e || "network_error");
                return new Response(JSON.stringify({ ok: false, error: "network_error", detail }), {
                  status: 503,
                  headers: { "content-type": "application/json" },
                });
              }
            } catch {}
            throw e;
          }
        }
      }
    } catch {
      // fall through
    }

    try {
      return await origFetch(input, init as any);
    } catch (e: any) {
      // For same-origin API calls, return a JSON error response instead of crashing the app.
      try {
        if (isApiUrl(url)) {
          const detail = String(e?.message || e || "network_error");
          return new Response(JSON.stringify({ ok: false, error: "network_error", detail }), {
            status: 503,
            headers: { "content-type": "application/json" },
          });
        }
      } catch {}
      throw e;
    }
  };

  patched = true;
}
