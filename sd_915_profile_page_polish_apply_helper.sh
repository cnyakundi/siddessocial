#!/usr/bin/env bash
set -euo pipefail

# sd_915 — Profile polish:
# - SmartBack on /u/:username
# - "Room" -> "Side" wording
# - Fix sheets: backdrop clickable + About website visible
# - Wire publicFollowers/publicFollowing into ProfileV2Header
# - Make Followers/Following stats tappable links

ROOT="${1:-$(pwd)}"

PAGE_FILE="$ROOT/frontend/src/app/u/[username]/page.tsx"
HEADER_FILE="$ROOT/frontend/src/components/ProfileV2Header.tsx"

if [ ! -f "$PAGE_FILE" ]; then
  echo "ERROR: Missing $PAGE_FILE"
  echo "Run this from repo root (sidesroot) or pass repo path as arg:"
  echo "  ./sd_915_profile_page_polish_apply_helper.sh /Users/cn/Downloads/sidesroot"
  exit 1
fi

if [ ! -f "$HEADER_FILE" ]; then
  echo "ERROR: Missing $HEADER_FILE"
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "ERROR: python3 not found. Install python3 and re-run."
  exit 1
fi

STAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="$ROOT/.backup_sd_915_profile_page_polish_$STAMP"
mkdir -p "$BACKUP_DIR"

echo "==> Backup → $BACKUP_DIR"
cp -v "$PAGE_FILE" "$BACKUP_DIR/page.tsx.bak" >/dev/null
cp -v "$HEADER_FILE" "$BACKUP_DIR/ProfileV2Header.tsx.bak" >/dev/null

echo "==> Patching files…"

python3 - <<'PY'
from pathlib import Path
import re
import sys

ROOT = Path(sys.argv[0]).resolve().parent  # not used; keep script standalone

def die(msg: str):
    raise SystemExit("ERROR: " + msg)

def patch_profile_page(txt: str) -> str:
    # 1) Ensure useSmartBack import exists
    if 'from "@/src/hooks/useSmartBack"' not in txt:
        m = re.search(r'(import\s*\{\s*useReturnScrollRestore\s*\}\s*from\s*"@/src/hooks/returnScroll";\s*\n)', txt)
        if m:
            ins = m.group(1) + 'import { useSmartBack } from "@/src/hooks/useSmartBack";\n'
            txt = txt[:m.start(1)] + ins + txt[m.end(1):]
        else:
            # fallback: insert after last import
            imports = list(re.finditer(r'^\s*import .*?;\s*$', txt, flags=re.M))
            if not imports:
                die("Could not find import block in profile page.")
            last = imports[-1]
            insert_at = last.end()
            txt = txt[:insert_at] + '\nimport { useSmartBack } from "@/src/hooks/useSmartBack";\n' + txt[insert_at:]

    # 2) Ensure goBack const exists after router
    if "const goBack = useSmartBack(" not in txt:
        m = re.search(r'(\bconst\s+router\s*=\s*useRouter\(\);\s*\n)', txt)
        if m:
            txt = txt[:m.end(1)] + '  const goBack = useSmartBack("/siddes-feed");\n' + txt[m.end(1):]
        else:
            # don't hard-fail; some files may use different naming
            pass

    # 3) Replace router.back try/catch with goBack handler (if present)
    if "onClick={goBack}" not in txt:
        patterns = [
            r'onClick=\{\(\)\s*=>\s*\{\s*try\s*\{\s*router\.back\(\);\s*\}\s*catch\s*\{\s*\}\s*\}\s*\}',
            r'onClick=\{\(\)\s*=>\s*router\.back\(\)\s*\}',
        ]
        for pat in patterns:
            txt2, n = re.subn(pat, "onClick={goBack}", txt, count=1)
            if n:
                txt = txt2
                break

    # 4) "Room" -> "Side" wording
    txt = txt.replace('aria-label="Switch profile room"', 'aria-label="Switch profile side"')
    txt = txt.replace("View Room", "View Side")

    # 5) Unhide overlay backdrops (locked sheet + about sheet)
    # Target: <button hidden ... className="absolute inset-0 bg-black/30 backdrop-blur-sm"
    txt = re.sub(
        r'(<button)\s+hidden(\s*\n\s*type="button"\s*\n\s*className="absolute inset-0 bg-black/30 backdrop-blur-sm")',
        r"\1\2",
        txt,
        flags=re.M,
    )

    # 6) Unhide About "Website" link (and About close button if hidden)
    txt = re.sub(r'(<a)\s+hidden(\s*\n\s*className="text-gray-900)', r"\1\2", txt, flags=re.M)
    txt = re.sub(r'(<button)\s+hidden(\s*\n\s*type="button"\s*\n\s*onClick=\{\(\)\s*=>\s*setAboutOpen\(false\)\}\s*)', r"\1\2", txt, flags=re.M)

    # 7) Pass publicFollowers/publicFollowing into ProfileV2Header (after postsCount)
    if "publicFollowers={" not in txt:
        def add_after_postsCount(m):
            indent = m.group(1)
            line = m.group(0)
            return (
                line
                + f'\n{indent}publicFollowers={{publicFollowers}}'
                + f'\n{indent}publicFollowing={{publicFollowing}}'
            )
        txt2, n = re.subn(r'^(\s*)postsCount=\{postsCount\}\s*$', add_after_postsCount, txt, count=1, flags=re.M)
        if n:
            txt = txt2

    # Minimal sanity checks (don’t over-fail if you already patched)
    if 'from "@/src/hooks/useSmartBack"' not in txt:
        die("Profile page: useSmartBack import missing after patch.")
    return txt

def patch_profile_header(txt: str) -> str:
    # 1) Import Link from next/link (if missing)
    if 'import Link from "next/link";' not in txt:
        # insert right after React import
        txt2, n = re.subn(r'(import\s+React\s+from\s+"react";\s*\n)', r'\1import Link from "next/link";\n', txt, count=1)
        if n:
            txt = txt2
        else:
            # fallback: insert after "use client" block
            txt2, n2 = re.subn(r'("use client";\s*\n\n)', r'\1import Link from "next/link";\n', txt, count=1)
            if n2:
                txt = txt2

    # 2) Replace Stat() to support href
    if "href?: string" not in txt:
        new_stat = (
            'function Stat(props: { label: string; value: React.ReactNode; subtle?: boolean; href?: string }) {\n'
            '  const { label, value, subtle, href } = props;\n'
            '  const cls = cn("flex flex-col", subtle ? "opacity-80" : "", href ? "cursor-pointer hover:opacity-100" : "");\n'
            '  const inner = (\n'
            '    <>\n'
            '      <span className="text-lg font-black text-gray-900 leading-none tabular-nums">{value}</span>\n'
            '      <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mt-1">{label}</span>\n'
            '    </>\n'
            '  );\n'
            '  return href ? (\n'
            '    <Link href={href} className={cls} aria-label={label}>\n'
            '      {inner}\n'
            '    </Link>\n'
            '  ) : (\n'
            '    <div className={cls}>{inner}</div>\n'
            '  );\n'
            '}\n'
        )

        pat = r'function Stat\([^\n]*\)\s*\{.*?\n\}\n\n(function PillsRow)'
        txt2, n = re.subn(pat, new_stat + "\n\n\\1", txt, count=1, flags=re.S)
        if n:
            txt = txt2
        else:
            # If structure differs, don't corrupt file
            die("ProfileV2Header: could not locate Stat() block to replace (file structure changed).")

    # 3) Add followersHref/followingHref derivation under safeHandle (if missing)
    if "followersHref" not in txt:
        anchor = '  const safeHandle = (handle || "").trim();\n'
        if anchor in txt:
            insert = (
                anchor
                + '  const usernameSlug = safeHandle.replace(/^@/, "").split(/\\s+/)[0]?.trim() || "";\n'
                + '  const followersHref = usernameSlug ? `/u/${encodeURIComponent(usernameSlug)}/followers` : "";\n'
                + '  const followingHref = usernameSlug ? `/u/${encodeURIComponent(usernameSlug)}/following` : "";\n'
            )
            txt = txt.replace(anchor, insert, 1)
        else:
            die('ProfileV2Header: could not find "const safeHandle = ..." anchor.')

    # 4) Make Followers/Following stats clickable
    txt = re.sub(
        r'<Stat\s+label="Followers"\s+value=\{typeof\s+shownFollowers\s+===\s+"undefined"\s+\?\s+"—"\s+:\s+shownFollowers\}\s+subtle\s*/>',
        r'<Stat label="Followers" value={typeof shownFollowers === "undefined" ? "—" : shownFollowers} subtle href={followersHref || undefined} />',
        txt,
        count=1,
    )
    txt = re.sub(
        r'<Stat\s+label="Following"\s+value=\{typeof\s+shownFollowing\s+===\s+"undefined"\s+\?\s+"—"\s+:\s+shownFollowing\}\s+subtle\s*/>',
        r'<Stat label="Following" value={typeof shownFollowing === "undefined" ? "—" : shownFollowing} subtle href={followingHref || undefined} />',
        txt,
        count=1,
    )

    # Sanity
    if 'import Link from "next/link";' not in txt:
        die("ProfileV2Header: Link import missing after patch.")
    if "href={followersHref" not in txt or "href={followingHref" not in txt:
        # Not fatal, but warn-worthy
        pass

    return txt

def apply(path: Path, fn):
    before = path.read_text(encoding="utf-8")
    after = fn(before)
    if after != before:
        path.write_text(after, encoding="utf-8")
        print(f"OK: patched {path}")
    else:
        print(f"OK: no changes needed {path}")

page = Path("frontend/src/app/u/[username]/page.tsx")
hdr = Path("frontend/src/components/ProfileV2Header.tsx")

if not page.exists():
    die(f"Missing {page}")
if not hdr.exists():
    die(f"Missing {hdr}")

apply(page, patch_profile_page)
apply(hdr, patch_profile_header)

print("OK: sd_915 profile polish applied.")
PY

echo
echo "==> Done. Changed files:"
git -C "$ROOT" status --porcelain || true

echo
echo "==> Recommended checks:"
echo "  ./verify_overlays.sh"
echo "  cd frontend && npm run typecheck && npm run build"

# Optional auto-run (default ON)
RUN_TESTS="${RUN_TESTS:-1}"
if [ "$RUN_TESTS" = "1" ]; then
  echo
  echo "==> Running verify + typecheck + build (set RUN_TESTS=0 to skip)"
  if [ -x "$ROOT/verify_overlays.sh" ]; then
    (cd "$ROOT" && ./verify_overlays.sh)
  else
    echo "WARN: verify_overlays.sh not found or not executable — skipping."
  fi

  if command -v npm >/dev/null 2>&1 && [ -f "$ROOT/frontend/package.json" ]; then
    (cd "$ROOT/frontend" && npm run typecheck)
    (cd "$ROOT/frontend" && npm run build)
  else
    echo "WARN: npm/frontend package.json not found — skipping typecheck/build."
  fi
fi

echo
echo "==> Backup is in: $BACKUP_DIR"
echo "==> If all good, commit:"
echo "  git add frontend/src/app/u/[username]/page.tsx frontend/src/components/ProfileV2Header.tsx"
echo "  git commit -m \"sd_915 profile page polish\""
PY

