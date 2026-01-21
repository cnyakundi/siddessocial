#!/usr/bin/env bash
set -euo pipefail

ROOT="$PWD"
if [ ! -d "$ROOT/frontend" ] || [ ! -d "$ROOT/backend" ]; then
  echo "ERROR: run from repo root (must contain frontend/ and backend/)" >&2
  exit 1
fi

TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.backup_sd_458_force_fresh_feed_after_post_$TS"
mkdir -p "$BK"

FEED_PAGE="$ROOT/frontend/src/app/siddes-feed/page.tsx"
COMPOSE="$ROOT/frontend/src/app/siddes-compose/client.tsx"

cp "$FEED_PAGE" "$BK/page.tsx"
cp "$COMPOSE" "$BK/client.tsx"

echo "== Patch: siddes-feed page uses r= param to force SideFeed remount =="
cat > "$FEED_PAGE" <<'TS'
"use client";

import { SideFeed } from "@/src/components/SideFeed";
import { useSearchParams } from "next/navigation";

export default function SiddesFeedPage() {
  const sp = useSearchParams();
  const r = sp.get("r") || "0";
  return <SideFeed key={r} />;
}
TS

echo "== Patch: compose close() supports forceFeed + use it after success =="
node -e '
const fs=require("fs");
const file=process.argv[1];
let s=fs.readFileSync(file,"utf8");

const before=s;

// Replace the start of close() to: (a) fix indentation, (b) add forceFeed option
s = s.replace(
  /const close = \(opts\?: \{ skipSaveDraft\?: boolean \}\) => \{\s*\n\s*\/\/ Never drop text silently \(unless we just successfully posted\/queued\)\.\s*\n\s*if \(!opts\?\.skipSaveDraft && \(text \|\| ""\)\.trim\(\)\) saveCurrentDraft\(\);\s*\n\s*\/\/ Prefer history back \(feels like dismissing a sheet\)\. Fall back to feed\.\s*\n/m,
`const close = (opts?: { skipSaveDraft?: boolean; forceFeed?: boolean }) => {
    // Never drop text silently (unless we just successfully posted/queued).
    if (!opts?.skipSaveDraft && (text || "").trim()) saveCurrentDraft();

    // After a successful post/queue, force a fresh feed mount (avoids stale feed illusions).
    if (opts?.forceFeed) {
      router.push(\`/siddes-feed?r=\${Date.now()}\`);
      return;
    }

    // Prefer history back (feels like dismissing a sheet). Fall back to feed.
`
);

// If the exact block above wasn’t found (because of minor formatting drift), do a safer minimal patch:
if (s === before) {
  s = s.replace(
    "const close = (opts?: { skipSaveDraft?: boolean }) => {",
    "const close = (opts?: { skipSaveDraft?: boolean; forceFeed?: boolean }) => {"
  );

  // Insert forceFeed block right after the saveCurrentDraft line
  s = s.replace(
    /if \(!opts\?\.skipSaveDraft && \(text \|\| ""\)\.trim\(\)\) saveCurrentDraft\(\);\s*\n/,
`if (!opts?.skipSaveDraft && (text || "").trim()) saveCurrentDraft();

    // After a successful post/queue, force a fresh feed mount (avoids stale feed illusions).
    if (opts?.forceFeed) {
      router.push(\`/siddes-feed?r=\${Date.now()}\`);
      return;
    }

`
  );
}

// Upgrade the two success-path calls
s = s.replaceAll(
  "close({ skipSaveDraft: true });",
  "close({ skipSaveDraft: true, forceFeed: true });"
);

fs.writeFileSync(file,s);
console.log("sd_458: patched feed remount + compose forceFeed success navigation.");
' "$COMPOSE"

echo "OK: sd_458 applied."
echo "Backup: $BK"
echo "Next:"
echo "  cd frontend && npm run typecheck"
echo "  cd frontend && npm run build"
