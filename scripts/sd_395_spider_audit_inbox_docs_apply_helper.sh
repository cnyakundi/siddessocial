#!/usr/bin/env bash
set -euo pipefail

# sd_395_spider_audit_inbox_docs_apply_helper.sh
# Copies PHASE2_INBOX_SPIDERPACK.md into docs/SPIDER_AUDIT/ and updates INDEX.md.

ROOT="$(pwd)"

if [[ ! -d "$ROOT/frontend" ]] || [[ ! -d "$ROOT/backend" ]] || [[ ! -d "$ROOT/docs" ]]; then
  echo "ERROR: Run this script from your Siddes repo root (must contain: frontend/, backend/, docs/)." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_DOC="$SCRIPT_DIR/PHASE2_INBOX_SPIDERPACK.md"

if [[ ! -f "$SRC_DOC" ]]; then
  echo "ERROR: Put PHASE2_INBOX_SPIDERPACK.md in the same folder as this script:" >&2
  echo "  $SCRIPT_DIR" >&2
  exit 1
fi

STAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="$ROOT/.backup_sd_395_spider_audit_inbox_${STAMP}"
mkdir -p "$BACKUP_DIR"

mkdir -p "$ROOT/docs/SPIDER_AUDIT"

TARGET_DOC="$ROOT/docs/SPIDER_AUDIT/PHASE2_INBOX_SPIDERPACK.md"
INDEX_DOC="$ROOT/docs/SPIDER_AUDIT/INDEX.md"

# Backup if overwriting
[[ -f "$TARGET_DOC" ]] && cp -a "$TARGET_DOC" "$BACKUP_DIR/" || true
[[ -f "$INDEX_DOC"  ]] && cp -a "$INDEX_DOC"  "$BACKUP_DIR/" || true

# Copy doc in
cp -a "$SRC_DOC" "$TARGET_DOC"

# Ensure INDEX.md mentions it (append-only)
if [[ ! -f "$INDEX_DOC" ]]; then
  cat > "$INDEX_DOC" <<'EOF'
# Spider-Audit System Maps (Siddes)

## Phase 1 - Structural Mapping
- `PHASE1_COMPONENT_REGISTRY.md`

## Phase 2 - Spider Packs
- `PHASE2_INBOX_SPIDERPACK.md` - Inbox (threads -> thread detail -> send/move/unread/pins + store).

EOF
else
  if ! grep -q "PHASE2_INBOX_SPIDERPACK.md" "$INDEX_DOC"; then
    echo "" >> "$INDEX_DOC"
    echo "- \`PHASE2_INBOX_SPIDERPACK.md\` - Inbox (threads -> thread detail -> send/move/unread/pins + store)." >> "$INDEX_DOC"
  fi
fi

echo "OK: wrote $TARGET_DOC"
echo "OK: updated $INDEX_DOC"
echo "Backup: $BACKUP_DIR"
