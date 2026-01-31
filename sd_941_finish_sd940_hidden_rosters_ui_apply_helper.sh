#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_941_finish_sd940_hidden_rosters_ui"

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

FILES=(
  "frontend/src/app/u/[username]/followers/page.tsx"
  "frontend/src/app/u/[username]/following/page.tsx"
  "frontend/src/components/ProfileV2Header.tsx"
)

for f in "${FILES[@]}"; do
  if [ ! -f "$f" ]; then
    echo "❌ Missing: $f"
    echo "Run from repo root (folder containing frontend/ and backend/)."
    exit 1
  fi
done

TS="$(date +%Y%m%d_%H%M%S)"
BK_DIR=".backup_${SD_ID}_${TS}"
mkdir -p "$BK_DIR"
for f in "${FILES[@]}"; do
  mkdir -p "$BK_DIR/$(dirname "$f")"
  cp -a "$f" "$BK_DIR/$f"
done

echo "== ${SD_ID} =="
echo "Backup: $BK_DIR"
echo ""

python3 - <<'PY'
from pathlib import Path
import re

def write_if_changed(p: Path, s: str, orig: str):
    if s != orig:
        p.write_text(s, encoding="utf-8")
        print("✅ Patched:", p.as_posix())
    else:
        print("ℹ️ No change:", p.as_posix())

def ensure_lock_import(s: str) -> str:
    # Common case in these pages:
    if 'import { ChevronLeft } from "lucide-react";' in s and "Lock" not in s:
        return s.replace('import { ChevronLeft } from "lucide-react";',
                         'import { ChevronLeft, Lock } from "lucide-react";', 1)

    # Generic lucide import injection
    m = re.search(r'import\s*\{([^}]*)\}\s*from\s*"lucide-react";', s)
    if not m:
        return s
    inside = m.group(1)
    if "Lock" in inside:
        return s
    parts = [x.strip() for x in inside.split(",") if x.strip()]
    parts.append("Lock")
    seen = set()
    out = []
    for x in parts:
        k = x.lower()
        if k in seen:
            continue
        seen.add(k)
        out.append(x)
    repl = f'import {{ {", ".join(out)} }} from "lucide-react";'
    return s[:m.start()] + repl + s[m.end():]

def patch_follow_page(path: str, mode: str):
    # mode: "followers" or "following"
    p = Path(path)
    s = p.read_text(encoding="utf-8")
    orig = s

    s = ensure_lock_import(s)

    # 1) Add hidden?: boolean to response type
    if "type FollowResp" in s and "hidden?: boolean" not in s:
        if "  error?: string;" in s:
            s = s.replace("  error?: string;\n", "  error?: string;\n  hidden?: boolean;\n", 1)
        else:
            s = s.replace("  ok: boolean;\n", "  ok: boolean;\n  hidden?: boolean;\n", 1)

    # 2) Add hidden state after total
    if "const [hidden, setHidden]" not in s:
        needle = "  const [total, setTotal] = useState<number | null>(null);\n"
        if needle in s:
            s = s.replace(needle, needle + "\n  const [hidden, setHidden] = useState(false);\n", 1)

    # 3) Reset hidden at start of load()
    if "setHidden(false);" not in s and "setTrouble(null);" in s:
        s = s.replace("      setTrouble(null);\n", "      setTrouble(null);\n      setHidden(false);\n", 1)

    # 4) Read hidden from response and early return (counts-only)
    if "const isHidden = !!(j as any).hidden;" not in s:
        s = s.replace(
            "        const got = Array.isArray(j.items) ? j.items : [];\n",
            "        const isHidden = !!(j as any).hidden;\n"
            "        setHidden(isHidden);\n\n"
            "        const got = Array.isArray(j.items) ? j.items : [];\n",
            1,
        )

    if "if (isHidden)" not in s:
        anchor = '        setNextCursor(String(j.nextCursor || "").trim() || null);\n'
        if anchor in s:
            s = s.replace(
                anchor,
                anchor +
                "\n"
                "        if (isHidden) {\n"
                "          if (!isMore) setItems([]);\n"
                "          setNextCursor(null);\n"
                "          return;\n"
                "        }\n",
                1,
            )

    # 5) Render hidden branch (before items.length)
    if "This list is hidden" not in s:
        marker = ") : items.length ? ("
        if marker in s:
            s = s.replace(
                marker,
                """) : hidden ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-black text-gray-900">
              <Lock size={16} className="text-gray-400" /> This list is hidden
            </div>
            <div className="text-xs text-gray-500 mt-1">Only the owner can see the names. Counts may still be visible.</div>
          </div>
        ) : items.length ? (""",
                1,
            )

    # 6) UI copy + title lock (optional but nice)
    if mode == "followers":
        s = s.replace(
            '<div className="text-lg font-black text-gray-900">Followers</div>',
            '<div className="text-lg font-black text-gray-900 flex items-center gap-2">Siders {hidden ? <Lock size={16} className="text-gray-300" /> : null}</div>',
            1,
        )
        s = s.replace(
            "Public followers (does not grant Friends/Close/Work access).",
            "Public Siders (Public Side only; does not grant Friends/Close/Work access).",
            1,
        )
        s = s.replace("Couldn’t load followers", "Couldn’t load siders")
        s = s.replace("No followers yet.", "No siders yet.")
    else:
        s = s.replace(
            '<div className="text-lg font-black text-gray-900">Following</div>',
            '<div className="text-lg font-black text-gray-900 flex items-center gap-2">Side With {hidden ? <Lock size={16} className="text-gray-300" /> : null}</div>',
            1,
        )
        s = s.replace(
            "Public following (does not grant Friends/Close/Work access).",
            "People you side with in Public (Public Side only; does not grant Friends/Close/Work access).",
            1,
        )
        s = s.replace("Couldn’t load following", "Couldn’t load Side With list")
        s = s.replace("Not following anyone yet.", "You aren’t siding with anyone yet.")

    if "sd_941_finish_sd940_hidden_rosters_ui" not in s:
        s += "\n\n// sd_941_finish_sd940_hidden_rosters_ui\n"

    write_if_changed(p, s, orig)

def patch_profile_header_labels():
    p = Path("frontend/src/components/ProfileV2Header.tsx")
    s = p.read_text(encoding="utf-8")
    orig = s
    # Only change labels if they exist (safe)
    s = s.replace('label="Followers"', 'label="Siders"')
    s = s.replace('label="Following"', 'label="Side With"')
    if "sd_941_finish_sd940_hidden_rosters_ui" not in s:
        s += "\n\n// sd_941_finish_sd940_hidden_rosters_ui\n"
    write_if_changed(p, s, orig)

patch_follow_page("frontend/src/app/u/[username]/followers/page.tsx", "followers")
patch_follow_page("frontend/src/app/u/[username]/following/page.tsx", "following")
patch_profile_header_labels()
PY

echo ""
echo "✅ ${SD_ID} applied."
echo ""
echo "Next:"
echo "  cd frontend && npm run typecheck && npm run build"
echo "  cd .."
echo "  docker compose -f ops/docker/docker-compose.dev.yml exec backend python manage.py migrate"
echo "  docker compose -f ops/docker/docker-compose.dev.yml restart backend"
echo "  bash scripts/run_tests.sh --smoke"
