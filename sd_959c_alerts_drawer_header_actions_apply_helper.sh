#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_959c_alerts_drawer_header_actions"
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
MARK = "sd_959c_alerts_drawer_header_actions"

# -----------------------
# Patch NotificationsView
# -----------------------
p = Path("frontend/src/components/NotificationsView.tsx")
s = p.read_text(encoding="utf-8")

# marker
if MARK not in s and '"use client";' in s:
    s = s.replace('"use client";', '"use client";\n\n// ' + MARK, 1)

# 1) Add hideHeader + hideTitle props to signature (robust)
sig_re = re.compile(r'export function NotificationsView\(\{([^}]*)\}\s*:\s*\{([^}]*)\}\)\s*\{')
m = sig_re.search(s)
if not m:
    raise SystemExit("ERROR: Could not locate NotificationsView signature.")

destruct = m.group(1).strip()
types = m.group(2).strip()

def add_destruct(name: str, default: str):
    global destruct
    if name in destruct:
        return
    destruct = (destruct + ", " + name + " = " + default).strip().strip(",")

def add_type(name: str, t: str):
    global types
    if name in types:
        return
    # ensure semicolons between fields
    types2 = types.strip()
    if types2 and not types2.endswith(";"):
        types2 += ";"
    types2 += f" {name}?: {t};"
    types = types2

add_destruct("hideTitle", "false")
add_destruct("hideHeader", "false")
add_type("hideTitle", "boolean")
add_type("hideHeader", "boolean")

replacement = "export function NotificationsView({ " + destruct + " }: { " + types + " }) {"
s = s[:m.start()] + replacement + s[m.end():]

# 2) Hide the top header row (title + Mark all read) when hideHeader=true,
#    but keep chips below it.
open_div = '<div className="flex items-center justify-between'
chips_gate = "{/* sd_825_chips_gate */}"

i = s.find(open_div)
j = s.find(chips_gate, i) if i != -1 else -1
if i != -1 and j != -1:
    k = s.rfind("</div>", i, j)
    if k == -1:
        raise SystemExit("ERROR: Could not find end of header row before chips gate.")
    k_end = k + len("</div>")
    header_block = s[i:k_end]

    # indent
    line_start = s.rfind("\n", 0, i) + 1
    indent = re.match(r"[ \t]*", s[line_start:i]).group(0)

    wrapped = (
        indent + "{!hideHeader ? (\n" +
        header_block +
        "\n" + indent + ") : null}\n"
    )
    s = s[:i] + wrapped + s[k_end:]
else:
    print("⚠️ WARN: Could not locate header row + chips gate; skipping header hide.")

# 3) Allow drawer header to trigger markAllRead via window event
if EVT not in s:
    fn_re = re.compile(r'(const\s+markAllRead\s*=\s*async\s*\(\)\s*=>\s*\{[\s\S]*?\n\s*\};)', re.M)
    mm = fn_re.search(s)
    if not mm:
        raise SystemExit("ERROR: Could not locate markAllRead() block for event wiring.")
    inject = """
  
  // sd_959c: allow drawer header to trigger markAllRead (keeps drawer chrome minimal)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onEvt = () => { try { void markAllRead(); } catch {} };
    window.addEventListener("__EVT__", onEvt as any);
    return () => window.removeEventListener("__EVT__", onEvt as any);
  }, [markAllRead]);
""".replace("__EVT__", EVT)
    s = s[:mm.end()] + inject + s[mm.end():]

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
    anchor = 'import { NotificationsView } from "@/src/components/NotificationsView";'
    if anchor not in t:
        raise SystemExit("ERROR: Could not find NotificationsView import anchor in NotificationsDrawer.")
    t = t.replace(anchor, anchor + '\nimport { useNotificationsActivity } from "@/src/hooks/useNotificationsActivity";', 1)

# 2) Add unread count inside component (right before `if (!open) return null;`)
if "const unreadAlerts" not in t:
    t = t.replace(
        "  if (!open) return null;",
        '  const notifs = useNotificationsActivity();\n  const unreadAlerts = Number((notifs as any)?.unread || 0);\n\n  if (!open) return null;',
        1
    )

# 3) Rewrite title block to include "Mark all read (N)" when N>0
title_pat = re.compile(
    r'<div>\s*<div id="notifications-drawer-title" className="[^"]*">Alerts</div>\s*</div>',
    re.M
)
if title_pat.search(t):
    title_block = """
<div className="flex items-center gap-3 min-w-0">
  <div id="notifications-drawer-title" className="text-xl font-black tracking-tight text-gray-900">Alerts</div>
  {unreadAlerts > 0 ? (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        try { window.dispatchEvent(new Event("__EVT__")); } catch {}
      }}
      className="text-xs font-semibold text-gray-500 hover:underline truncate"
      title="Mark all read"
      aria-label={"Mark all read (" + unreadAlerts + ")"}
    >
      Mark all read ({unreadAlerts})
    </button>
  ) : null}
</div>
""".replace("__EVT__", EVT).strip("\n")
    t = title_pat.sub(title_block, t, count=1)
else:
    print("⚠️ WARN: Could not find drawer title wrapper to rewrite (markup differs).")

# 4) Drawer should render NotificationsView embedded + hideTitle + hideHeader
# (We keep embedded/hideTitle if already present, and always add hideHeader.)
t = t.replace("<NotificationsView />", "<NotificationsView embedded hideTitle hideHeader />")
t = t.replace("<NotificationsView embedded />", "<NotificationsView embedded hideTitle hideHeader />")
t = t.replace("<NotificationsView embedded hideTitle />", "<NotificationsView embedded hideTitle hideHeader />")

d.write_text(t, encoding="utf-8")
print("PATCHED:", str(d))
PY

# docs/STATE best-effort
if [[ -f "$STATE" ]] && ! grep -q "$SD_ID" "$STATE"; then
  printf "\n- **%s:** Alerts drawer: header owns 'Mark all read (N)' and NotificationsView supports hideHeader for drawer embed (no stacked headers).\n" "$SD_ID" >> "$STATE"
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
echo "  - Header shows 'Mark all read (N)' only when N>0"
echo "  - Inside drawer: no duplicate header row"
echo "  - Mark all read works"
