#!/usr/bin/env bash
set -euo pipefail

NAME="sd_956_thread_single_card"
F_POSTCARD="frontend/src/components/PostCard.tsx"
F_DETAIL="frontend/src/app/siddes-post/[id]/page.tsx"

if [[ ! -f "$F_POSTCARD" || ! -f "$F_DETAIL" ]]; then
  echo "❌ Run from repo root. Missing:"
  [[ ! -f "$F_POSTCARD" ]] && echo "   - $F_POSTCARD"
  [[ ! -f "$F_DETAIL" ]] && echo "   - $F_DETAIL"
  exit 1
fi

STAMP="$(date +%Y%m%d_%H%M%S)"
BK=".backup_${NAME}_${STAMP}"
mkdir -p "$BK/$(dirname "$F_POSTCARD")" "$BK/$(dirname "$F_DETAIL")"
cp "$F_POSTCARD" "$BK/$F_POSTCARD"
cp "$F_DETAIL" "$BK/$F_DETAIL"

node - <<'NODE'
const fs = require("fs");

function must(cond, msg) {
  if (!cond) throw new Error(msg);
}

// --- Patch 1: PostCard renders "flat" on detail pages so it can live inside a single Thread card
{
  const FILE = "frontend/src/components/PostCard.tsx";
  let s = fs.readFileSync(FILE, "utf8");

  if (!s.includes("sd_956_thread_single_card")) {
    // Replace the non-row card wrapper that includes showAccentBorder
    // with: isDetail ? flat : existing card cn(...)
    const re =
      /:\s*cn\(\s*("bg-white[^"]*?border[^"]*?")\s*,\s*showAccentBorder\s*\?\s*"border-l-4"\s*:\s*""\s*,\s*showAccentBorder\s*\?\s*theme\.accentBorder\s*:\s*""\s*\)/m;

    must(re.test(s), "PostCard.tsx: could not find expected card wrapper cn(...showAccentBorder...) block.");

    s = s.replace(re, (_m, cls1) => {
      return `: (isDetail
            ? "bg-white p-5 sm:p-6 border-b border-gray-100" /* sd_956_thread_single_card */
            : cn(
                ${cls1},
                showAccentBorder ? "border-l-4" : "",
                showAccentBorder ? theme.accentBorder : ""
              ))`;
    });

    fs.writeFileSync(FILE, s, "utf8");
    console.log("OK: patched", FILE);
  } else {
    console.log("SKIP: PostCard already patched (sd_956 marker).");
  }
}

// --- Patch 2: Post detail wraps PostCard + Replies inside ONE card
{
  const FILE = "frontend/src/app/siddes-post/[id]/page.tsx";
  let s = fs.readFileSync(FILE, "utf8");

  if (!s.includes('data-testid="thread-card"')) {
    const openRe =
      /(\n\s*)<PostCard([\s\S]*?)\/>\s*\n\s*\n\s*<div className="mt-4 rounded-3xl border border-gray-100 bg-white p-5">/m;

    must(openRe.test(s), "Post detail: could not find PostCard + Replies wrapper sequence (file shape drift).");

    s = s.replace(openRe, (_m, pre, inner) => {
      return (
        `${pre}<div className="mt-4 rounded-3xl border border-gray-100 bg-white shadow-sm overflow-hidden" data-testid="thread-card">` +
        `${pre}  <PostCard${inner}/>` +
        `${pre}  <div className="p-5">`
      );
    });

    // Close the outer thread-card right after the replies block closes (before </ContentColumn>)
    const closeRe =
      /(onCountChange=\{setSentReplyCount\}[\s\S]*?\/>\s*\n)(\s*<\/div>\s*\n)(\s*<\/ContentColumn>)/m;

    must(closeRe.test(s), "Post detail: could not find Replies section close near onCountChange={setSentReplyCount}.");

    s = s.replace(closeRe, (_m, g1, g2, g3) => {
      const indent = (g2.match(/^\s*/) || [""])[0];
      return g1 + g2 + indent + "</div>\n" + g3;
    });

    fs.writeFileSync(FILE, s, "utf8");
    console.log("OK: patched", FILE);
  } else {
    console.log("SKIP: Post detail already has thread-card wrapper.");
  }
}

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
echo "  1) Open /siddes-post/<id>"
echo "  2) Root post + replies should now appear as ONE card/surface"
echo "  3) There should be a subtle divider between post and replies (border-b)"
echo ""
echo "Rollback:"
echo "  cp \"$BK/$F_POSTCARD\" \"$F_POSTCARD\""
echo "  cp \"$BK/$F_DETAIL\" \"$F_DETAIL\""
