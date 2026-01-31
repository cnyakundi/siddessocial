#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_959b_alerts_drawer_header_actions"
NV="frontend/src/components/NotificationsView.tsx"
ND="frontend/src/components/NotificationsDrawer.tsx"
STATE="docs/STATE.md"

if [[ ! -f "$NV" ]] || [[ ! -f "$ND" ]]; then
  echo "❌ Missing required files. Run from repo root."
  echo "Need: $NV and $ND"
  exit 1
fi

TS="$(date +%Y%m%d_%H%M%S)"
BK=".backup_${SD_ID}_${TS}"
mkdir -p "$BK"
cp -a "$NV" "$BK/NotificationsView.tsx.bak"
cp -a "$ND" "$BK/NotificationsDrawer.tsx.bak"
[[ -f "$STATE" ]] && cp -a "$STATE" "$BK/STATE.md.bak" || true
echo "Backup: $BK"

python3 - <<'PY'
from pathlib import Path
import re

EVT = "sd:notifs:markAllRead"
MARK = "sd_959b_alerts_drawer_header_actions"

# -----------------------
# Patch NotificationsView
# -----------------------
p = Path("frontend/src/components/NotificationsView.tsx")
s = p.read_text(encoding="utf-8")

if MARK not in s and '"use client";' in s:
    s = s.replace('"use client";', '"use client";\n\n// ' + MARK, 1)

# 1) Ensure signature supports hideHeader (and keep existing hideTitle if present)
sig_patterns = [
    # embedded + hideTitle
    (
        r'export function NotificationsView\(\{ embedded = false, hideTitle = false \}: \{ embedded\?: boolean; hideTitle\?: boolean \} \)',
        'export function NotificationsView({ embedded = false, hideTitle = false, hideHeader = false }: { embedded?: boolean; hideTitle?: boolean; hideHeader?: boolean })'
    ),
    (
        r'export function NotificationsView\(\{ embedded = false, hideTitle = false \}: \{ embedded\?: boolean; hideTitle\?: boolean \}\)',
        'export function NotificationsView({ embedded = false, hideTitle = false, hideHeader = false }: { embedded?: boolean; hideTitle?: boolean; hideHeader?: boolean })'
    ),
    # embedded only
    (
        r'export function NotificationsView\(\{ embedded = false \}: \{ embedded\?: boolean \} \)',
        'export function NotificationsView({ embedded = false, hideTitle = false, hideHeader = false }: { embedded?: boolean; hideTitle?: boolean; hideHeader?: boolean })'
    ),
    (
        r'export function NotificationsView\(\{ embedded = false \}: \{ embedded\?: boolean \}\)',
        'export function NotificationsView({ embedded = false, hideTitle = false, hideHeader = false }: { embedded?: boolean; hideTitle?: boolean; hideHeader?: boolean })'
    ),
]

patched_sig = False
if "hideHeader" in s:
    patched_sig = True
else:
    for pat, rep in sig_patterns:
        s2, n = re.subn(pat, rep, s, count=1)
        if n == 1:
            s = s2
            patched_sig = True
            break

if not patched_sig:
    raise SystemExit("ERROR: Could not patch NotificationsView signature (unexpected shape).")

# 2) Wrap the top header row (the one containing 'Mark all read') behind !hideHeader
if "hideHeader" in s and "{!hideHeader" not in s:
    hdr_pat = re.compile(
        r'(^[ \t]*)(<div[^>]*className="[^"]*flex[^"]*items-center[^"]*justify-between[^"]*"[^>]*>[\s\S]*?Mark all read[\s\S]*?</div>)',
        re.M
    )
    m = hdr_pat.search(s)
    if m:
        indent = m.group(1)
        block = m.group(2)
        wrapped = (
            indent + "{!hideHeader ? (\n" +
            indent + "  " + block.replace("\n", "\n" + indent + "  ") + "\n" +
            indent + ") : null}"
        )
        s = s[:m.start()] + wrapped + s[m.end():]
    else:
        print("⚠️ WARN: Could not find the header block containing 'Mark all read' to hide. (Proceeding anyway.)")

# 3) Add window event listener to trigger markAllRead from drawer header
if EVT not in s:
    fn_pat = re.compile(r'(\n\s*const\s+markAllRead\s*=\s*async\s*\(\)\s*=>\s*\{[\s\S]*?\n\s*\};)', re.M)
    m = fn_pat.search(s)
    if not m:
        # fallback: function markAllRead() style
        fn_pat2 = re.compile(r'(\n\s*async\s+function\s+markAllRead\s*\(\)\s*\{[\s\S]*?\n\s*\})', re.M)
        m2 = fn_pat2.search(s)
        if not m2:
            print("⚠️ WARN: Could not find markAllRead function to attach event listener. (Proceeding.)")
        else:
            insert_at = m2.end()
            inject = (
                "\n\n  // " + MARK + ": allow drawer header to trigger mark-all-read\n"
                "  useEffect(() => {\n"
                "    if (typeof window === \"undefined\") return;\n"
                "    const onEvt = () => { try { void markAllRead(); } catch {} };\n"
                f"    window.addEventListener(\"{EVT}\", onEvt as any);\n"
                f"    return () => window.removeEventListener(\"{EVT}\", onEvt as any);\n"
                "  }, [markAllRead]);\n"
            )
            s = s[:insert_at] + inject + s[insert_at:]
    else:
        insert_at = m.end()
        inject = (
            "\n\n  // " + MARK + ": allow drawer header to trigger mark-all-read\n"
            "  useEffect(() => {\n"
            "    if (typeof window === \"undefined\") return;\n"
            "    const onEvt = () => { try { void markAllRead(); } catch {} };\n"
            f"    window.addEventListener(\"{EVT}\", onEvt as any);\n"
            f"    return () => window.removeEventListener(\"{EVT}\", onEvt as any);\n"
            "  }, [markAllRead]);\n"
        )
        s = s[:insert_at] + inject + s[insert_at:]

p.write_text(s, encoding="utf-8")
print("PATCHED:", str(p))

# ------------------------
# Patch NotificationsDrawer
# ------------------------
d = Path("frontend/src/components/NotificationsDrawer.tsx")
t = d.read_text(encoding="utf-8")

if MARK not in t and '"use client";' in t:
    t = t.replace('"use client";', '"use client";\n\n// ' + MARK, 1)

# 1) Import useNotificationsActivity if missing
if "useNotificationsActivity" not in t:
    anchor = 'import { useDialogA11y } from "@/src/hooks/useDialogA11y";'
    if anchor in t:
        t = t.replace(anchor, anchor + '\nimport { useNotificationsActivity } from "@/src/hooks/useNotificationsActivity";', 1)
    else:
        # fallback: insert after last import
        last_import = list(re.finditer(r'^\s*import .+?;\s*$', t, flags=re.M))
        if not last_import:
            raise SystemExit("ERROR: Could not find an import block to insert useNotificationsActivity.")
        iend = last_import[-1].end()
        t = t[:iend] + '\nimport { useNotificationsActivity } from "@/src/hooks/useNotificationsActivity";\n' + t[iend:]

# 2) Add unread computation after useLockBodyScroll(open); (safe hook position)
if "const unreadAlerts" not in t:
    if "useLockBodyScroll(open);" in t:
        t = t.replace(
            "useLockBodyScroll(open);",
            "useLockBodyScroll(open);\n\n  const notifs = useNotificationsActivity();\n  const unreadAlerts = Number((notifs as any)?.unread || 0);\n",
            1
        )
    else:
        print("⚠️ WARN: Could not find useLockBodyScroll(open); to insert unread count. (Proceeding without count.)")
        t = t.replace(
            "useDialogA11y",
            "  const notifs = useNotificationsActivity();\n  const unreadAlerts = Number((notifs as any)?.unread || 0);\n\nuseDialogA11y",
            1
        )

# 3) Upgrade header title block to include Mark all read (N)
# Match a simple wrapper around the Alerts title, then replace it.
title_pat = re.compile(
    r'<div>\s*<div id="notifications-drawer-title" className="[^"]*">Alerts</div>\s*</div>',
    re.M
)
if title_pat.search(t) and "Mark all read" not in t:
    repl = (
        '<div className="flex items-center gap-3 min-w-0">\n'
        '  <div id="notifications-drawer-title" className="text-xl font-black tracking-tight text-gray-900">Alerts</div>\n'
        '  {unreadAlerts > 0 ? (\n'
        '    <button\n'
        '      type="button"\n'
        f'      onClick={(e) => {{ e.preventDefault(); e.stopPropagation(); try {{ window.dispatchEvent(new Event("{EVT}")); }} catch {{}} }}\n'
        '      className="text-xs font-semibold text-gray-500 hover:underline truncate"\n'
        '      title="Mark all read"\n'
        '    >\n'
        '      Mark all read ({unreadAlerts})\n'
        '    </button>\n'
        '  ) : null}\n'
        '</div>'
    )
    t = title_pat.sub(repl, t, count=1)
else:
    # If we can't find it, don't break the file. (Maybe title markup differs.)
    print("⚠️ WARN: Could not rewrite drawer title block (markup differs) OR already contains Mark all read.")

# 4) Ensure NotificationsView in drawer uses hideHeader
# (sd_958 likely set embedded + hideTitle; we add hideHeader)
t2 = t
t2 = re.sub(r'<NotificationsView\s+embedded\s+hideTitle\s*/>', '<NotificationsView embedded hideTitle hideHeader />', t2, count=1)
t2 = re.sub(r'<NotificationsView\s+embedded\s+hideTitle\s+hideHeader\s*/>', '<NotificationsView embedded hideTitle hideHeader />', t2, count=1)
t2 = re.sub(r'<NotificationsView\s*/>', '<NotificationsView embedded hideTitle hideHeader />', t2, count=1)
t = t2

d.write_text(t, encoding="utf-8")
print("PATCHED:", str(d))
PY

# docs/STATE.md best-effort
if [[ -f "$STATE" ]] && ! grep -q "$SD_ID" "$STATE"; then
  printf "\n- **%s:** Alerts drawer: move 'Mark all read (N)' into drawer header; NotificationsView supports hideHeader; drawer uses embedded+hideTitle+hideHeader.\n" "$SD_ID" >> "$STATE"
fi

echo ""
echo "== Gates =="
./verify_overlays.sh
cd frontend && npm run typecheck && npm run build
cd .. && bash scripts/run_tests.sh --smoke

echo ""
echo "✅ DONE: $SD_ID"
echo "Backup: $BK"
echo ""
echo "Smoke test:"
echo "  - Open Alerts drawer"
echo "  - Drawer header shows 'Mark all read (N)' when N>0"
echo "  - Inside drawer: no extra top header row (or it should be minimal)"
echo "  - Mark all read works"
