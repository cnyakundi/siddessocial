#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_959_alerts_drawer_header_actions"
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

MARK = "sd_959_alerts_drawer_header_actions"
EVT = "sd:notifs:markAllRead"

# -----------------------
# Patch NotificationsView
# -----------------------
p = Path("frontend/src/components/NotificationsView.tsx")
s = p.read_text(encoding="utf-8")

if MARK not in s and '"use client";' in s:
    s = s.replace('"use client";', f'"use client";\n\n// {MARK}', 1)

# 1) Signature: add hideHeader
sig_re = re.compile(r'export function NotificationsView\(\{ embedded = false \}: \{ embedded\?: boolean \}\)')
if sig_re.search(s):
    s = sig_re.sub('export function NotificationsView({ embedded = false, hideHeader = false }: { embedded?: boolean; hideHeader?: boolean })', s, count=1)
else:
    # fallback: already extended or formatted differently
    if "hideHeader" not in s and "export function NotificationsView" in s:
        s = re.sub(
            r'export function NotificationsView\(\{ embedded = false \}:\s*\{\s*embedded\?:\s*boolean\s*\}\)',
            'export function NotificationsView({ embedded = false, hideHeader = false }: { embedded?: boolean; hideHeader?: boolean })',
            s,
            count=1,
        )

# 2) Wrap the internal header row (title + markAllRead) behind !hideHeader
# Target the flex header row that includes the "Mark all read" button.
hdr_re = re.compile(r'(<div className="flex items-center justify-between">[\s\S]*?Mark all read[\s\S]*?</button>\s*</div>)', re.M)
m = hdr_re.search(s)
if m and "{!hideHeader" not in s[m.start()-120:m.end()+120]:
    block = m.group(1)
    # preserve indentation
    line_start = s.rfind("\n", 0, m.start()) + 1
    indent = re.match(r"[ \t]*", s[line_start:m.start()]).group(0)
    wrapped = f'{indent}{{!hideHeader ? (\n{indent}{block}\n{indent}) : null}}'
    s = s[:m.start()] + wrapped + s[m.end():]

# 3) Make the header container spacing adapt when hideHeader=true
s = s.replace(
    '<div className="mb-4">',
    '<div className={cn(hideHeader ? "mb-3" : "mb-4")}>',
    1
)

# 4) Chip row: remove mt-3 when header hidden (so the list starts immediately)
s = s.replace(
    'className="flex gap-2 mt-3 overflow-x-auto no-scrollbar"',
    'className={cn("flex gap-2 overflow-x-auto no-scrollbar", hideHeader ? "" : "mt-3")}',
    1
)

# 5) Allow drawer header to trigger markAllRead without duplicating UI.
# Insert an event listener after markAllRead definition.
if EVT not in s:
    insert_point = s.find("};\n\n const markRead")
    if insert_point == -1:
        insert_point = s.find("};\n\nconst markRead")
    if insert_point != -1:
        inject = (
            f'\n\n  // {MARK}: allow drawer header to trigger mark-all-read (no duplicate header inside drawer)\n'
            f'  useEffect(() => {{\n'
            f'    if (typeof window === "undefined") return;\n'
            f'    const onEvt = () => {{ try {{ void markAllRead(); }} catch {{}} }};\n'
            f'    window.addEventListener("{EVT}", onEvt as any);\n'
            f'    return () => window.removeEventListener("{EVT}", onEvt as any);\n'
            f'  }}, [markAllRead]);\n'
        )
        s = s[:insert_point] + inject + s[insert_point:]
    else:
        # If file shape differs, don't risk corruption.
        raise SystemExit("ERROR: Could not locate insertion point after markAllRead for event listener.")

p.write_text(s, encoding="utf-8")
print("PATCHED:", str(p))

# ------------------------
# Patch NotificationsDrawer
# ------------------------
d = Path("frontend/src/components/NotificationsDrawer.tsx")
t = d.read_text(encoding="utf-8")

if MARK not in t and '"use client";' in t:
    t = t.replace('"use client";', f'"use client";\n\n// {MARK}', 1)

# 1) Import useNotificationsActivity
if 'useNotificationsActivity' not in t:
    # insert after existing hook imports
    if 'import { useDialogA11y } from "@/src/hooks/useDialogA11y";' in t:
        t = t.replace(
            'import { useDialogA11y } from "@/src/hooks/useDialogA11y";',
            'import { useDialogA11y } from "@/src/hooks/useDialogA11y";\nimport { useNotificationsActivity } from "@/src/hooks/useNotificationsActivity";',
            1
        )
    else:
        raise SystemExit("ERROR: Could not find useDialogA11y import anchor in NotificationsDrawer.tsx")

# 2) Add unread state inside component (after useDialogA11y line)
if "const unreadAlerts" not in t:
    anchor = "useDialogA11y({ open, containerRef: panelRef, initialFocusRef: closeBtnRef, onClose });"
    if anchor not in t:
        raise SystemExit("ERROR: Could not find useDialogA11y call anchor in NotificationsDrawer.tsx")
    t = t.replace(
        anchor,
        anchor + f'\n\n  const notifs = useNotificationsActivity();\n  const unreadAlerts = Number(notifs?.unread || 0);\n',
        1
    )

# 3) Replace title wrapper with a flex row including Mark all read button (only when unread > 0)
title_re = re.compile(r'<div>\s*<div id="notifications-drawer-title" className="text-xl font-black tracking-tight text-gray-900">Alerts</div>\s*</div>', re.M)
if title_re.search(t):
    t = title_re.sub(
        '<div className="flex items-center gap-3 min-w-0">\n'
        '  <div id="notifications-drawer-title" className="text-xl font-black tracking-tight text-gray-900">Alerts</div>\n'
        f'  {{unreadAlerts > 0 ? (\n'
        f'    <button\n'
        f'      type="button"\n'
        f'      onClick={(e) => {{\n'
        f'        e.preventDefault();\n'
        f'        e.stopPropagation();\n'
        f'        try {{ window.dispatchEvent(new Event("{EVT}")); }} catch {{}}\n'
        f'      }}}\n'
        f'      className="text-xs font-semibold text-gray-500 hover:underline truncate"\n'
        f'      aria-label={{"Mark all read (" + unreadAlerts + ")"}}\n'
        f'      title="Mark all read"\n'
        f'    >\n'
        f'      Mark all read ({'{'}unreadAlerts{'}'})\n'
        f'    </button>\n'
        f'  ) : null}}\n'
        '</div>',
        t,
        count=1
    )
else:
    raise SystemExit("ERROR: Could not locate drawer title block to patch (title markup changed).")

# 4) Use NotificationsView embedded + hideHeader inside drawer
t2 = t
t2 = re.sub(r'<NotificationsView\s*/>', '<NotificationsView embedded hideHeader />', t2, count=1)
t2 = re.sub(r'<NotificationsView\s+embedded\s*/>', '<NotificationsView embedded hideHeader />', t2, count=1)
if t2 == t:
    raise SystemExit("ERROR: Could not find <NotificationsView /> usage to patch in NotificationsDrawer.tsx")
t = t2

d.write_text(t, encoding="utf-8")
print("PATCHED:", str(d))
PY

# docs/STATE.md best-effort
if [[ -f "$STATE" ]] && ! grep -q "$SD_ID" "$STATE"; then
  printf "\n- **%s:** Alerts drawer: header owns 'Mark all read (N)'; NotificationsView supports hideHeader for drawer embed (no stacked headers).\n" "$SD_ID" >> "$STATE"
fi

echo ""
echo "== Gates (don’t cd frontend twice) =="
./verify_overlays.sh
cd frontend && npm run typecheck && npm run build
cd .. && bash scripts/run_tests.sh --smoke

echo ""
echo "✅ DONE: $SD_ID"
echo "Backup: $BK"
echo ""
echo "Smoke test:"
echo "  - Open Alerts drawer"
echo "  - Drawer header shows 'Mark all read (N)' only when N>0"
echo "  - Inside drawer: no extra 'Alerts' label row; list starts with filter chips (if any) + items"
