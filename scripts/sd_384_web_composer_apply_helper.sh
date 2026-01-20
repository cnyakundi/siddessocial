#!/usr/bin/env bash
set -euo pipefail

# sd_384_web_composer_apply_helper.sh
# Applies the Web Composer shell + safety contract to /siddes-compose

ROOT="$(pwd)"

if [[ ! -d "$ROOT/frontend" ]] || [[ ! -d "$ROOT/backend" ]]; then
  echo "ERROR: Run this from your repo root (the folder that contains ./frontend and ./backend)."
  exit 1
fi

SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_FILE="$SRC_DIR/sd_384_siddes_compose_page.tsx"

DEST_FILE="$ROOT/frontend/src/app/siddes-compose/page.tsx"

if [[ ! -f "$SRC_FILE" ]]; then
  echo "ERROR: Missing $SRC_FILE"
  echo "Put the downloaded file next to this script and name it: sd_384_siddes_compose_page.tsx"
  exit 1
fi

if [[ ! -f "$DEST_FILE" ]]; then
  echo "ERROR: Expected composer at $DEST_FILE but it doesn't exist."
  exit 1
fi

STAMP="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.backup_sd_384_web_composer_${STAMP}"
mkdir -p "$BK"

echo "Backing up existing compose page..."
cp "$DEST_FILE" "$BK/page.tsx.bak"

echo "Applying new Web Composer compose page..."
cp "$SRC_FILE" "$DEST_FILE"

echo "Writing spec doc..."
mkdir -p "$ROOT/docs"
cat > "$ROOT/docs/COMPOSER_WEB_DESKTOP_V2.md" <<'DOC'
# Siddes Web Composer (Desktop v2)

**Owner:** Siddes UI
**Status:** Implemented (Phase 1)

## 1) What this is
A desktop-first compose shell that:
- feels like a modal on desktop (center card + blur backdrop)
- behaves like a bottom-sheet on mobile
- always shows Side + Audience context (“who will see this”)

## 2) Safety contract (must never regress)
1) **Never clear user text on failure.**
2) **Offline** → queue + undo + close is OK.
3) **Online failure** (4xx/5xx/network) → keep text, save draft, show inline error.
4) **Limits are enforced client-side**
   - Public: 800
   - Private sides: 5000
5) **Public confirm** still applies when enabled.

## 3) Drafts
Stored locally:
- Key: `sd.compose.drafts.v1`
- One draft per Side (Public/Friends/Close/Work)
- Drafts sheet supports restore + delete

## 4) Deep links
- `?prompt=...` prefills composer text
- `?side=work` does not auto-switch (unsafe)
  - instead shows “Enter Work” banner

## 5) Implementation mapping
- Page: `frontend/src/app/siddes-compose/page.tsx`

## 6) Manual QA checklist
- Public max length disables Post at 801+
- Private max length disables Post at 5001+
- 401/403/500/network errors keep text + show error + draft saved
- Offline queues and shows undo
- Drafts sheet restore/delete works
- `?prompt=` works
- `?side=` shows enter banner (no auto-switch)
DOC

echo ""
echo "DONE ✅"
echo ""
echo "Next:"
echo "  1) cd frontend && npm run build"
echo "  2) Open /siddes-compose on desktop and verify:"
echo "     - modal overlay + safety header"
echo "     - char counter + disable over limit"
echo "     - drafts sheet"
echo ""
echo "Rollback:"
echo "  cp \"$BK/page.tsx.bak\" \"$DEST_FILE\""

