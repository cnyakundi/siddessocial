#!/usr/bin/env bash
set -euo pipefail

TARGET="frontend/src/components/ProfileV2Header.tsx"
if [[ ! -f "$TARGET" ]]; then
  echo "❌ Missing $TARGET. Run from repo root."
  exit 1
fi

BK=".backup_sd_972_profile_clickable_public_follow_stats_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BK/$(dirname "$TARGET")"
cp "$TARGET" "$BK/$TARGET"
echo "✅ Backup: $BK/$TARGET"

node - <<'NODE'
const fs = require("fs");

const path = "frontend/src/components/ProfileV2Header.tsx";
let s = fs.readFileSync(path, "utf8");

if (s.includes("sd_972_profile_follow_stats_links")) {
  console.log("✅ Already applied (sd_972 marker found).");
  process.exit(0);
}

// 1) Ensure next/link import exists
if (!s.includes('import Link from "next/link";')) {
  const reReact = /^import\s+React[^;]*;\s*$/m;
  if (!reReact.test(s)) {
    console.error("❌ Could not find React import to anchor next/link import.");
    process.exit(1);
  }
  s = s.replace(reReact, (m) => m + '\nimport Link from "next/link";');
}

// 2) Replace Stat() to support optional href
const reStat = /function Stat\(props:\s*\{\s*label:\s*string;\s*value:\s*React\.ReactNode;\s*subtle\?:\s*boolean\s*\}\)\s*\{[\s\S]*?\n\}/m;

const newStat = `function Stat(props: { label: string; value: React.ReactNode; subtle?: boolean; href?: string; ariaLabel?: string }) {
  const { label, value, subtle, href, ariaLabel } = props;

  const base = cn(
    "flex flex-col",
    subtle ? "opacity-80" : "",
    href ? "rounded-2xl px-2 py-1 transition-all hover:bg-gray-50 hover:opacity-100 active:scale-[0.99]" : ""
  );

  const inner = (
    <>
      <span className="text-lg font-black text-gray-900 leading-none tabular-nums">{value}</span>
      <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mt-1">{label}</span>
    </>
  );

  return href ? (
    <Link href={href} className={base} aria-label={ariaLabel || label} title={ariaLabel || label}>
      {inner}
    </Link>
  ) : (
    <div className={base}>{inner}</div>
  );
}`;

// if Stat already has href support, don't clobber it
if (!s.includes("href?: string")) {
  if (!reStat.test(s)) {
    console.error("❌ Could not find Stat() function to patch.");
    process.exit(1);
  }
  s = s.replace(reStat, newStat);
}

// 3) Wire Followers/Following stats to /u/:username/(followers|following)
if (!s.includes("sd_972_profile_follow_stats_links")) {
  const anchor = "if (!hasCore) return null;";
  const idx = s.indexOf(anchor);
  if (idx === -1) {
    console.error("❌ Could not find stats block anchor (if (!hasCore) return null;).");
    process.exit(1);
  }

  // Insert href derivation right after hasCore check (only once)
  const insert = `${anchor}

    // sd_972_profile_follow_stats_links: make Public followers/following stats clickable
    const slug = safeHandle.replace(/^@/, "").split(/\\s+/)[0]?.trim() || "";
    const followersHref = slug ? \`/u/\${encodeURIComponent(slug)}/followers\` : undefined;
    const followingHref = slug ? \`/u/\${encodeURIComponent(slug)}/following\` : undefined;`;

  s = s.replace(anchor, insert);

  // Replace the two Stat calls in the isPublic branch
  s = s.replace(
    /<Stat label="Followers" value=\{typeof shownFollowers === "undefined" \? "—" : shownFollowers\} subtle \/>/,
    `<Stat label="Followers" value={typeof shownFollowers === "undefined" ? "—" : shownFollowers} subtle href={followersHref} ariaLabel="View followers" />`
  );

  s = s.replace(
    /<Stat label="Following" value=\{typeof shownFollowing === "undefined" \? "—" : shownFollowing\} subtle \/>/,
    `<Stat label="Following" value={typeof shownFollowing === "undefined" ? "—" : shownFollowing} subtle href={followingHref} ariaLabel="View following" />`
  );
}

fs.writeFileSync(path, s, "utf8");
console.log("✅ Patched:", path);
NODE

echo ""
echo "✅ sd_972 applied."
echo ""
echo "Next:"
echo "  cd frontend && npm run typecheck"
echo "  cd frontend && npm run build"
echo "  ./verify_overlays.sh"
echo ""
echo "Manual QA:"
echo "  1) Open /u/<username> while viewing Public"
echo "  2) Tap Followers -> should open /u/<username>/followers"
echo "  3) Tap Following -> should open /u/<username>/following"
echo ""
echo "Rollback:"
echo "  cp \"$BK/$TARGET\" \"$TARGET\""
