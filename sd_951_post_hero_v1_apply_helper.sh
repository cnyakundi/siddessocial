#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_951_post_hero_v1"
ROOT="$(pwd)"

echo "== ${SD_ID} (apply-helper) =="
echo "Repo: ${ROOT}"
echo ""

POSTCARD="frontend/src/components/PostCard.tsx"
STATE="docs/STATE.md"

if [[ ! -f "${POSTCARD}" ]]; then
  echo "❌ Missing: ${POSTCARD}"
  echo "Run this from your repo root (sidesroot)."
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "❌ node is required (used for safe in-place patching)."
  echo "Install Node.js, then re-run."
  exit 1
fi

TS="$(date +%Y%m%d_%H%M%S)"
BK=".backup_${SD_ID}_${TS}"
mkdir -p "${BK}"
cp -f "${POSTCARD}" "${BK}/PostCard.tsx.bak"
if [[ -f "${STATE}" ]]; then
  cp -f "${STATE}" "${BK}/STATE.md.bak" || true
fi

echo "✅ Backup saved to: ${BK}"
echo ""

node <<'NODE'
const fs = require("fs");

const POSTCARD = "frontend/src/components/PostCard.tsx";
const STATE = "docs/STATE.md";

function must(cond, msg) {
  if (!cond) throw new Error(msg);
}

let s = fs.readFileSync(POSTCARD, "utf8");

const MARK = "sd_951_post_hero_detail_style";
if (s.includes(MARK)) {
  console.log("OK: PostCard already has sd_951 marker; skipping.");
} else {
  // 1) Insert outerClass helper right after showAccentBorder line.
  const anchor = "const showAccentBorder = !isRow && !isDetail;";
  must(s.includes(anchor), "sd_951: could not find anchor 'const showAccentBorder = !isRow && !isDetail;'");
  const insert =
`${anchor}

  // ${MARK}: thread view root post should feel like a "hero" section (no card shadow / no accent border).
  const outerClass = isRow
    ? "group py-4 border-b border-gray-100 hover:bg-gray-50/40 transition-colors"
    : isDetail
      ? "bg-white p-4 border-b border-gray-100"
      : cn(
          "bg-white p-5 sm:p-6 rounded-3xl shadow-sm border border-gray-100 transition-shadow hover:shadow-md",
          showAccentBorder ? "border-l-4" : "",
          showAccentBorder ? theme.accentBorder : ""
        );
`;
  s = s.replace(anchor, insert);

  // 2) Replace wrapper className={cn(...)} with className={outerClass}
  const wrapRe = /className=\{cn\([\s\S]*?\)\}\s*\n\s*data-post-id=\{post\.id\}/m;
  must(wrapRe.test(s), "sd_951: could not find wrapper <div className={cn(...)} data-post-id={post.id}> block");
  s = s.replace(wrapRe, 'className={outerClass}\n      data-post-id={post.id}');

  // 3) Bigger body text on detail threads (mobile-friendly, matches mock)
  const bodyRe = /isRow\s*\?\s*"text-\[15px\]\s+mb-3"\s*:\s*"text-\[15px\]\s+lg:text-\[20px\]\s+mb-4"/m;
  if (bodyRe.test(s)) {
    s = s.replace(bodyRe, 'isRow ? "text-[15px] mb-3" : (isDetail ? "text-[17px] mb-4" : "text-[15px] lg:text-[20px] mb-4")');
  } else {
    console.log("WARN: body text class pattern not found (skip).");
  }

  fs.writeFileSync(POSTCARD, s, "utf8");
  console.log("PATCHED:", POSTCARD);
}

// 4) docs/STATE.md best-effort: add sd_951 to NEXT overlay list
try {
  if (fs.existsSync(STATE)) {
    const line = "- **sd_951:** Thread: root post hero chrome — PostCard uses a clean section style in /siddes-post (no shadow/accent) + larger body typography.\n";
    let t = fs.readFileSync(STATE, "utf8");
    if (!t.includes("**sd_951:**")) {
      if (t.includes("## NEXT overlay")) {
        t = t.replace("## NEXT overlay", "## NEXT overlay\n" + line);
      } else {
        t += "\n\n## NEXT overlay\n" + line;
      }
      fs.writeFileSync(STATE, t, "utf8");
      console.log("PATCHED:", STATE);
    } else {
      console.log("SKIP:", STATE, "(already has sd_951)");
    }
  } else {
    console.log("SKIP:", STATE, "(not found)");
  }
} catch (e) {
  console.log("WARN: STATE.md patch failed (non-fatal):", String(e && e.message ? e.message : e));
}
NODE

echo ""
echo "== Quick sanity =="
git diff --stat || true
echo ""

echo "== Gates =="
./verify_overlays.sh
(
  cd frontend
  npm run typecheck
  npm run build
)
bash scripts/run_tests.sh --smoke

echo ""
echo "✅ DONE: ${SD_ID}"
echo "Backup: ${BK}"
