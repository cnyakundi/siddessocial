#!/usr/bin/env bash
set -euo pipefail

NAME="sd_830_p0_ui_safety_pack"
TS="$(date +%Y%m%d_%H%M%S)"
ROOT="$(pwd)"

if [ ! -f "$ROOT/frontend/src/app/u/[username]/page.tsx" ]; then
  echo "ERROR: Run this from your repo root (missing frontend/src/app/u/[username]/page.tsx)" >&2
  exit 1
fi

BK="$ROOT/.backup_${NAME}_${TS}"
mkdir -p "$BK/frontend/src/app/u/[username]"
cp "$ROOT/frontend/src/app/u/[username]/page.tsx" "$BK/frontend/src/app/u/[username]/page.tsx"

PYBIN=""
if command -v python3 >/dev/null 2>&1; then
  PYBIN="python3"
elif command -v python >/dev/null 2>&1; then
  PYBIN="python"
else
  echo "ERROR: python3 is required (python not found)." >&2
  exit 1
fi

"$PYBIN" - <<'PY'
from pathlib import Path
import re

p = Path("frontend/src/app/u/[username]/page.tsx")
s = p.read_text()
orig = s

def ensure_import():
    global s
    imp = 'import { fetchMe } from "@/src/lib/authMe";\n'
    if imp in s:
        return
    anchor = 'import { toast } from "@/src/lib/toast";\n'
    if anchor in s:
        s = s.replace(anchor, anchor + imp, 1)
        return
    # Fallback: place after last import line
    m = list(re.finditer(r'^import .*?;\n', s, flags=re.M))
    if not m:
        raise SystemExit("ERROR: Could not locate import section to insert fetchMe import.")
    pos = m[-1].end()
    s = s[:pos] + imp + s[pos:]

def ensure_me_state():
    global s
    if "setMeUsername" in s:
        return
    anchor = '  const [err, setErr] = useState<string | null>(null);\n'
    if anchor not in s:
        raise SystemExit("ERROR: Could not find err state anchor to insert meUsername state.")
    insert = anchor + '  const [meUsername, setMeUsername] = useState<string | null>(null); // sd_830_p0_ui_safety_pack\n'
    s = s.replace(anchor, insert, 1)

def ensure_me_effect():
    global s
    marker = "sd_830_p0_ui_safety_pack_owner_effect"
    if marker in s:
        return
    anchor = '  }, [handle, activeIdentitySide]);\n'
    if anchor not in s:
        raise SystemExit("ERROR: Could not find profile fetch effect end (}, [handle, activeIdentitySide]);).")
    effect = f'''{anchor}
  // {marker}: client-side owner detection (defense in depth)
  useEffect(() => {{
    let alive = true;

    (async () => {{
      const me = await fetchMe().catch(() => ({{ ok: false, authenticated: false }} as any));
      if (!alive) return;

      const u = me?.authenticated && me?.user?.username ? String(me.user.username).trim().toLowerCase() : null;
      setMeUsername(u);
    }})();

    return () => {{
      alive = false;
    }};
  }}, []);

'''
    s = s.replace(anchor, effect, 1)

def patch_is_owner():
    global s
    if "serverIsOwner" in s and "isOwnerByMe" in s:
        return
    old = '  const isOwner = !!(data as any)?.isOwner;\n'
    if old not in s:
        m = re.search(r'^\s*const isOwner\s*=\s*!!\(data as any\)\?\.isOwner;\s*$', s, flags=re.M)
        if not m:
            raise SystemExit("ERROR: Could not find isOwner assignment to patch.")
        start, end = m.span()
        old = s[start:end] + "\n"

    new = '''  // sd_830_p0_ui_safety_pack: treat isOwner as (server OR /me match)
  const serverIsOwner = !!(data as any)?.isOwner;
  const isOwnerByMe = (() => {
    const meU = String(meUsername || "").trim().toLowerCase();
    if (!meU) return false;

    const u1 = String(user?.username || "").trim();
    const u2 = String(user?.handle || "").replace(/^@/, "").trim();
    const viewed = String((u1 || u2) || "").trim().toLowerCase();
    if (!viewed) return false;

    return viewed === meU;
  })();
  const isOwner = serverIsOwner || isOwnerByMe;
'''
    s = s.replace(old, new, 1)

def ensure_guard(fn_name: str):
    global s
    # Insert a self-target guard after the "if (!user?.handle) return;" line
    pat = re.compile(
        rf'(const {re.escape(fn_name)} = async .*?\{{\n\s+if \(!user\?\.[^)]*?\) return;\n)',
        flags=re.S,
    )
    m = pat.search(s)
    if not m:
        return
    block = m.group(1)
    if "sd_830_self_guard" in block:
        return
    insert = block + '    // sd_830_self_guard: never target yourself\n    if (isOwner) {\n      toast.error("That\\'s you.");\n      return;\n    }\n\n'
    s = s.replace(block, insert, 1)

def patch_do_toggle_follow_error():
    global s
    if 'if (j?.error === "cannot_follow_self")' in s:
        return
    old = '        const msg = res.status === 401 ? "Log in to follow." : res.status === 429 ? "Slow down." : "Could not update follow.";\n'
    if old in s:
        new = '        let msg = res.status === 401 ? "Log in to follow." : res.status === 429 ? "Slow down." : "Could not update follow.";\n        if (j?.error === "cannot_follow_self") msg = "That\\\'s you.";\n'
        s = s.replace(old, new, 1)
        return
    # Fallback: regex
    s = re.sub(
        r'(\s+)const msg = res\.status === 401 \? "Log in to follow\." : res\.status === 429 \? "Slow down\." : "Could not update follow\.";(\n)',
        r'\1let msg = res.status === 401 ? "Log in to follow." : res.status === 429 ? "Slow down." : "Could not update follow.";\n\1if (j?.error === "cannot_follow_self") msg = "That\'s you.";\2',
        s,
        count=1,
    )

def patch_do_pick_side_error():
    global s
    if 'j?.error === "cannot_side_self"' in s:
        return
    anchor = '        if (j?.error === "confirm_required") msg = "Confirmation required for Close/Work.";\n'
    if anchor in s:
        s = s.replace(anchor, anchor + '        if (j?.error === "cannot_side_self") msg = "That\\\'s you.";\n', 1)
        return
    # Fallback: after msg assignment
    s = re.sub(
        r'(\s+)let msg = res\.status === 429 \? "Slow down\." : "Could not update Side\.";\n',
        r'\1let msg = res.status === 429 ? "Slow down." : "Could not update Side.";\n\1if (j?.error === "cannot_side_self") msg = "That\'s you.";\n',
        s,
        count=1,
    )

def pass_is_owner_to_actions_sheet():
    global s
    # Ensure ProfileActionsSheet call receives isOwner={isOwner}
    start = s.find("<ProfileActionsSheet")
    if start == -1:
        return
    end = s.find("/>", start)
    if end == -1:
        return
    block = s[start:end + 2]
    if "isOwner=" in block:
        return
    # Prefer inserting after href prop
    if "href={href}" in block:
        block2 = block.replace("href={href}\n", "href={href}\n              isOwner={isOwner}\n", 1)
    else:
        block2 = block[:-2] + '              isOwner={isOwner}\n            />'
    s = s.replace(block, block2, 1)

ensure_import()
ensure_me_state()
ensure_me_effect()
patch_is_owner()

# Self-target guards (defense-in-depth, even if UI misdetects for a moment)
ensure_guard("doToggleFollow")
ensure_guard("doPickSide")
ensure_guard("doRequestAccess")
ensure_guard("doMessage")

# Better error copy for self-target attempts
patch_do_toggle_follow_error()
patch_do_pick_side_error()

# Ensure actions sheet hides Report/Mute/Block on your own profile
pass_is_owner_to_actions_sheet()

if s != orig:
    p.write_text(s)
    print("OK: patched", p)
else:
    print("OK: no changes needed (already patched)")
PY

echo ""
echo "OK: ${NAME} applied."
echo "Backup: ${BK}"
echo ""
echo "Next (VS Code terminal):"
echo "  cd \"$ROOT/frontend\" && npm run typecheck"
echo "  cd \"$ROOT/frontend\" && npm run build"
echo ""
echo "Quick smoke:"
echo "  1) Open your own profile /u/<you> — you should NOT see Side/Follow/Block/Mute."
echo "  2) If you somehow click Follow/Side on yourself, you get \"That's you.\" and nothing happens."
echo "  3) Open the Profile actions sheet on your own profile — no Report/Mute/Block rows."
