#!/usr/bin/env bash
set -euo pipefail

NAME="sd_954_post_detail_reply_json_once"
FILE="frontend/src/app/siddes-post/[id]/page.tsx"

if [[ ! -f "$FILE" ]]; then
  echo "❌ Run this from your repo root (folder that contains frontend/)."
  echo "   Missing: $FILE"
  exit 1
fi

STAMP="$(date +%Y%m%d_%H%M%S)"
BK=".backup_${NAME}_${STAMP}"
mkdir -p "$BK/$(dirname "$FILE")"
cp "$FILE" "$BK/$FILE"

node - <<'NODE'
const fs = require("fs");

const FILE = "frontend/src/app/siddes-post/[id]/page.tsx";
let s = fs.readFileSync(FILE, "utf8");

function must(cond, msg) {
  if (!cond) throw new Error(msg);
}

const fetchNeedle = "const res = await fetch(`/api/post/${encodeURIComponent(found.post.id)}/reply`";
const jNeedle = "const j = await res.json().catch(() => null);";

const fpos = s.indexOf(fetchNeedle);
must(fpos !== -1, "Could not find reply fetch() block in sendReplyNow().");

const start = s.indexOf("if (res.ok) {", fpos);
must(start !== -1, "Could not find `if (res.ok) {` after reply fetch().");

const jpos = s.indexOf(jNeedle, start);
must(jpos !== -1, "Could not find `const j = await res.json().catch(() => null);` (expected buggy double-parse block).");

// Replace from `if (res.ok) {` through the `const j = ...` line (inclusive)
const lineEnd = s.indexOf("\n", jpos);
const end = (lineEnd === -1) ? s.length : (lineEnd + 1);

const replacement =
`    const j = await res.json().catch(() => null);

    if (res.ok) {
      if (!j || (j as any).ok !== false) {
        setReplyText("");
        setReplyTo(null);
        setReplyBusy(false);
        toast.success("Reply sent.");
        try {
          window.dispatchEvent(new Event(\`sd.post.replies.changed:\${found.post.id}\`));
        } catch {
          // ignore
        }
        return;
      }
    }

`;

s = s.slice(0, start) + replacement + s.slice(end);

// Safety check: ensure we now have only ONE res.json() in the reply send block.
// (We won't be perfect, but we can at least ensure the double-parse line is gone.)
must(!s.includes("const data = await res.json().catch(() => null);"), "Patch failed: old `const data = await res.json()` still present.");

fs.writeFileSync(FILE, s, "utf8");
console.log("OK: patched", FILE);
NODE

echo ""
echo "✅ $NAME applied."
echo "Backup saved to: $BK"
echo ""
echo "Next:"
echo "  cd frontend && npm run typecheck"
echo "  cd frontend && npm run build"
echo ""
echo "Smoke test:"
echo "  1) Open a post -> /siddes-post/<id>"
echo "  2) Try sending an EMPTY reply -> should show 'Write something first.'"
echo "  3) If you hit a trust gate / rate limit, the message should now be specific (not generic)."
echo ""
echo "Rollback:"
echo "  cp \"$BK/$FILE\" \"$FILE\""
