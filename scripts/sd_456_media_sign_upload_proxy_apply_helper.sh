#!/usr/bin/env bash
set -euo pipefail

ROOT="$PWD"
if [ ! -d "$ROOT/frontend" ] || [ ! -d "$ROOT/backend" ]; then
  echo "ERROR: run from repo root (must contain frontend/ and backend/)" >&2
  exit 1
fi

TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.backup_sd_456_media_sign_upload_proxy_$TS"
mkdir -p "$BK"

mkdir -p "$ROOT/frontend/src/app/api/media/sign-upload"
# backup if exists
if [ -f "$ROOT/frontend/src/app/api/media/sign-upload/route.ts" ]; then
  cp "$ROOT/frontend/src/app/api/media/sign-upload/route.ts" "$BK/route.ts"
fi

cat > "$ROOT/frontend/src/app/api/media/sign-upload/route.ts" <<'TS'
import { NextResponse } from "next/server";
import { proxyJson } from "@/src/app/api/auth/_proxy";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// POST /api/media/sign-upload -> Django POST /api/media/sign-upload
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const out = await proxyJson(req, "/api/media/sign-upload", "POST", body);
  if (out instanceof NextResponse) return out;

  const { res, data, setCookies } = out;
  const r = NextResponse.json(data, { status: res.status, headers: { "cache-control": "no-store" } });
  for (const c of setCookies || []) r.headers.append("set-cookie", c);
  return r;
}
TS

echo "OK: sd_456 applied."
echo "Backup: $BK"
echo "Next:"
echo "  cd frontend && npm run typecheck && npm run build"
