#!/usr/bin/env bash
set -euo pipefail

ROOT="$PWD"
if [ ! -d "$ROOT/frontend" ] || [ ! -d "$ROOT/backend" ]; then
  echo "ERROR: run from repo root (must contain frontend/ and backend/)" >&2
  exit 1
fi

TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.backup_sd_460_media_api_proxy_routes_$TS"
mkdir -p "$BK"

mkdir -p "$ROOT/frontend/src/app/api/media/sign-upload"
mkdir -p "$ROOT/frontend/src/app/api/media/commit"

# backups if files already exist
[ -f "$ROOT/frontend/src/app/api/media/sign-upload/route.ts" ] && cp "$ROOT/frontend/src/app/api/media/sign-upload/route.ts" "$BK/sign-upload.route.ts"
[ -f "$ROOT/frontend/src/app/api/media/commit/route.ts" ] && cp "$ROOT/frontend/src/app/api/media/commit/route.ts" "$BK/commit.route.ts"

cat > "$ROOT/frontend/src/app/api/media/sign-upload/route.ts" <<'TS'
import { NextResponse } from "next/server";
import { resolveStubViewer } from "@/src/lib/server/stubViewer";
import { proxyJson } from "@/src/app/api/auth/_proxy";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function withDevViewer(req: Request): Request {
  if (process.env.NODE_ENV === "production") return req;
  const r = resolveStubViewer(req);
  if (!r.viewerId) return req;
  const h = new Headers(req.headers);
  h.set("x-sd-viewer", r.viewerId);
  return new Request(req.url, { method: req.method, headers: h });
}

// POST /api/media/sign-upload -> Django POST /api/media/sign-upload
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const req2 = withDevViewer(req);
  const out = await proxyJson(req2, "/api/media/sign-upload", "POST", body);
  if (out instanceof NextResponse) return out;

  const { res, data, setCookies } = out;
  const r = NextResponse.json(data, { status: res.status, headers: { "cache-control": "no-store" } });
  for (const c of setCookies || []) r.headers.append("set-cookie", c);
  return r;
}
TS

cat > "$ROOT/frontend/src/app/api/media/commit/route.ts" <<'TS'
import { NextResponse } from "next/server";
import { resolveStubViewer } from "@/src/lib/server/stubViewer";
import { proxyJson } from "@/src/app/api/auth/_proxy";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function withDevViewer(req: Request): Request {
  if (process.env.NODE_ENV === "production") return req;
  const r = resolveStubViewer(req);
  if (!r.viewerId) return req;
  const h = new Headers(req.headers);
  h.set("x-sd-viewer", r.viewerId);
  return new Request(req.url, { method: req.method, headers: h });
}

// POST /api/media/commit -> Django POST /api/media/commit
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const req2 = withDevViewer(req);
  const out = await proxyJson(req2, "/api/media/commit", "POST", body);
  if (out instanceof NextResponse) return out;

  const { res, data, setCookies } = out;
  const r = NextResponse.json(data, { status: res.status, headers: { "cache-control": "no-store" } });
  for (const c of setCookies || []) r.headers.append("set-cookie", c);
  return r;
}
TS

echo "OK: sd_460 applied."
echo "Backup: $BK"
echo "Next:"
echo "  cd frontend && npm run typecheck"
echo "  cd frontend && npm run build"
