#!/usr/bin/env bash
set -euo pipefail

NAME="sd_820_notificationsview_lint_dep_and_mention_copy"
echo "== ${NAME} =="

REQ=(
  "frontend/src/components/NotificationsView.tsx"
)

missing=0
for f in "${REQ[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "❌ Missing: $f"
    missing=1
  fi
done

if [[ "$missing" -ne 0 ]]; then
  echo
  echo "Run this from your repo root (the folder that contains frontend/ and backend/)."
  exit 1
fi

TS="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR=".backup_${NAME}_${TS}"
mkdir -p "$BACKUP_DIR"
mkdir -p "$BACKUP_DIR/frontend/src/components"
cp "frontend/src/components/NotificationsView.tsx" "$BACKUP_DIR/frontend/src/components/NotificationsView.tsx"

echo "Backup: $BACKUP_DIR"
echo

python3 - <<'PY'
import re
from pathlib import Path

p = Path("frontend/src/components/NotificationsView.tsx")
s = p.read_text(encoding="utf-8")
orig = s

# 1) Fix mention label copy
s = s.replace('return "Mentioned";', 'return "Mentioned you";')

# 2) Mentions should NOT say "your post"
# Replace: <span className="font-bold">{labelForType(n.type)}</span> your post
needle = '<span className="font-bold">{labelForType(n.type)}</span> your post'
if needle in s:
    s = s.replace(
        needle,
        '<span className="font-bold">{labelForType(n.type)}</span>{n.type === "mention" ? "" : " your post"}',
    )

# 3) Fix React hooks lint warning: include `side` dependency in the badge-sync effect
# Replace: }, [itemsRaw]);  -> }, [itemsRaw, side]);
s = re.sub(r"\},\s*\[itemsRaw\]\s*\);\s*\n\s*const unreadCount", "}, [itemsRaw, side]);\n  const unreadCount", s, count=1)

if s != orig:
    p.write_text(s, encoding="utf-8")
    print("PATCHED: frontend/src/components/NotificationsView.tsx")
else:
    print("SKIP: frontend/src/components/NotificationsView.tsx (no changes)")
PY

echo
echo "✅ ${NAME} applied."
echo "Backup saved at: ${BACKUP_DIR}"
echo
echo "Next (VS Code terminal, repo root):"
echo "  ./verify_overlays.sh"
echo "  cd frontend && npm run typecheck && npm run build"
echo
echo "Rollback:"
echo "  cp \"${BACKUP_DIR}/frontend/src/components/NotificationsView.tsx\" \"frontend/src/components/NotificationsView.tsx\""
