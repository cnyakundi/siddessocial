#!/usr/bin/env bash
set -euo pipefail

NAME="sd_830_p0_ui_safety_pack"
TS="$(date +%Y%m%d_%H%M%S)"
ROOT="$(pwd)"

TARGET="frontend/src/app/u/[username]/page.tsx"

if [ ! -f "$ROOT/$TARGET" ]; then
  echo "ERROR: Run this from your repo root (missing $TARGET)" >&2
  exit 1
fi

BK="$ROOT/.backup_${NAME}_${TS}"
mkdir -p "$BK/$(dirname "$TARGET")"
cp "$ROOT/$TARGET" "$BK/$TARGET"

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
t = p.read_text()
orig = t

MARK = "sd_830_p0_ui_safety_pack"

def ensure_import_fetchme():
    global t
    imp = 'import { fetchMe } from "@/src/lib/authMe";\n'
    if imp in t:
        return
    anchor = 'import { toast } from "@/src/lib/toast";\n'
    if anchor in t:
        t = t.replace(anchor, anchor + imp, 1)
        return
    m = list(re.finditer(r'^import .*?;\n', t, flags=re.M))
    if not m:
        raise SystemExit("ERROR: Could not locate import section to insert fetchMe import.")
    pos = m[-1].end()
    t = t[:pos] + imp + t[pos:]

def ensure_me_state():
    global t
    if "setMeUsername" in t and "meUsername" in t:
        return
    m = re.search(r'^\s*const \[accessReqSentFor,\s*setAccessReqSentFor\]\s*=\s*useState<SideId \| null>\(null\);.*$', t, flags=re.M)
    if m:
        line = m.group(0) + "\n"
        ins = f'  const [meUsername, setMeUsername] = useState<string>(""); // {MARK}\n'
        if ins not in t:
            t = t.replace(line, line + ins, 1)
        return
    m2 = re.search(r'^\s*const \[err,\s*setErr\]\s*=\s*useState<.*?>\(.+?\);\s*$', t, flags=re.M)
    if m2:
        line = m2.group(0) + "\n"
        ins = f'  const [meUsername, setMeUsername] = useState<string>(""); // {MARK}\n'
        if ins not in t:
            t = t.replace(line, line + ins, 1)
        return
    raise SystemExit("ERROR: Could not locate a safe place to insert meUsername state.")

def ensure_me_effect():
    global t
    marker = f"{MARK}_owner_effect"
    if marker in t:
        return

    anchors = [
        "  }, [handle, activeIdentitySide]);\n",
        "  }, [handle, displaySide]);\n",
        "  }, [handle]);\n",
    ]
    for a in anchors:
        if a in t:
            effect = (
                a +
                f"  // {marker}: client-side owner detection (defense in depth)\n"
                "  useEffect(() => {\n"
                "    let alive = true;\n\n"
                "    (async () => {\n"
                "      const me = await fetchMe().catch(() => ({ ok: false, authenticated: false } as any));\n"
                "      if (!alive) return;\n\n"
                "      const u = me?.authenticated && me?.user?.username ? String(me.user.username).trim().toLowerCase() : \"\";\n"
                "      setMeUsername(u);\n"
                "    })();\n\n"
                "    return () => {\n"
                "      alive = false;\n"
                "    };\n"
                "  }, []);\n\n"
            )
            t = t.replace(a, effect, 1)
            return

    raise SystemExit("ERROR: Could not find the profile fetch effect end to insert /me owner effect.")

def patch_is_owner():
    global t
    old = '  const isOwner = !!(data as any)?.isOwner;\n'
    if old not in t:
        m = re.search(r'^\s*const isOwner\s*=\s*!!\(data as any\)\?\.isOwner;\s*$', t, flags=re.M)
        if not m:
            raise SystemExit("ERROR: Could not find isOwner assignment to patch.")
        start, end = m.span()
        old = t[start:end] + "\n"

    new = (
        f"  // {MARK}: treat isOwner as (server OR /me match)\n"
        "  const serverIsOwner = !!(data as any)?.isOwner;\n"
        "  const meU = String(meUsername || \"\" ).replace(/^@/, \"\" ).trim().toLowerCase();\n"
        "  const handleU = String(handle || \"\" ).replace(/^@/, \"\" ).trim().toLowerCase();\n"
        "  const isOwnerByMe = Boolean(meU && handleU && meU === handleU);\n"
        "  const isOwner = serverIsOwner || isOwnerByMe;\n\n"
    )
    t = t.replace(old, new, 1)

def ensure_self_guard(fn_name: str):
    global t
    pattern = re.compile(
        rf'(const {re.escape(fn_name)}\s*=\s*async[^\{{]*\{{\n\s+if\s*\(\s*!\s*user\?\.[^\)]*\)\s*return;\s*\n)',
        flags=re.M
    )
    m = pattern.search(t)
    if not m:
        return
    block = m.group(1)
    if f"{MARK}_self_guard" in block:
        return
    guard = (
        f"    // {MARK}_self_guard: never target yourself\n"
        "    if (isOwner) {\n"
        "      toast.error(\"That's you.\");\n"
        "      return;\n"
        "    }\n\n"
    )
    t = t.replace(block, block + guard, 1)

def patch_side_error_copy():
    global t
    if "cannot_side_self" in t and "That's you." in t:
        return
    t = t.replace(
        '        if (j?.error === "confirm_required") msg = "Confirmation required for Close/Work.";\n',
        '        if (j?.error === "confirm_required") msg = "Confirmation required for Close/Work.";\n'
        '        if (j?.error === "cannot_side_self") msg = "That\\\'s you.";\n',
        1
    )

def patch_request_access_error_copy():
    global t
    if "cannot_request_self" in t and "That's you." in t:
        return
    t = t.replace(
        '        if (res.status === 401 || j?.error === "restricted") msg = "Login required.";\n',
        '        if (res.status === 401 || j?.error === "restricted") msg = "Login required.";\n'
        '        if (j?.error === "cannot_request_self") msg = "That\\\'s you.";\n',
        1
    )

def patch_subscribe_error_copy():
    global t
    if "cannot_follow_self" in t and "That's you." in t:
        return
    t = re.sub(
        r'(\s+)const msg = (res\.status\s*===\s*401\s*\?[^;]+;)\n',
        r"\1let msg = \2\n\1if (j?.error === \"cannot_follow_self\") msg = \"That's you.\";\n",
        t,
        count=1
    )

ensure_import_fetchme()
ensure_me_state()
ensure_me_effect()
patch_is_owner()

ensure_self_guard("doToggleSubscribe")
ensure_self_guard("doToggleFollow")
ensure_self_guard("doPickSide")
ensure_self_guard("doRequestAccess")
ensure_self_guard("doMessage")

patch_subscribe_error_copy()
patch_side_error_copy()
patch_request_access_error_copy()

if t == orig:
    print("OK: no changes needed (already patched).")
else:
    p.write_text(t)
    print("OK: patched", p)
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
echo "  1) Open your own profile /u/<your-username> — you should see owner actions, not Subscribe/Side."
echo "  2) Confirm you do NOT see Side/Subscribe/Request access on your own profile."
echo "  3) Open someone else’s profile — subscribe + side should still work."
