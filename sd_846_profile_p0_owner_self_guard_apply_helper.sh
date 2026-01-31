#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_846_profile_p0_owner_self_guard"
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

P_U="frontend/src/app/u/[username]/page.tsx"
P_PRISM="frontend/src/components/PrismProfile.tsx"

for f in "$P_U" "$P_PRISM"; do
  if [[ ! -f "$f" ]]; then
    echo "ERROR: Missing $f" >&2
    exit 1
  fi
done

BK=".backup_${SD_ID}_${TS}"
mkdir -p "$BK/$(dirname "$P_U")" "$BK/$(dirname "$P_PRISM")"
cp -a "$P_U" "$BK/$P_U"
cp -a "$P_PRISM" "$BK/$P_PRISM"

PYBIN=""
if command -v python3 >/dev/null 2>&1; then
  PYBIN="python3"
elif command -v python >/dev/null 2>&1; then
  PYBIN="python"
else
  echo "ERROR: python3 required." >&2
  exit 1
fi

"$PYBIN" - <<'PY'
from pathlib import Path
import re

# -----------------------------
# Patch PrismProfile.tsx
# -----------------------------
p = Path("frontend/src/components/PrismProfile.tsx")
s = p.read_text(encoding="utf-8")
orig = s

# A) Unhide PrismSideTabs buttons (ONLY inside PrismSideTabs function)
if "export function PrismSideTabs" in s:
    start = s.find("export function PrismSideTabs")
    nxt = s.find("\nexport function", start + 10)
    end = nxt if nxt != -1 else len(s)
    block = s[start:end]
    if "<button hidden" in block:
        block2 = block.replace("<button hidden", "<button")
        s = s[:start] + block2 + s[end:]

# B) SideActionButtons: add isSelf?: boolean and guard
if "export function SideActionButtons" in s:
    if "isSelf?:" not in s:
        s = re.sub(
            r'(export function SideActionButtons\s*\(props:\s*\{\s*\n\s*viewerSidedAs:\s*SideId\s*\|\s*null;\s*\n)',
            r'\1  isSelf?: boolean; // sd_846\n',
            s,
            count=1,
            flags=re.M,
        )

    if "sd_846_self_guard" not in s and "props.isSelf" not in s:
        s = re.sub(
            r'(export function SideActionButtons[\s\S]*?\{\s*\n\s*const\s*\{\s*viewerSidedAs\s*,\s*onOpenSheet\s*\}\s*=\s*props;\s*\n)',
            r'\1\n  // sd_846_self_guard: never show Add Friend / Side actions on your own profile\n  if (props.isSelf) return null;\n',
            s,
            count=1,
            flags=re.S,
        )

if s != orig:
    p.write_text(s, encoding="utf-8")
    print("OK: patched", p)
else:
    print("OK: PrismProfile.tsx no changes needed")

# -----------------------------
# Patch /u/[username]/page.tsx
# -----------------------------
p2 = Path("frontend/src/app/u/[username]/page.tsx")
t = p2.read_text(encoding="utf-8")
t0 = t

# 1) Import fetchMe
if 'import { fetchMe } from "@/src/lib/authMe";' not in t:
    anchor = 'import { toast } from "@/src/lib/toast";\n'
    if anchor in t:
        t = t.replace(anchor, anchor + 'import { fetchMe } from "@/src/lib/authMe";\n', 1)

# 2) Add meUsername state
if "meUsername" not in t:
    t = re.sub(
        r'(const \[accessReqSentFor,\s*setAccessReqSentFor\] = useState<SideId \| null>\(null\);\n)',
        r'\1\n  const [meUsername, setMeUsername] = useState<string>(""); // sd_846\n',
        t,
        count=1,
        flags=re.M,
    )

# 3) Add /me effect (insert after the first useEffect(..., []) block)
if "sd_846_owner_effect" not in t and "setMeUsername" in t and "fetchMe().catch" not in t:
    idx = t.find("}, []);")
    if idx != -1:
        insert_at = idx + len("}, []);")
        effect_lines = [
            "",
            "",
            "  // sd_846_owner_effect: defense-in-depth owner detection (server OR /api/auth/me match)",
            "  useEffect(() => {",
            "    let alive = true;",
            "",
            "    (async () => {",
            "      const me = await fetchMe().catch(() => ({ ok: false, authenticated: false } as any));",
            "      if (!alive) return;",
            "",
            '      const u = me?.authenticated && me?.user?.username ? String(me.user.username).trim().toLowerCase() : "";',
            "      setMeUsername(u);",
            "    })();",
            "",
            "    return () => {",
            "      alive = false;",
            "    };",
            "  }, []);",
            "",
        ]
        t = t[:insert_at] + "\n".join(effect_lines) + t[insert_at:]

# 4) Patch isOwner assignment
if "sd_846_isOwner_union" not in t:
    t = t.replace(
        "  const isOwner = !!(data as any)?.isOwner;\n",
        "\n".join([
            "  // sd_846_isOwner_union: treat isOwner as (server OR /api/auth/me match)",
            "  const serverIsOwner = !!(data as any)?.isOwner;",
            "  const meU = String(meUsername || \"\").replace(/^@/, \"\").trim().toLowerCase();",
            "  const handleU = String(handle || \"\").replace(/^@/, \"\").trim().toLowerCase();",
            "  const isOwnerByMe = Boolean(meU && handleU && meU === handleU);",
            "  const isOwner = serverIsOwner || isOwnerByMe;",
            "",
            "",
        ]),
        1,
    )

# 5) Pass isSelf into SideActionButtons
m = re.search(r'<SideActionButtons\b', t)
if m:
    window = t[m.start():m.start()+240]
    if "isSelf=" not in window:
        t = t.replace("<SideActionButtons ", "<SideActionButtons isSelf={isOwner} ", 1)

# 6) Hide Follow button on self
t = re.sub(r'\{\s*viewSide\s*===\s*"public"\s*\?\s*\(', r'{viewSide === "public" && !isOwner ? (', t, count=1)

# 7) Add self guard to mutation fns
def add_guard(fn_name: str):
    global t
    pat = re.compile(rf'(const {re.escape(fn_name)}\s*=\s*async[^\{{]*\{{\n\s+if\s*\(!user\?\.[^\)]*\)\s*return;\s*\n)', re.M)
    m = pat.search(t)
    if not m:
        return
    block = m.group(1)
    if "sd_846_self_guard" in block:
        return
    guard = '    // sd_846_self_guard: never target yourself\n    if (isOwner) { toast.error("That\\\'s you."); return; }\n\n'
    t = t.replace(block, block + guard, 1)

for fn in ["doToggleFollow", "doPickSide", "doRequestAccess", "doMessage"]:
    add_guard(fn)

# 8) Unhide About backdrops + website link + hidden close CTA (regex, indent-safe)
t = re.sub(
    r'<button\s+hidden(\s*\n\s*type="button"\s*\n\s*className="absolute inset-0 bg-black/30 backdrop-blur-sm")',
    r'<button\1',
    t,
    flags=re.M,
)

t = re.sub(
    r'<a\s+hidden(\s*\n\s*className="text-gray-900 font-extrabold hover:underline")',
    r'<a\1',
    t,
    flags=re.M,
)

t = re.sub(
    r'<button\s+hidden(\s*\n\s*type="button"\s*\n\s*onClick=\{\(\)\s*=>\s*setAboutOpen\(false\)\}\s*\n\s*className="w-full mt-5[^"]+")',
    r'<button\1',
    t,
    flags=re.M,
)

# 9) Dedupe nested bg-white wrapper
t = re.sub(r'(<div className="bg-white">\s*)<div className="bg-white">', r'\1', t, flags=re.S)

if t != t0:
    p2.write_text(t, encoding="utf-8")
    print("OK: patched", p2)
else:
    print("OK: /u/[username]/page.tsx no changes needed")
PY

echo ""
echo "✅ DONE: ${SD_ID}"
echo "Backup: ${BK}"
echo ""
echo "Next (VS Code terminal):"
echo "  cd \"$ROOT/frontend\" && npm run typecheck"
echo "  cd \"$ROOT/frontend\" && npm run build"
echo ""
echo "Smoke test:"
echo "  1) Open /u/<you> — no Add Friend, no Follow (on any side)."
echo "  2) Open /u/<someone> — Add Friend + Follow still work."
echo "  3) About sheet — tap outside closes; Website is clickable."
echo "  4) PrismSideTabs (if used) — tabs are visible (not hidden)."
