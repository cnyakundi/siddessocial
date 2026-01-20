#!/usr/bin/env bash
set -euo pipefail

# sd_237_csrf_enforcement_apply_helper.sh
# P0: CSRF strategy correction for session-auth APIs.
#
# Goals:
# - Production: CSRF must be enforced (no blanket csrf_exempt).
# - Browser: must send X-CSRFToken on unsafe methods.
# - Next proxy: must forward X-CSRFToken + Origin/Referer to Django.
# - Provide same-origin CSRF bootstrap endpoint: GET /api/auth/csrf
# - Frontend: patch window.fetch once so all client POST/PATCH/DELETE to /api/* auto-send X-CSRFToken.

ROOT_DIR="$(pwd)"

if [[ ! -d "${ROOT_DIR}/frontend" ]] || [[ ! -d "${ROOT_DIR}/backend" ]]; then
  echo "[sd_237] ERROR: Run from repo root (must contain ./frontend and ./backend)."
  echo "[sd_237] Current dir: ${ROOT_DIR}"
  exit 1
fi

need() {
  if [[ ! -f "$1" ]]; then
    echo "[sd_237] ERROR: Missing required file: $1"
    exit 1
  fi
}

PYBIN="python3"
if ! command -v python3 >/dev/null 2>&1; then
  PYBIN="python"
fi

# Required files
need "frontend/src/components/AuthBootstrap.tsx"
need "frontend/src/app/api/auth/_proxy.ts"
need "frontend/src/app/api/post/[id]/like/route.ts"

need "backend/siddes_backend/middleware.py"
need "backend/siddes_auth/views.py"
need "backend/siddes_post/views.py"
need "backend/siddes_sets/views.py"
need "backend/siddes_invites/views.py"
need "backend/siddes_inbox/views.py"
need "backend/siddes_contacts/views.py"
need "backend/siddes_broadcasts/views.py"

STAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR=".backup_sd_237_csrf_enforcement_${STAMP}"
mkdir -p "${BACKUP_DIR}"

backup() {
  local f="$1"
  if [[ -f "$f" ]]; then
    mkdir -p "${BACKUP_DIR}/$(dirname "$f")"
    cp -p "$f" "${BACKUP_DIR}/$f"
  fi
}

# Backups
backup "frontend/src/components/AuthBootstrap.tsx"
backup "frontend/src/app/api/auth/_proxy.ts"
backup "frontend/src/app/api/post/[id]/like/route.ts"
backup "backend/siddes_backend/middleware.py"
backup "backend/siddes_auth/views.py"
backup "backend/siddes_post/views.py"
backup "backend/siddes_sets/views.py"
backup "backend/siddes_invites/views.py"
backup "backend/siddes_inbox/views.py"
backup "backend/siddes_contacts/views.py"
backup "backend/siddes_broadcasts/views.py"

echo "[sd_237] Backup saved to: ${BACKUP_DIR}"

#############################
# 1) Backend: dev_csrf_exempt
#############################
cat > "backend/siddes_backend/csrf.py" <<'PY'
from __future__ import annotations

from django.conf import settings
from django.views.decorators.csrf import csrf_exempt


def dev_csrf_exempt(view_func):
    """Dev-only CSRF exemption.

    DEBUG=True  -> exempt (developer convenience)
    DEBUG=False -> DO NOT exempt (production enforces CSRF)

    This supports Siddes rules:
    - Session auth is truth in production.
    - No silent security downgrade in production.
    """
    if getattr(settings, "DEBUG", False):
        return csrf_exempt(view_func)
    return view_func
PY
echo "[sd_237] Wrote: backend/siddes_backend/csrf.py"

##############################################
# 2) Backend: replace csrf_exempt -> dev_csrf_exempt
##############################################
"$PYBIN" - <<'PY'
from pathlib import Path

targets = [
    "backend/siddes_auth/views.py",
    "backend/siddes_post/views.py",
    "backend/siddes_sets/views.py",
    "backend/siddes_invites/views.py",
    "backend/siddes_inbox/views.py",
    "backend/siddes_contacts/views.py",
    "backend/siddes_broadcasts/views.py",
]

for t in targets:
    p = Path(t)
    s = p.read_text(encoding="utf-8")
    s2 = s

    s2 = s2.replace(
        "from django.views.decorators.csrf import csrf_exempt",
        "from siddes_backend.csrf import dev_csrf_exempt",
    )
    s2 = s2.replace(
        "method_decorator(csrf_exempt, name=\"dispatch\")",
        "method_decorator(dev_csrf_exempt, name=\"dispatch\")",
    )

    if s2 == s:
        print(f"[sd_237] WARN: no changes applied to {t} (pattern mismatch?)")
    else:
        p.write_text(s2, encoding="utf-8")
        print(f"[sd_237] Patched: {t}")
PY

##########################################################
# 3) Backend: dev CORS allow header for x-csrftoken (dev only)
##########################################################
"$PYBIN" - <<'PY'
from pathlib import Path

p = Path("backend/siddes_backend/middleware.py")
s = p.read_text(encoding="utf-8")

needle = 'response["Access-Control-Allow-Headers"] = "content-type, x-sd-viewer, x-request-id"'
replacement = 'response["Access-Control-Allow-Headers"] = "content-type, x-sd-viewer, x-csrftoken, x-request-id"'

if needle in s:
    s = s.replace(needle, replacement)
    p.write_text(s, encoding="utf-8")
    print("[sd_237] Patched: backend/siddes_backend/middleware.py (allow x-csrftoken)")
else:
    print("[sd_237] NOTE: middleware allow-headers line not found; leaving unchanged.")
PY

########################################
# 4) Frontend: CSRF helper + fetch patch
########################################
cat > "frontend/src/lib/csrf.ts" <<'TS'
"use client";

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
    try {
      // Determine URL
      let url = "";
      if (typeof input === "string") url = input;
      else if (input && typeof input.url === "string") url = input.url;
      else url = String(input || "");

      // Determine method
      const method =
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

          return origFetch(input, { ...(init || {}), headers });
        }
      }
    } catch {
      // fall through
    }
    return origFetch(input, init as any);
  };

  patched = true;
}
TS
echo "[sd_237] Wrote: frontend/src/lib/csrf.ts"

########################################
# 5) Frontend: call patch in AuthBootstrap
########################################
cat > "frontend/src/components/AuthBootstrap.tsx" <<'TSX'
"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { fetchMe } from "@/src/lib/authMe";
import { patchFetchForCsrf } from "@/src/lib/csrf";

/**
 * AuthBootstrap
 *
 * Industry-standard UX:
 * - Auth pages (/login, /signup, /onboarding) show without full app chrome.
 * - Protected pages redirect to /login when not authenticated.
 *
 * Siddes-native:
 * - Authed but not onboarded -> redirect ONCE to onboarding (no loops).
 * - We keep the app calm: no scary blockers; just a gentle redirect.
 *
 * IMPORTANT:
 * - Session auth is truth in production.
 * - No compatibility sd_viewer cookie hacks here.
 */
const ONB_REDIRECT_MARK = "__sd_onb_redirected_v1";

export function AuthBootstrap() {
  // sd_237: patch fetch early so all client POST/PATCH/DELETE to /api/* auto-sends X-CSRFToken.
  patchFetchForCsrf();

  const pathname = usePathname() || "/";
  useEffect(() => {
    const p = pathname || "/";
    const searchStr = window.location.search.replace(/^\?/, "");
    const isAuthPage = p.startsWith("/login") || p.startsWith("/signup") || p.startsWith("/onboarding");

    // IMPORTANT: even on auth pages, we keep the CSRF fetch patch active (installed above).
    if (isAuthPage) return;

    // IMPORTANT: /invite/* must be protected (invite acceptance is session-scoped).
    const protectedPrefixes = [
      "/siddes-feed",
      "/siddes-post",
      "/siddes-sets",
      "/siddes-inbox",
      "/siddes-invites",
      "/siddes-compose",
      "/invite",
      "/siddes-profile",
      "/siddes-settings",
    ];

    const isProtected = protectedPrefixes.some((pre) => p.startsWith(pre));

    fetchMe().then((me) => {
      const authed = !!me?.authenticated;
      const onboarded = !!me?.onboarding?.completed;

      // If authed but not onboarded: redirect once to onboarding.
      if (authed && !onboarded) {
        try {
          const marked = window.sessionStorage.getItem(ONB_REDIRECT_MARK);
          if (!marked) {
            window.sessionStorage.setItem(ONB_REDIRECT_MARK, "1");
            const next = encodeURIComponent(p + (searchStr ? `?${searchStr}` : ""));
            window.location.href = `/onboarding?next=${next}`;
            return;
          }
        } catch {
          // If sessionStorage fails, fall back to always redirecting (safer than leaking)
          const next = encodeURIComponent(p + (searchStr ? `?${searchStr}` : ""));
          window.location.href = `/onboarding?next=${next}`;
          return;
        }
      }

      // Clear redirect mark once onboarded.
      if (authed && onboarded) {
        try {
          window.sessionStorage.removeItem(ONB_REDIRECT_MARK);
        } catch {}
      }

      // If not authenticated and trying to access private surfaces, redirect.
      if (!authed && isProtected) {
        const next = encodeURIComponent(p + (searchStr ? `?${searchStr}` : ""));
        window.location.href = `/login?next=${next}`;
        return;
      }
    });
  }, [pathname]);

  return null;
}
TSX
echo "[sd_237] Updated: frontend/src/components/AuthBootstrap.tsx"

########################################
# 6) Frontend: CSRF bootstrap endpoint
########################################
mkdir -p "frontend/src/app/api/auth/csrf"
cat > "frontend/src/app/api/auth/csrf/route.ts" <<'TS'
import { NextResponse } from "next/server";
import crypto from "crypto";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function hasCookie(req: Request, name: string): boolean {
  const c = req.headers.get("cookie") || "";
  const n = String(name || "").trim();
  if (!n) return false;
  const re = new RegExp("(?:^|;\\s*)" + n.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&") + "=");
  return re.test(c);
}

function newToken(): string {
  // 32 hex chars (Django accepts cookie token chars in this set).
  return crypto.randomBytes(16).toString("hex");
}

// GET /api/auth/csrf -> sets csrftoken cookie on the Next domain if missing.
export async function GET(req: Request) {
  const resp = NextResponse.json({ ok: true }, { status: 200, headers: { "cache-control": "no-store" } });

  if (!hasCookie(req, "csrftoken")) {
    resp.cookies.set("csrftoken", newToken(), {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
    });
  }

  return resp;
}
TS
echo "[sd_237] Added: frontend/src/app/api/auth/csrf/route.ts"

########################################
# 7) Frontend: Next proxy forwards CSRF + Origin/Referer
########################################
cat > "frontend/src/app/api/auth/_proxy.ts" <<'TS'
import { NextResponse } from "next/server";

export type ProxyJsonOut = {
  res: Response;
  data: any;
  setCookies: string[];
};

export function resolveInternalBase(): string | null {
  const raw = process.env.SD_INTERNAL_API_BASE || process.env.NEXT_PUBLIC_API_BASE;
  const s = String(raw || "").trim();
  if (s) {
    try {
      const u = new URL(s);
      return u.origin;
    } catch {
      try {
        const u = new URL("http://" + s);
        return u.origin;
      } catch {
        // fall through
      }
    }
  }

  // Dev fallback: allow running `npm run dev` without exporting NEXT_PUBLIC_API_BASE.
  // Production continues to fail closed.
  if (process.env.NODE_ENV !== "production") {
    const p = String(
      process.env.SIDDES_BACKEND_PORT || process.env.SD_BACKEND_PORT || process.env.BACKEND_PORT || "8000"
    ).trim();
    const port = /^\d+$/.test(p) ? p : "8000";
    return `http://localhost:${port}`;
  }

  return null;
}

function getSetCookies(res: Response): string[] {
  // Node/Next runtime exposes getSetCookie() which preserves multiple Set-Cookie headers.
  const h: any = (res as any).headers;
  if (h && typeof h.getSetCookie === "function") {
    try {
      const v = h.getSetCookie();
      if (Array.isArray(v)) return v as string[];
    } catch {
      // fall through
    }
  }
  // Fallback (may collapse multiple cookies into one header).
  const sc = res.headers.get("set-cookie");
  return sc ? [sc] : [];
}

export async function proxyJson(req: Request, path: string, method: string, body?: any): Promise<ProxyJsonOut | NextResponse> {
  const base = resolveInternalBase();
  if (!base) {
    return NextResponse.json({ ok: false, error: "missing_api_base" }, { status: 500 });
  }

  const url = new URL(path, base).toString();

  const cookie = req.headers.get("cookie") || "";
  const xViewer = req.headers.get("x-sd-viewer") || "";
  const csrf = req.headers.get("x-csrftoken") || "";

  // Critical for Django CSRF checks in HTTPS deployments:
  // Forward browser Origin/Referer so Django can validate same-site requests.
  const origin = req.headers.get("origin") || "";
  const referer = req.headers.get("referer") || "";

  const reqId = req.headers.get("x-request-id") || "";

  const headers: Record<string, string> = { "content-type": "application/json" };
  if (cookie) headers.cookie = cookie;
  if (xViewer) headers["x-sd-viewer"] = xViewer; // dev passthrough only
  if (csrf) headers["x-csrftoken"] = csrf;

  if (origin) headers.origin = origin;
  if (referer) headers.referer = referer;
  if (reqId) headers["x-request-id"] = reqId;

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: "proxy_fetch_failed",
        detail: String(e?.message || e || "unknown"),
        url,
      },
      { status: 502 }
    );
  }

  const setCookies = getSetCookies(res);

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = { ok: false, error: "bad_response" };
  }

  return { res, data, setCookies };
}
TS
echo "[sd_237] Updated: frontend/src/app/api/auth/_proxy.ts"

########################################
# 8) Frontend: Like route forwards CSRF headers too (manual proxy)
########################################
cat > "frontend/src/app/api/post/[id]/like/route.ts" <<'TS'
// sd_179m: /api/post/[id]/like proxy (cookie-forwarding; fail closed in prod)
import { NextResponse } from "next/server";
import { resolveStubViewer } from "@/src/lib/server/stubViewer";

function normalizeApiBase(raw: string | undefined | null): string | null {
  const s = String(raw || "").trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.origin;
  } catch {
    return null;
  }
}

async function fetchJson(url: string, init: RequestInit): Promise<{ status: number; data: any | null } | null> {
  try {
    const res = await fetch(url, { ...init, cache: "no-store" });
    const data = await res.json().catch(() => null);
    return { status: res.status, data };
  } catch {
    return null;
  }
}

function backendNotConfigured() {
  const status = process.env.NODE_ENV === "production" ? 502 : 501;
  return NextResponse.json({ ok: false, error: "backend_not_configured" }, { status });
}

function backendUnavailable() {
  return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 502 });
}

function buildForwardHeaders(req: Request, viewerId: string | null): Record<string, string> {
  const h: Record<string, string> = {};
  const cookie = req.headers.get("cookie") || "";
  if (cookie) h.cookie = cookie;

  const csrf = req.headers.get("x-csrftoken") || "";
  if (csrf) h["x-csrftoken"] = csrf;

  const origin = req.headers.get("origin") || "";
  if (origin) h.origin = origin;

  const referer = req.headers.get("referer") || "";
  if (referer) h.referer = referer;

  const reqId = req.headers.get("x-request-id") || "";
  if (reqId) h["x-request-id"] = reqId;

  // Dev-only identity passthrough (production should not depend on it).
  if (viewerId) h["x-sd-viewer"] = viewerId;

  return h;
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const id = params?.id;
  if (!id) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const base = normalizeApiBase(process.env.SD_INTERNAL_API_BASE || process.env.NEXT_PUBLIC_API_BASE);
  if (!base) return backendNotConfigured();

  const r = resolveStubViewer(req);
  const url = new URL(`/api/post/${encodeURIComponent(id)}/like`, base).toString();

  const prox = await fetchJson(url, {
    method: "POST",
    headers: buildForwardHeaders(req, r.viewerId || null),
  });

  if (prox && prox.status < 500) {
    return NextResponse.json(prox.data ?? { ok: false, error: "bad_gateway" }, { status: prox.status });
  }

  if (process.env.NODE_ENV === "production") return backendUnavailable();
  return backendUnavailable();
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const id = params?.id;
  if (!id) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const base = normalizeApiBase(process.env.SD_INTERNAL_API_BASE || process.env.NEXT_PUBLIC_API_BASE);
  if (!base) return backendNotConfigured();

  const r = resolveStubViewer(req);
  const url = new URL(`/api/post/${encodeURIComponent(id)}/like`, base).toString();

  const prox = await fetchJson(url, {
    method: "DELETE",
    headers: buildForwardHeaders(req, r.viewerId || null),
  });

  if (prox && prox.status < 500) {
    return NextResponse.json(prox.data ?? { ok: false, error: "bad_gateway" }, { status: prox.status });
  }

  if (process.env.NODE_ENV === "production") return backendUnavailable();
  return backendUnavailable();
}
TS
echo "[sd_237] Updated: frontend/src/app/api/post/[id]/like/route.ts"

echo
echo "[sd_237] DONE."
echo
echo "Restart services:"
echo "  docker compose -f ops/docker/docker-compose.dev.yml restart backend frontend"
echo
echo "Stop/Go gate:"
echo "  npm -C frontend run lint"
echo
echo "Verification (quick):"
echo "  # Backend decorators"
echo "  grep -R -n \"method_decorator(dev_csrf_exempt\" backend/siddes_*/*views.py | head -n 30"
echo "  # Proxy forwards CSRF header"
echo "  grep -R -n \"x-csrftoken\" frontend/src/app/api/auth/_proxy.ts | head -n 30"
echo "  # CSRF bootstrap route exists"
echo "  test -f frontend/src/app/api/auth/csrf/route.ts && echo ok"
echo
echo "Manual smoke (browser):"
echo "  1) Open any page, then DevTools Console: document.cookie (should contain csrftoken=...)"
echo "  2) Try a write action (create set, send message, like post)."
echo
echo "Rollback:"
echo "  cp -R \"${BACKUP_DIR}\"/* ."
