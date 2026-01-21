#!/usr/bin/env bash
set -euo pipefail

# sd_452: Fix media upload proxy + CSP for R2, and stop composer from re-saving drafts after successful post/queue.

find_repo_root() {
  local d="$PWD"
  while [ "$d" != "/" ]; do
    if [ -d "$d/frontend" ] && [ -d "$d/backend" ] && [ -d "$d/ops" ]; then
      echo "$d"
      return 0
    fi
    d="$(cd "$d/.." && pwd)"
  done
  return 1
}

ROOT="$(find_repo_root || true)"
if [ -z "${ROOT:-}" ]; then
  echo "ERROR: run this from inside the repo (must contain frontend/, backend/, ops/)." >&2
  exit 1
fi

TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.backup_sd_452_media_upload_csp_and_compose_draft_fix_$TS"
mkdir -p "$BK"

echo "Backup dir: $BK"
cp "$ROOT/frontend/next.config.js" "$BK/next.config.js"
cp "$ROOT/frontend/src/app/siddes-compose/client.tsx" "$BK/siddes-compose_client.tsx"

echo "== Patch: frontend CSP to allow R2 for img/media =="

cat > "$ROOT/frontend/next.config.js" <<'EOF'
/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production";

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
];

// CSP-lite: compatible with Next.js without nonce plumbing.
// Tighten further once you add nonces/hashes.
const enableGoogleGSI = Boolean(String(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "").trim());

// Optional extra connect-src allowlist (space- or comma-separated), e.g.
// NEXT_PUBLIC_CSP_CONNECT_EXTRA="https://uploads.example.com https://cdn.example.com"
const extraConnectRaw = String(process.env.NEXT_PUBLIC_CSP_CONNECT_EXTRA || "").trim();
const extraConnect = extraConnectRaw
  ? extraConnectRaw
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
  : [];

// NOTE: Google Identity Services requires explicit allowlisting in CSP when enabled:
//   - script-src:  https://accounts.google.com/gsi/client
//   - frame-src:   https://accounts.google.com/gsi/
//   - connect-src: https://accounts.google.com/gsi/
//   - style-src:   https://accounts.google.com/gsi/style
//
// Cloudflare R2 direct uploads (presigned PUT URLs) require connect-src allowlisting.
const connectSrcAllow = [
  ...(enableGoogleGSI ? ["https://accounts.google.com/gsi/"] : []),
  // R2 S3 API endpoint domains (safe wildcard)
  "https://*.r2.cloudflarestorage.com",
  "https://*.r2.dev",
  ...extraConnect,
];

// Media is served either via:
// - Cloudflare Worker on the same origin (/m/*), OR
// - A short-lived redirect to an R2 signed URL (fallback).
// In both cases, we must allow R2 hosts for img/media loads.
const r2MediaAllow = [
  "https://*.r2.cloudflarestorage.com",
  "https://*.r2.dev",
];

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "img-src 'self' data: blob:" + (r2MediaAllow.length ? " " + r2MediaAllow.join(" ") : ""),
  "media-src 'self' data: blob:" + (r2MediaAllow.length ? " " + r2MediaAllow.join(" ") : ""),
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'" + (enableGoogleGSI ? " https://accounts.google.com/gsi/style" : ""),
  "script-src 'self' 'unsafe-inline'" + (enableGoogleGSI ? " https://accounts.google.com/gsi/client" : ""),
  "frame-src 'self'" + (enableGoogleGSI ? " https://accounts.google.com/gsi/" : ""),
  "connect-src 'self'" + (connectSrcAllow.length ? " " + connectSrcAllow.join(" ") : ""),
  "script-src-attr 'none'",
].join("; ");

const nextConfig = {
  reactStrictMode: true,
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  async headers() {
    const hdrs = [...securityHeaders];
    if (isProd) {
      hdrs.push({ key: "Content-Security-Policy", value: csp });
    }
    return [
      {
        source: "/(.*)",
        headers: hdrs,
      },
    ];
  },
};

module.exports = nextConfig;
EOF

echo "== Add: Next proxy route for /api/media/sign-upload =="

mkdir -p "$ROOT/frontend/src/app/api/media/sign-upload"

cat > "$ROOT/frontend/src/app/api/media/sign-upload/route.ts" <<'EOF'
import { NextResponse } from "next/server";
import { proxyJson } from "@/src/app/api/auth/_proxy";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// POST /api/media/sign-upload -> Django POST /api/media/sign-upload
// Same-origin proxy so the browser never calls Django cross-origin.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const out = await proxyJson(req, "/api/media/sign-upload", "POST", body);
  if (out instanceof NextResponse) return out;

  const { res, data, setCookies } = out;
  const r = NextResponse.json(data, { status: res.status, headers: { "cache-control": "no-store" } });
  for (const c of setCookies || []) {
    if (!c) continue;
    r.headers.append("set-cookie", c);
  }
  return r;
}
EOF

echo "== Patch: Compose close() should not re-save drafts after successful post/queue =="

COMPOSE="$ROOT/frontend/src/app/siddes-compose/client.tsx"
node <<'NODE'
const fs = require("fs");

const file = process.env.COMPOSE;
let s = fs.readFileSync(file, "utf8");

// 1) close() signature + skip-save behavior
if (!s.includes("skipSaveDraft")) {
  s = s.replace(
    /const close = \(\) => \{\s*\/\/ Never drop text silently\.\s*if \(\(text \|\| \"\"\)\.trim\(\)\) saveCurrentDraft\(\);\s*/m,
    "const close = (opts?: { skipSaveDraft?: boolean }) => {\\n    // Never drop text silently (unless we just successfully posted/queued).\\n    if (!opts?.skipSaveDraft && (text || \"\").trim()) saveCurrentDraft();\\n\\n"
  );

  // 2) After success/queue, use close({skipSaveDraft:true})
  s = s.replaceAll("close();", "close({ skipSaveDraft: true });");
}

if (!s.includes("skipSaveDraft")) {
  throw new Error("Patch did not apply cleanly (skipSaveDraft not found).");
}

fs.writeFileSync(file, s);
NODE

echo
echo "OK: sd_452 applied."
echo "Backup saved to: $BK"
echo
echo "Next steps:"
echo "  1) cd frontend && npm install && npm run build (or deploy)"
echo "  2) In Cloudflare R2, ensure CORS allows PUT from https://app.siddes.com"
