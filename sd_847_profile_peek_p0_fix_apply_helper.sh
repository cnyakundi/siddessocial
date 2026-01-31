#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_847_profile_peek_p0_fix"
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

FILE="frontend/src/components/ProfilePeekSheet.tsx"
if [[ ! -f "$FILE" ]]; then
  echo "ERROR: Missing $FILE" >&2
  exit 1
fi

BK=".backup_${SD_ID}_${TS}"
mkdir -p "$BK/$(dirname "$FILE")"
cp -a "$FILE" "$BK/$FILE"

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

p = Path("frontend/src/components/ProfilePeekSheet.tsx")
s = p.read_text(encoding="utf-8")
orig = s

MARK = "sd_847_profile_peek_p0_fix"

# 1) Ensure fetchMe import
if 'import { fetchMe } from "@/src/lib/authMe";' not in s:
    anchor = 'import { toast } from "@/src/lib/toast";\n'
    if anchor in s:
        s = s.replace(anchor, anchor + 'import { fetchMe } from "@/src/lib/authMe";\n', 1)

# 2) Add meUsername state (after followers state)
if "meUsername" not in s:
    s = re.sub(
        r'(const \[followers,\s*setFollowers\] = useState<number \| null>\(null\);\n)',
        r'\1  const [meUsername, setMeUsername] = useState<string>(""); // ' + MARK + r'\n',
        s,
        count=1,
        flags=re.M,
    )

# 3) Add effect to fetch /api/auth/me when sheet opens (defense-in-depth self detection)
if f"{MARK}_me_effect" not in s:
    anchor = '  useEffect(() => setMounted(true), []);\n'
    if anchor in s:
        effect = "\n".join([
            "",
            f"  // {MARK}_me_effect: cache current username to prevent self-actions even if profile payload mis-detects",
            "  useEffect(() => {",
            "    if (!open || !mounted) return;",
            "    let alive = true;",
            "    (async () => {",
            "      const me = await fetchMe().catch(() => ({ ok: false, authenticated: false } as any));",
            "      if (!alive) return;",
            "      const u = me?.authenticated && me?.user?.username ? String(me.user.username).trim().toLowerCase() : \"\";",
            "      setMeUsername(u);",
            "    })();",
            "    return () => { alive = false; };",
            "  }, [open, mounted]);",
            "",
        ]) + "\n"
        s = s.replace(anchor, anchor + effect, 1)

# 4) Define isSelf near canFollow + include it in canFollow
if "const isSelf" not in s:
    s = s.replace(
        '  const canFollow = Boolean((data as any)?.viewerAuthed) && !Boolean((data as any)?.isOwner);\n',
        "\n".join([
            "  const isSelf = Boolean(meUsername && String(uname || \"\").trim().toLowerCase() === String(meUsername || \"\").trim().toLowerCase());",
            "  const canFollow = Boolean((data as any)?.viewerAuthed) && !Boolean((data as any)?.isOwner) && !isSelf;",
            "",
        ]),
        1,
    )

# 5) Add self guard in doToggleFollow
if f"{MARK}_self_guard" not in s:
    s = re.sub(
        r'(const doToggleFollow\s*=\s*async\s*\(\)\s*=>\s*\{\n\s*if \(!uname\) return;\n\s*if \(!canToggleFollow\) return;\n)',
        r'\1    // ' + MARK + r'_self_guard: never follow yourself\n    if (isSelf) { toast.error("That\\\'s you."); return; }\n',
        s,
        count=1,
        flags=re.M,
    )

# 6) Improve error copy for cannot_follow_self
if "cannot_follow_self" not in s:
    # Insert j?.error check inside the error branch (best-effort, do not over-match)
    s = re.sub(
        r'const msg = res\.status === 429 \? "Slow down\." : "Could not update subscribe\.";',
        'const msg = (j as any)?.error === "cannot_follow_self" ? "That\\\'s you." : (res.status === 429 ? "Slow down." : "Could not update subscribe.");',
        s,
        count=1,
    )

# 7) Unhide the backdrop button (this is the rage-quit bug)
# Turn: <button hidden\n  type="button"\n  className="absolute inset-0 bg-black/30 backdrop-blur-sm"
s = re.sub(
    r'(<button)\s+hidden(\s*\n\s*type="button"\s*\n\s*className="absolute inset-0 bg-black/30 backdrop-blur-sm")',
    r'\1\2',
    s,
    flags=re.M,
)

# 8) Ensure backdrop actually closes on pointerdown too (optional but makes it feel instant)
# If onPointerDown exists but doesn't call onClose, add it.
if "onPointerDown" in s and "onClose();" not in s.split("onPointerDown",1)[1].split("}",1)[0]:
    # Only patch the first onPointerDown handler in the file (the backdrop)
    s = re.sub(
        r'(onPointerDown=\{\(e\) => \{\n\s*// sd_713_backdrop_clickthrough: consume pointerdown to prevent ghost taps \(close on click\)\n\s*e\.preventDefault\(\);\n\s*e\.stopPropagation\(\);\n)(\s*\}\}\n)',
        r'\1          onClose();\n\2',
        s,
        count=1,
        flags=re.M,
    )

# 9) Cosmetic: fix "/>      <div" glue
s = s.replace('/>\n      <div', '/>\n\n      <div')
s = s.replace('/>      <div', '/>\n\n      <div')

if s != orig:
    p.write_text(s, encoding="utf-8")
    print("OK: patched", p)
else:
    print("OK: no changes needed (already patched).")
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
echo "  1) Long-press any author row -> ProfilePeek opens."
echo "  2) Tap outside -> closes (backdrop is NOT hidden)."
echo "  3) Long-press YOUR own author row -> you should NOT see a Follow/Subscribe action; if clicked, it says \"That's you.\""
