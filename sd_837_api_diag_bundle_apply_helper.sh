#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_837_api_diag_bundle"
TS="$(date +%Y%m%d_%H%M%S)"

find_repo_root() {
  local d="$PWD"
  while [[ "$d" != "/" ]]; do
    if [[ -d "$d/frontend" ]] && [[ -d "$d/backend" ]] && [[ -d "$d/scripts" ]]; then
      echo "$d"
      return 0
    fi
    d="$(cd "$d/.." && pwd)"
  done
  return 1
}

ROOT="$(find_repo_root || true)"
if [[ -z "${ROOT:-}" ]]; then
  echo "ERROR: Run from inside the repo (must contain ./frontend ./backend ./scripts)." >&2
  echo "Tip: cd /Users/cn/Downloads/sidesroot" >&2
  exit 1
fi

cd "$ROOT"

NEXT_CFG="frontend/next.config.js"
DIAG_DIR="frontend/src/app/api/diag"
DIAG_FILE="${DIAG_DIR}/route.ts"

BK=".backup_${SD_ID}_${TS}"
mkdir -p "$BK/frontend/src/app/api"
mkdir -p "$BK/frontend"

if [[ -f "$NEXT_CFG" ]]; then
  cp -a "$NEXT_CFG" "$BK/frontend/next.config.js"
fi
if [[ -f "$DIAG_FILE" ]]; then
  mkdir -p "$BK/${DIAG_DIR}"
  cp -a "$DIAG_FILE" "$BK/${DIAG_FILE}"
fi

mkdir -p "$DIAG_DIR"

cat > "$DIAG_FILE" <<'EOF'
import { NextResponse } from "next/server";

// sd_837_api_diag_bundle
// Route: /api/diag (JSON)
// Legacy: /api/_diag (rewritten to /api/diag via next.config.js)
//
// In production, returns 404 unless SIDDES_DIAG_ENABLED=1.

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Probe = { url: string; ok: boolean; status?: number; ms?: number; error?: string };

function normalizeOrigin(raw: string | undefined | null): string | null {
  const s = String(raw || "").trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.origin;
  } catch {
    return null;
  }
}

async function probe(url: string, timeoutMs = 1200): Promise<Probe> {
  const started = Date.now();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: ctrl.signal,
      headers: { accept: "application/json, text/plain, */*" },
    });
    return { url, ok: res.ok, status: res.status, ms: Date.now() - started };
  } catch (e: any) {
    return { url, ok: false, ms: Date.now() - started, error: String(e?.message || e) };
  } finally {
    clearTimeout(t);
  }
}

function envFlag(name: string): boolean {
  return String(process.env[name] || "").trim() !== "";
}

export async function GET() {
  const isProd = process.env.NODE_ENV === "production";
  const allowProd = String(process.env.SIDDES_DIAG_ENABLED || "").trim() === "1";
  if (isProd && !allowProd) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const rawInternal = normalizeOrigin(process.env.SD_INTERNAL_API_BASE);
  const rawPublic = normalizeOrigin(process.env.NEXT_PUBLIC_API_BASE);

  const candidates: Array<{ origin: string; source: string }> = [];
  if (rawInternal) candidates.push({ origin: rawInternal, source: "SD_INTERNAL_API_BASE" });

  // Dev-only fallbacks (helpful for local debugging)
  if (!isProd) {
    candidates.push({ origin: "http://backend:8000", source: "dev_default_backend_service" });
    candidates.push({ origin: "http://127.0.0.1:8000", source: "dev_loopback_127" });
    candidates.push({ origin: "http://localhost:8000", source: "dev_loopback_localhost" });
    if (rawPublic) candidates.push({ origin: rawPublic, source: "NEXT_PUBLIC_API_BASE" });
  }

  // De-dupe by origin
  const uniq: Array<{ origin: string; source: string }> = [];
  const seen = new Set<string>();
  for (const c of candidates) {
    if (seen.has(c.origin)) continue;
    seen.add(c.origin);
    uniq.push(c);
  }

  const tried: Probe[] = [];
  let chosen: { origin: string; source: string } | null = null;
  let healthz: Probe | null = null;

  for (const c of uniq) {
    const url = c.origin.replace(/\/+$/, "") + "/healthz";
    const p = await probe(url, 1200);
    tried.push(p);
    if (p.ok) {
      chosen = c;
      healthz = p;
      break;
    }
  }

  const payload = {
    ok: true,
    now: new Date().toISOString(),
    env: {
      NODE_ENV: process.env.NODE_ENV || "development",
      has_SD_INTERNAL_API_BASE: envFlag("SD_INTERNAL_API_BASE"),
      has_NEXT_PUBLIC_API_BASE: envFlag("NEXT_PUBLIC_API_BASE"),
      SIDDES_DIAG_ENABLED: allowProd ? "1" : "0",
    },
    resolved: {
      chosenBase: chosen?.origin || null,
      source: chosen?.source || null,
      candidates: uniq,
    },
    healthz,
    tried,
  };

  return NextResponse.json(payload, { status: 200, headers: { "cache-control": "no-store" } });
}
EOF

python3 - <<'PY'
from pathlib import Path
import re

p = Path("frontend/next.config.js")
s = p.read_text(encoding="utf-8")

# If mapping already exists, do nothing.
if "/api/_diag" in s and "/api/diag" in s:
    print("OK: next.config.js already references /api/_diag -> /api/diag.")
    raise SystemExit(0)

# If rewrites() exists, attempt to inject mapping into its return array.
if re.search(r"\basync\s+rewrites\s*\(", s):
    m = re.search(r"async\s+rewrites\s*\(\s*\)\s*\{\s*return\s*\[", s)
    if not m:
        print("WARN: rewrites() exists but could not locate 'return [' to auto-inject. Add manually: /api/_diag -> /api/diag")
        raise SystemExit(0)
    ins = '{ source: "/api/_diag", destination: "/api/diag" }, '
    if ins in s:
        print("OK: mapping already present in rewrites.")
        raise SystemExit(0)
    s = s[:m.end()] + ins + s[m.end():]
    p.write_text(s, encoding="utf-8")
    print("OK: injected mapping into existing rewrites()")
    raise SystemExit(0)

# No rewrites() exists: insert a new rewrites() block before async headers()
idx = s.find("async headers()")
if idx == -1:
    raise SystemExit("ERROR: Could not find 'async headers()' in next.config.js. Unexpected format.")

block = """async rewrites() {
    return [
      { source: "/api/_diag", destination: "/api/diag" },
    ];
  },

"""

s = s[:idx] + block + s[idx:]
p.write_text(s, encoding="utf-8")
print("OK: inserted rewrites() mapping /api/_diag -> /api/diag")
PY

echo ""
echo "✅ DONE: ${SD_ID}"
echo "Backup: ${BK}"
echo ""
echo "Next:"
echo "  1) Restart frontend (docker dev):"
echo "     docker compose -f ops/docker/docker-compose.dev.yml up -d --build frontend"
echo ""
echo "  2) Verify (should be JSON, not HTML):"
echo "     curl -s http://localhost:3000/api/_diag | head -n 40"
echo "     curl -s http://localhost:3000/api/diag  | head -n 40"
echo ""
echo "Prod safety:"
echo "  - /api/diag returns 404 in production unless SIDDES_DIAG_ENABLED=1"
