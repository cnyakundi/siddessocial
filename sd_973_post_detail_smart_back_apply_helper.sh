#!/usr/bin/env bash
set -euo pipefail

TARGET="frontend/src/app/siddes-post/[id]/page.tsx"
if [[ ! -f "$TARGET" ]]; then
  echo "❌ Missing $TARGET (run from repo root)."
  exit 1
fi

BK=".backup_sd_973_post_detail_smart_back_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BK/$(dirname "$TARGET")"
cp "$TARGET" "$BK/$TARGET"
echo "✅ Backup: $BK/$TARGET"

node - <<'NODE'
const fs = require("fs");

const path = "frontend/src/app/siddes-post/[id]/page.tsx";
let s = fs.readFileSync(path, "utf8");

if (s.includes("sd_973_post_detail_smart_back")) {
  console.log("✅ Already applied (sd_973 marker found).");
  process.exit(0);
}

// 1) Ensure useSmartBack import
const importLine = 'import { useSmartBack } from "@/src/hooks/useSmartBack";';
if (!s.includes(importLine)) {
  const anchor = 'import { useSide } from "@/src/components/SideProvider";';
  if (s.includes(anchor)) {
    s = s.replace(anchor, anchor + "\n" + importLine);
  } else {
    // fallback: insert after next/navigation import
    const anchor2 = 'import { useParams, useSearchParams, useRouter } from "next/navigation";';
    if (!s.includes(anchor2)) {
      console.error("❌ Could not find import anchor to add useSmartBack.");
      process.exit(1);
    }
    s = s.replace(anchor2, anchor2 + "\n" + importLine);
  }
}

// 2) Insert goBack handler right after backLabel is computed
const reBackLabel = /const backLabel = \(\(\) => \{[\s\S]*?\}\)\(\);/m;
if (!reBackLabel.test(s)) {
  console.error("❌ Could not find backLabel block to attach SmartBack.");
  process.exit(1);
}

s = s.replace(reBackLabel, (m) => {
  return (
    m +
    `

  // sd_973_post_detail_smart_back: button back should behave well in PWA/deep-links
  const goBackSmart = useSmartBack(backHref);
  const goBack = useCallback(() => {
    // If launched from Search, respect Search back path (not returnScroll)
    if (backToSearchHref) {
      router.push(backToSearchHref);
      return;
    }
    goBackSmart();
  }, [backToSearchHref, router, goBackSmart]);
`
  );
});

// 3) Replace header Link (← {backLabel}) with a button that calls goBack
const reHeader =
  /<Link href=\{backHref\} className="text-sm font-extrabold text-gray-700 hover:underline">\s*← \{backLabel\}\s*<\/Link>/m;

if (!reHeader.test(s)) {
  console.error("❌ Could not find the header back Link to replace.");
  process.exit(1);
}

s = s.replace(
  reHeader,
  `<button
              type="button"
              onClick={goBack}
              className="text-sm font-extrabold text-gray-700 hover:underline"
              aria-label={"Back to " + backLabel}
              title={"Back to " + backLabel}
            >
              ← {backLabel}
            </button>`
);

// 4) Replace the “Post not found” back Link too (same behavior)
const reNotFound =
  /<Link href=\{backHref\} className="inline-block mt-4 text-sm font-extrabold text-gray-700 hover:underline">\s*← Back to \{backLabel\}\s*<\/Link>/m;

if (reNotFound.test(s)) {
  s = s.replace(
    reNotFound,
    `<button
              type="button"
              onClick={goBack}
              className="inline-block mt-4 text-sm font-extrabold text-gray-700 hover:underline"
              aria-label={"Back to " + backLabel}
              title={"Back to " + backLabel}
            >
              ← Back to {backLabel}
            </button>`
  );
}

fs.writeFileSync(path, s, "utf8");
console.log("✅ Patched:", path);
NODE

echo ""
echo "✅ sd_973 applied."
echo ""
echo "VS Code terminal:"
echo "  cd frontend && npm run typecheck"
echo "  cd frontend && npm run build"
echo "  ./verify_overlays.sh"
echo ""
echo "Manual QA:"
echo "  1) Open /siddes-feed, tap a post to open /siddes-post/<id>"
echo "  2) Tap ← Feed: should return to where you were (scroll restored)"
echo "  3) Open a post from Search (?from=search...) and tap ← Search: should go back to results"
echo ""
echo "Rollback:"
echo "  cp \"$BK/$TARGET\" \"$TARGET\""
