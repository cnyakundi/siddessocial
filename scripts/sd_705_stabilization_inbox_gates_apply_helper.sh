#!/usr/bin/env bash
set -euo pipefail

# sd_705_stabilization_inbox_gates_apply_helper.sh
# Run from repo root.

ROOT="$(pwd)"
if [[ ! -f "$ROOT/verify_overlays.sh" ]]; then
  if git rev-parse --show-toplevel >/dev/null 2>&1; then
    ROOT="$(git rev-parse --show-toplevel)"
    cd "$ROOT"
  else
    echo "ERROR: run this from the repo root (where verify_overlays.sh exists)."
    exit 1
  fi
fi

STAMP="$(date +%Y%m%d_%H%M%S)"
BK=".backup_sd_705_stabilization_inbox_gates_${STAMP}"
mkdir -p "$BK"

backup() {
  local f="$1"
  if [[ -f "$f" ]]; then
    mkdir -p "$BK/$(dirname "$f")"
    cp -a "$f" "$BK/$f"
  fi
}

echo "== sd_705: backing up touched files to $BK =="
backup "frontend/src/app/siddes-inbox/page.tsx"
backup "frontend/src/app/siddes-inbox/[id]/page.tsx"
backup "frontend/src/app/api/inbox/thread/[id]/route.ts"
backup "frontend/src/app/api/inbox/threads/route.ts"
backup "ops/docker/.env.example"

python3 - <<'PY'
import re
from pathlib import Path

ROOT = Path(".").resolve()

def read(p: str) -> str:
    return (ROOT / p).read_text(encoding="utf-8")

def write(p: str, s: str):
    (ROOT / p).parent.mkdir(parents=True, exist_ok=True)
    (ROOT / p).write_text(s, encoding="utf-8")

def ensure_contains(s: str, needle: str, msg: str):
    if needle not in s:
        raise SystemExit(f"PATCH ERROR: {msg}")

# --------------------------------------------------------------------
# 1) ops/docker/.env.example (required by multiple overlay checks)
# --------------------------------------------------------------------
env_example = """# Siddes – Docker dev environment (example)
#
# Used by:
# - ops/docker/docker-compose.dev.yml (env_file: .env)
# - scripts/dev/_autoload_docker_env.sh (auto-copies .env.example -> .env)

# Ports
SIDDES_BACKEND_PORT=8000
SIDDES_FRONTEND_PORT=3000

# Frontend -> Backend (host)
NEXT_PUBLIC_API_BASE=http://localhost:8000

# Next.js route proxies -> Backend (docker network)
SD_INTERNAL_API_BASE=http://backend:8000

# Inbox store toggles (sd_124)
# Options: memory | db | auto
SD_INBOX_STORE=auto
SD_INBOX_DUALWRITE_DB=0

# Public trust gates (sd_133)
NEXT_PUBLIC_SD_PUBLIC_TRUST_GATES=1
"""
write("ops/docker/.env.example", env_example)

# --------------------------------------------------------------------
# 2) frontend/src/app/siddes-inbox/page.tsx
#    - pins UI + pinned-first sort
#    - search placeholder must be "Search threads"
# --------------------------------------------------------------------
p = "frontend/src/app/siddes-inbox/page.tsx"
s = read(p)

# Import inboxPins
if 'from "@/src/lib/inboxPins"' not in s:
    anchor = 'import { ensureThreadLockedSide, loadThread, loadThreadMeta } from "@/src/lib/threadStore";\n'
    ensure_contains(s, anchor, f"{p}: expected threadStore import anchor not found")
    s = s.replace(anchor, anchor + 'import { loadPinnedSet, togglePinned } from "@/src/lib/inboxPins";\n')

# Ensure search placeholder string matches required check
s = s.replace('placeholder="Search"', 'placeholder="Search threads"')

# Insert pinnedIds state after threads state
threads_line = '  const [threads, setThreads] = useState<InboxThreadItem[]>([]);\n'
ensure_contains(s, threads_line, f"{p}: threads state line not found")
if "const [pinnedIds, setPinnedIds]" not in s:
    insert = (
        threads_line +
        "  // sd_705: local inbox pins (client-only)\n"
        "  const [pinnedIds, setPinnedIds] = useState<string[]>([]);\n\n"
        "  useEffect(() => {\n"
        "    // Load pins after hydration to avoid SSR/localStorage mismatch.\n"
        "    setPinnedIds(Array.from(loadPinnedSet()));\n"
        "  }, []);\n\n"
        "  const togglePin = (threadId: string) => {\n"
        "    try {\n"
        "      togglePinned(threadId);\n"
        "    } finally {\n"
        "      // Re-sync from storage (single source of truth).\n"
        "      setPinnedIds(Array.from(loadPinnedSet()));\n"
        "    }\n"
        "  };\n\n"
    )
    s = s.replace(threads_line, insert)

# Ensure useMemo items typed any[] so pinned property is safe
s = re.sub(
    r"const filtered = useMemo\(\(\) => {\n\s*let items = threads;",
    "const filtered = useMemo(() => {\n    let items: any[] = threads as any[];",
    s,
    count=1,
)

# Replace recency-only sort with pinned-first sort (required grep: a.pinned !== b.pinned)
sort_line = "    // sd_573: sort by most-recent activity (prevents regressions + satisfies check)\n    items = [...items].sort((a, b) => sortTs(b) - sortTs(a));\n"
if "a.pinned !== b.pinned" not in s:
    ensure_contains(s, sort_line, f"{p}: expected recency sort line not found")
    sort_block = (
        "    // sd_573: sort by most-recent activity (prevents regressions + satisfies check)\n"
        "    // sd_705: local pins (pinned-first) + then recency.\n"
        "    const pinnedSet = new Circle(pinnedIds);\n"
        "    const withPins = items.map((t) => ({ ...(t as any), pinned: pinnedSet.has(String((t as any).id || \"\")) }));\n\n"
        "    items = [...withPins].sort((a, b) => {\n"
        "      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;\n"
        "      return sortTs(b) - sortTs(a);\n"
        "    });\n"
    )
    s = s.replace(sort_line, sort_block)

# Ensure deps include pinnedIds
s = re.sub(r"\[threads, query, advanced, filter, side\]\);", "[threads, query, advanced, filter, side, pinnedIds]);", s, count=1)

# Insert pin button before unread dot (required grep: aria-label={t.pinned ? "Unpin thread" : "Pin thread"})
unread_line = '                {t.unread > 0 ? <span className="w-2 h-2 rounded-full bg-red-500" aria-label="Unread" /> : null}\n'
ensure_contains(s, 'aria-label="Clear search"', f"{p}: sanity (clear search) missing")
if 'aria-label={t.pinned ? "Unpin thread" : "Pin thread"}' not in s:
    ensure_contains(s, unread_line, f"{p}: unread dot line not found for pin insertion")
    pin_btn = (
        "                <button\n"
        "                  type=\"button\"\n"
        "                  onClick={(e) => {\n"
        "                    e.preventDefault();\n"
        "                    e.stopPropagation();\n"
        "                    togglePin(t.id);\n"
        "                  }}\n"
        "                  aria-label={t.pinned ? \"Unpin thread\" : \"Pin thread\"}\n"
        "                  className={cn(\n"
        "                    \"px-2 py-1 rounded-full border text-[11px] font-extrabold flex-shrink-0\",\n"
        "                    t.pinned\n"
        "                      ? \"bg-gray-900 text-white border-gray-900\"\n"
        "                      : \"bg-white text-gray-700 border-gray-200 hover:bg-gray-50\"\n"
        "                  )}\n"
        "                  title={t.pinned ? \"Unpin\" : \"Pin\"}\n"
        "                >\n"
        "                  {t.pinned ? \"Pinned\" : \"Pin\"}\n"
        "                </button>\n"
    )
    s = s.replace(unread_line, pin_btn + unread_line)

# Final required patterns for overlay checks
ensure_contains(s, 'placeholder="Search threads"', f"{p}: search placeholder not updated")
ensure_contains(s, 'aria-label={t.pinned ? "Unpin thread" : "Pin thread"}', f"{p}: pin aria-label missing")
ensure_contains(s, "a.pinned !== b.pinned", f"{p}: pinned-first sort missing")

write(p, s)

# --------------------------------------------------------------------
# 3) frontend/src/app/siddes-inbox/[id]/page.tsx
#    - fix AbortController scope (ac undefined)
#    - restricted banner actions + testids
# --------------------------------------------------------------------
p = "frontend/src/app/siddes-inbox/[id]/page.tsx"
s = read(p)

# Insert AbortController into the thread-load effect (the one that calls setRestricted(false))
pat = r"(useEffect\(\(\) => {\n\s*let alive = true;\n\n)(\s*setRestricted\(false\);)"
if re.search(pat, s) and "signal: ac.signal" in s:
    s2 = re.sub(pat, r"\1    const ac = new AbortController();\n\n\2", s, count=1)
    # Ensure cleanup aborts
    s2 = s2.replace(
        "    return () => {\n      alive = false;\n    };",
        "    return () => {\n      alive = false;\n      try { ac.abort(); } catch {}\n    };",
        1,
    )
    s = s2

# Restricted banner actions (replace the simple actions div inside the restricted banner)
if 'data-testid="restricted-thread-actions"' not in s:
    rx = re.compile(r'<div className="flex gap-2 flex-wrap">\s*<Link\s*data-testid="restricted-thread-back-inbox"[\s\S]*?</Link>\s*</div>', re.M)
    m = rx.search(s)
    if not m:
        raise SystemExit(f"PATCH ERROR: {p}: could not locate restricted banner actions block")
    repl = '''<div data-testid="restricted-thread-actions" className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  data-testid="restricted-thread-retry-me"
                  onClick={() => {
                    setViewerInput("me");
                    if (typeof window !== "undefined") window.location.reload();
                  }}
                  className="px-3 py-1.5 rounded-full bg-white border border-amber-200 text-amber-900 text-xs font-black hover:bg-amber-100"
                >
                  Restricted — retry as me
                </button>

                <button
                  type="button"
                  data-testid="restricted-thread-clear-viewer"
                  onClick={() => {
                    setViewerInput("");
                    if (typeof window !== "undefined") window.location.reload();
                  }}
                  className="px-3 py-1.5 rounded-full bg-white border border-amber-200 text-amber-900 text-xs font-black hover:bg-amber-100"
                >
                  Clear viewer override
                </button>

                <Link
                  data-testid="restricted-thread-back-inbox"
                  href="/siddes-inbox"
                  className="px-3 py-1.5 rounded-full bg-white border border-amber-200 text-amber-900 text-xs font-bold hover:bg-amber-100"
                >
                  Back to Inbox
                </Link>
              </div>'''
    s = rx.sub(repl, s, count=1)

# Ensure required testids exist
for need in [
    'data-testid="restricted-thread-banner"',
    'data-testid="restricted-thread-actions"',
    'data-testid="restricted-thread-retry-me"',
    'data-testid="restricted-thread-clear-viewer"',
    'data-testid="restricted-thread-back-inbox"',
    'Restricted — retry as me',
]:
    ensure_contains(s, need, f"{p}: missing required restricted banner element: {need}")

write(p, s)

# --------------------------------------------------------------------
# 4) frontend/src/app/api/inbox/thread/[id]/route.ts
#    - add parseCursor (pagination check)
#    - add deriveThreadTitle (title sync check)
# --------------------------------------------------------------------
p = "frontend/src/app/api/inbox/thread/[id]/route.ts"
s = read(p)

if "function parseCursor" not in s:
    anchor = "function restrictedSendPayload() {\n"
    ensure_contains(s, anchor, f"{p}: restrictedSendPayload anchor not found")
    parse_fn = (
        "function parseCursor(raw: string | null): string | null {\n"
        "  const s = String(raw || \"\").trim();\n"
        "  if (!s) return null;\n"
        "  // Default-safe: keep cursor small.\n"
        "  if (s.length > 256) return s.slice(0, 256);\n"
        "  return s;\n"
        "}\n\n"
    )
    s = s.replace(anchor, parse_fn + anchor)

# Use parseCursor for cursor param
s = s.replace(
    '  const cursor = String(url.searchParams.get("cursor") || "").trim();\n',
    '  const cursor = parseCursor(url.searchParams.get("cursor"));\n'
)

# Title sync helpers (deriveThreadTitle must exist + be used)
if "function deriveThreadTitle" not in s:
    # Insert helpers near the top (after parseCursor is fine)
    insert_at = "function restrictedSendPayload() {\n"
    idx = s.find(insert_at)
    ensure_contains(s, insert_at, f"{p}: insert point not found for title helpers")
    helpers = (
        "function isGenericTitle(title: string): boolean {\n"
        "  const t = String(title || \"\").trim();\n"
        "  if (!t) return true;\n"
        "  const low = t.toLowerCase();\n"
        "  if (low === \"thread\" || low === \"conversation\") return true;\n"
        "  if (low.startsWith(\"thread \")) return true;\n"
        "  return false;\n"
        "}\n\n"
        "function _normWs(s: string): string {\n"
        "  return String(s || \"\").replace(/\\s+/g, \" \").trim();\n"
        "}\n\n"
        "function deriveThreadTitle(thread: any, messages: any[] | null | undefined): string {\n"
        "  const current = String(thread?.title || \"\").trim();\n"
        "  if (current && !isGenericTitle(current)) return current;\n"
        "  const msgs = Array.isArray(messages) ? messages : [];\n"
        "  const first = msgs.length ? _normWs(String(msgs[0]?.text || \"\")) : \"\";\n"
        "  const lastMsg = msgs.length ? _normWs(String(msgs[msgs.length - 1]?.text || \"\")) : \"\";\n"
        "  const last = _normWs(String((thread as any)?.last || \"\"));\n"
        "  const id = String((thread as any)?.id || \"\").trim();\n"
        "  const candidate = first || lastMsg || last || id || \"Thread\";\n"
        "  return candidate.length > 32 ? candidate.slice(0, 32).trim() + \"…\" : candidate;\n"
        "}\n\n"
    )
    s = s[:idx] + helpers + s[idx:]

# Apply deriveThreadTitle to data.thread in GET
if "deriveThreadTitle" in s and "fillThreadParticipant" in s:
    # Ensure we set title after participant fill
    # Replace the existing fillThreadParticipant block with derived title.
    s = re.sub(
        r'if \(data && typeof data === "object" && \(data as any\)\.thread\) {\n\s*\(data as any\)\.thread = fillThreadParticipant\(\(data as any\)\.thread\);\n\s*}\n',
        'if (data && typeof data === "object" && (data as any).thread) {\n    const t = fillThreadParticipant((data as any).thread);\n    const title = deriveThreadTitle(t, (data as any).messages);\n    (data as any).thread = { ...(t as any), title };\n  }\n',
        s,
        count=1
    )

# Required strings for overlay checks
ensure_contains(s, "messagesHasMore", f"{p}: messagesHasMore missing")
ensure_contains(s, "messagesNextCursor", f"{p}: messagesNextCursor missing")
ensure_contains(s, "parseCursor", f"{p}: parseCursor missing")
ensure_contains(s, "deriveThreadTitle", f"{p}: deriveThreadTitle missing")

write(p, s)

# --------------------------------------------------------------------
# 5) frontend/src/app/api/inbox/threads/route.ts
#    - title sync helpers (isGenericTitle + deriveThreadTitle) and apply to items
# --------------------------------------------------------------------
p = "frontend/src/app/api/inbox/threads/route.ts"
s = read(p)

if "function deriveThreadTitle" not in s:
    # Insert helpers after fillParticipant() ends
    end_marker = "  return { ...t, participant };\n}\n"
    idx = s.find(end_marker)
    ensure_contains(s, end_marker, f"{p}: fillParticipant end marker not found")
    idx += len(end_marker)
    helpers = (
        "\nfunction isGenericTitle(title: string): boolean {\n"
        "  const t = String(title || \"\").trim();\n"
        "  if (!t) return true;\n"
        "  const low = t.toLowerCase();\n"
        "  if (low === \"thread\" || low === \"conversation\") return true;\n"
        "  if (low.startsWith(\"thread \")) return true;\n"
        "  return false;\n"
        "}\n\n"
        "function _normWs(s: string): string {\n"
        "  return String(s || \"\").replace(/\\s+/g, \" \").trim();\n"
        "}\n\n"
        "function deriveThreadTitle(thread: any): string {\n"
        "  const current = String(thread?.title || \"\").trim();\n"
        "  if (current && !isGenericTitle(current)) return current;\n"
        "  const first = _normWs(String((thread as any)?.first || \"\"));\n"
        "  const last = _normWs(String((thread as any)?.last || \"\"));\n"
        "  const id = String((thread as any)?.id || \"\").trim();\n"
        "  const candidate = first || last || id || \"Thread\";\n"
        "  return candidate.length > 32 ? candidate.slice(0, 32).trim() + \"…\" : candidate;\n"
        "}\n"
    )
    s = s[:idx] + helpers + s[idx:]

# Apply deriveThreadTitle in items mapping (required by title sync check)
if "deriveThreadTitle" in s:
    s = re.sub(
        r"\(data as any\)\.items = \(data as any\)\.items\.map\(\(t: any\) => fillParticipant\(t\)\);",
        "(data as any).items = (data as any).items.map((t: any) => {\n      const t2 = fillParticipant(t);\n      const title = deriveThreadTitle(t2);\n      return { ...(t2 as any), title };\n    });",
        s,
        count=1
    )

ensure_contains(s, "deriveThreadTitle", f"{p}: deriveThreadTitle missing")
ensure_contains(s, "isGenericTitle", f"{p}: isGenericTitle missing")
write(p, s)

print("✅ sd_705 patch set applied")
PY

echo ""
echo "== Running gate: ./verify_overlays.sh =="
./verify_overlays.sh

echo ""
echo "== Next commands (copy/paste) =="
echo "./scripts/run_tests.sh"
echo "cd frontend && npm run typecheck && npm run build"
echo ""
