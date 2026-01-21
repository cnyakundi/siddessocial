#!/usr/bin/env bash
set -euo pipefail

NAME="sd_464a_scroll_restore_feed"
TS=$(date +%Y%m%d_%H%M%S)
ROOT=$(pwd)

if [ ! -d "frontend/src" ]; then
  echo "ERROR: Run this from your repo root (folder containing frontend/ and backend/)."
  echo "Current: $ROOT"
  exit 1
fi

BK_DIR=".backup_${NAME}_${TS}"
mkdir -p "$BK_DIR"

echo "== $NAME =="
echo "Backups: $BK_DIR"

# --- 1) Add shared return-scroll helper ---
HOOK_PATH="frontend/src/hooks/returnScroll.ts"

if [ -f "$HOOK_PATH" ]; then
  mkdir -p "$BK_DIR/$(dirname "$HOOK_PATH")"
  cp "$HOOK_PATH" "$BK_DIR/$HOOK_PATH"
fi

mkdir -p "frontend/src/hooks"
cat > "$HOOK_PATH" <<'HOOK'
"use client";

import { useEffect } from "react";

const KEY_PATH = "sd.return.path";
const KEY_Y = "sd.return.y";
const KEY_TS = "sd.return.ts";
const MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

export function saveReturnScroll() {
  if (typeof window === "undefined") return;
  try {
    const path = window.location.pathname + window.location.search;

    // Only capture list → detail flows where restoring makes sense.
    if (!path.startsWith("/siddes-feed") && !path.startsWith("/siddes-sets")) return;

    window.sessionStorage.setItem(KEY_PATH, path);
    window.sessionStorage.setItem(KEY_Y, String(Math.max(0, Math.round(window.scrollY || 0))));
    window.sessionStorage.setItem(KEY_TS, String(Date.now()));
  } catch {
    // ignore
  }
}

function clear() {
  try {
    window.sessionStorage.removeItem(KEY_PATH);
    window.sessionStorage.removeItem(KEY_Y);
    window.sessionStorage.removeItem(KEY_TS);
  } catch {
    // ignore
  }
}

export function useReturnScrollRestore() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const path = window.location.pathname + window.location.search;
      const savedPath = window.sessionStorage.getItem(KEY_PATH);
      if (!savedPath || savedPath !== path) return;

      const ts = Number(window.sessionStorage.getItem(KEY_TS) || "0");
      if (!ts || Date.now() - ts > MAX_AGE_MS) {
        clear();
        return;
      }

      const y = Number(window.sessionStorage.getItem(KEY_Y) || "0");
      if (!Number.isFinite(y)) {
        clear();
        return;
      }

      // Clear first so this only runs once per return.
      clear();

      const target = Math.max(0, Math.round(y));
      const tryScroll = () => window.scrollTo({ top: target, left: 0, behavior: "auto" });

      // Defer to allow layout/virtualizer to settle.
      requestAnimationFrame(() => {
        tryScroll();
        requestScroll();
      });

      function requestScroll() {
        requestAnimationFrame(() => {
          tryScroll();
        });
      }

      window.setTimeout(() => {
        if (Math.abs((window.scrollY || 0) - target) > 8) tryScroll();
      }, 220);
    } catch {
      // ignore
    }
  }, []);
}
HOOK

echo "OK: wrote $HOOK_PATH"

# --- 2) Patch SideFeed.tsx to restore on mount ---
SIDEFEED="frontend/src/components/SideFeed.tsx"
if [ -f "$SIDEFEED" ]; then
  mkdir -p "$BK_DIR/$(dirname "$SIDEFEED")"
  cp "$SIDEFEED" "$BK_DIR/$SIDEFEED"

  FILE="$SIDEFEED" node - <<'NODE'
const fs = require("fs");
const file = process.env.FILE;
let s = fs.readFileSync(file, "utf8");

if (!s.includes("useReturnScrollRestore")) {
  const needle = 'import { useSide } from "@/src/components/SideProvider";';
  if (!s.includes(needle)) throw new Error("SideFeed: expected useSide import not found");
  s = s.replace(needle, needle + '\nimport { useReturnScrollRestore } from "@/src/hooks/returnScroll";');
}

if (!s.includes("useReturnScrollRestore();")) {
  const anchor = "const theme = SIDE_THEMES[side];";
  if (!s.includes(anchor)) throw new Error("SideFeed: expected theme line not found");
  s = s.replace(anchor, anchor + "\n\n  // sd_464a: restore scroll when returning from post detail\n  useReturnScrollRestore();");
}

fs.writeFileSync(file, s);
console.log("OK: SideFeed patched");
NODE
else
  echo "WARN: missing $SIDEFEED (skip)"
fi

# --- 3) Patch PostCard.tsx to save scroll before navigation ---
POSTCARD="frontend/src/components/PostCard.tsx"
if [ -f "$POSTCARD" ]; then
  mkdir -p "$BK_DIR/$(dirname "$POSTCARD")"
  cp "$POSTCARD" "$BK_DIR/$POSTCARD"

  FILE="$POSTCARD" node - <<'NODE'
const fs = require("fs");
const file = process.env.FILE;
let s = fs.readFileSync(file, "utf8");

if (!s.includes("saveReturnScroll")) {
  const needle = 'import { toast } from "@/src/lib/toast";';
  if (!s.includes(needle)) throw new Error("PostCard: expected toast import not found");
  s = s.replace(needle, needle + '\nimport { saveReturnScroll } from "@/src/hooks/returnScroll";');
}

const oldBlock =
"  const openPost = () => router.push(`/siddes-post/${post.id}`);\n" +
"  const openReply = () => router.push(`/siddes-post/${post.id}?reply=1`);\n";

if (s.includes(oldBlock)) {
  const newBlock =
"  const openPost = () => {\n" +
"    saveReturnScroll();\n" +
"    router.push(`/siddes-post/${post.id}`);\n" +
"  };\n" +
"  const openReply = () => {\n" +
"    saveReturnScroll();\n" +
"    router.push(`/siddes-post/${post.id}?reply=1`);\n" +
"  };\n";
  s = s.replace(oldBlock, newBlock);
} else if (!s.includes("saveReturnScroll();")) {
  throw new Error("PostCard: expected openPost/openReply block not found (file changed?)");
}

fs.writeFileSync(file, s);
console.log("OK: PostCard patched");
NODE
else
  echo "WARN: missing $POSTCARD (skip)"
fi

echo ""
echo "✅ $NAME applied."
echo "Backups: $BK_DIR"
echo ""
echo "Next:"
echo "  cd frontend && npm run typecheck"
echo "  cd frontend && npm run build"
echo ""
echo "Smoke test:"
echo "  1) Go to /siddes-feed, scroll down."
echo "  2) Open a post."
echo "  3) Press back → you should land near the same scroll position."

