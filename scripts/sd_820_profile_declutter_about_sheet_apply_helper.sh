#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_820_profile_declutter_about_sheet"
ROOT="$(pwd)"

if [[ ! -d "$ROOT/frontend" ]] || [[ ! -d "$ROOT/backend" ]] || [[ ! -d "$ROOT/scripts" ]]; then
  echo "ERROR: Run from repo root (must contain ./frontend ./backend ./scripts)."
  echo "Current: $ROOT"
  exit 1
fi

STAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR=".backup_${SD_ID}_${STAMP}"
mkdir -p "$BACKUP_DIR"

backup_file () {
  local p="$1"
  if [[ -f "$p" ]]; then
    mkdir -p "$BACKUP_DIR/$(dirname "$p")"
    cp -a "$p" "$BACKUP_DIR/$p"
  fi
}

echo "== ${SD_ID} =="
echo "Backup: ${BACKUP_DIR}"
echo ""

PROFILE_PAGE="frontend/src/app/u/[username]/page.tsx"
HEADER_FILE="frontend/src/components/ProfileV2Header.tsx"

backup_file "$PROFILE_PAGE"
backup_file "$HEADER_FILE"

python3 - <<'PY'
import re
from pathlib import Path

def read_text(p: Path) -> str:
    return p.read_text(encoding="utf-8", errors="strict")

def write_text(p: Path, s: str) -> None:
    if not s.endswith("\n"):
        s += "\n"
    p.write_text(s, encoding="utf-8")

def die(msg: str) -> None:
    raise SystemExit("❌ " + msg)

root = Path(".").resolve()

# ------------------------------------------------------------
# 1) Patch /u/[username] profile page
# ------------------------------------------------------------
p = root / "frontend/src/app/u/[username]/page.tsx"
if not p.exists():
    die(f"Missing file: {p}")

s = read_text(p)
orig = s

# Fix the broken JSX comment "dirt" block that can render as text.
# Before: {/* sd_717... */  /* sd_732... */}  (2nd comment is outside JSX comment)
# After:  two proper JSX comments
pat = r'\{\s*/\*\s*sd_717_profile_v2_shell_header_tabs\s*\*/\s*(?:\r?\n)?\s*/\*\s*sd_732_fix_profile_messageHref\s*\*/\s*\}'
rep = '{/* sd_717_profile_v2_shell_header_tabs */}\n{/* sd_732_fix_profile_messageHref */}'
s, n = re.subn(pat, rep, s, count=1)
if n == 0:
    print("⚠️  WARN: did not find broken sd_717/sd_732 comment block (maybe already fixed).")

# Also fix any stray plain comment like:  /* sd_727_fix_profile_v2_variant_and_locked_back */
s = re.sub(r'(^\s*)/\*\s*(sd_727_fix_profile_v2_variant_and_locked_back)\s*\*/\s*$', r'\1{/* \2 */}', s, flags=re.M)

# Ensure ChevronRight is imported from lucide-react if we add the About button.
if "sd_820_profile_about_sheet" not in s:
    m = re.search(r'import\s*\{\s*([^}]+)\s*\}\s*from\s*"lucide-react";', s)
    if not m:
        print("⚠️  WARN: could not find lucide-react import block to add ChevronRight.")
    else:
        block = m.group(0)
        inner = m.group(1)
        if "ChevronRight" not in inner:
            inner_new = inner
            # Insert near Share2 if possible, else append.
            if "Share2" in inner_new:
                inner_new = inner_new.replace("Share2", "Share2, ChevronRight")
            else:
                inner_new = inner_new.strip()
                if inner_new.endswith(","):
                    inner_new = inner_new + " ChevronRight"
                else:
                    inner_new = inner_new + ", ChevronRight"
            block_new = f'import {{ {inner_new} }} from "lucide-react";'
            s = s.replace(block, block_new, 1)

# Add aboutOpen state near other UI states (idempotent).
if "sd_820_profile_about_sheet" not in s and "aboutOpen" not in s:
    anchor = "const [accessReqSentFor, setAccessReqSentFor] = useState<SideId | null>(null);"
    if anchor in s:
        s = s.replace(
            anchor,
            anchor + "\n\n  const [aboutOpen, setAboutOpen] = useState(false); // sd_820_profile_about_sheet\n",
            1,
        )
    else:
        print("⚠️  WARN: could not find accessReqSentFor state anchor to add aboutOpen; skipping state insert.")

ABOUT_BLOCK = r'''
              {/* sd_820_profile_about_sheet */}
              <button
                type="button"
                onClick={() => setAboutOpen(true)}
                className="mt-3 w-full px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-gray-900 font-extrabold text-sm flex items-center justify-between hover:bg-gray-100 transition-colors"
                aria-label="About"
              >
                About
                <ChevronRight size={18} className="text-gray-500" />
              </button>

              {aboutOpen ? (
                <div className="fixed inset-0 z-[98] flex items-end justify-center md:items-center">
                  <button
                    type="button"
                    className="absolute inset-0 bg-black/30 backdrop-blur-sm"
                    onClick={() => setAboutOpen(false)}
                    aria-label="Close"
                  />
                  <div role="dialog" aria-modal="true" className="relative w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl shadow-2xl p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-lg font-black text-gray-900">About {user?.handle}</div>
                        <div className="text-xs text-gray-500 mt-1">{SIDES[displaySide]?.label || displaySide} identity</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAboutOpen(false)}
                        className="p-2 rounded-full hover:bg-gray-100"
                        aria-label="Close"
                      >
                        <span className="sr-only">Close</span>
                        <X size={18} className="text-gray-500" />
                      </button>
                    </div>

                    {String((facet as any)?.headline || "").trim() ? (
                      <div className="mt-3 text-sm font-semibold text-gray-700">
                        {String((facet as any)?.headline || "").trim()}
                      </div>
                    ) : null}

                    <div className="mt-3 text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                      {String((facet as any)?.bio || "").trim() ? String((facet as any)?.bio || "").trim() : "No bio yet."}
                    </div>

                    <div className="mt-4 space-y-2">
                      {String((facet as any)?.location || "").trim() ? (
                        <div className="flex items-center justify-between text-xs">
                          <div className="text-gray-500 font-bold">Location</div>
                          <div className="text-gray-900 font-extrabold">{String((facet as any)?.location || "").trim()}</div>
                        </div>
                      ) : null}

                      {String((facet as any)?.website || "").trim() ? (
                        <div className="flex items-center justify-between text-xs">
                          <div className="text-gray-500 font-bold">Website</div>
                          <a
                            className="text-gray-900 font-extrabold hover:underline"
                            href={(() => {
                              const w = String((facet as any)?.website || "").trim();
                              if (!w) return "#";
                              if (w.startsWith("http://") || w.startsWith("https://")) return w;
                              return "https://" + w;
                            })()}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {String((facet as any)?.website || "").trim()}
                          </a>
                        </div>
                      ) : null}

                      <div className="flex items-center justify-between text-xs">
                        <div className="text-gray-500 font-bold">Privacy</div>
                        <div className="text-gray-900 font-extrabold">{SIDES[displaySide]?.privacyHint || "Visible"}</div>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-2xl bg-gray-50 border border-gray-200">
                        <div className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">Posts</div>
                        <div className="text-lg font-black text-gray-900 tabular-nums mt-1">{postsCount ?? "—"}</div>
                      </div>
                      <div className="p-3 rounded-2xl bg-gray-50 border border-gray-200">
                        <div className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">
                          {viewSide === "close" || typeof (data as any)?.siders === "string" ? "Private Set" : "Siders"}
                        </div>
                        <div className="text-lg font-black text-gray-900 tabular-nums mt-1">
                          {typeof (data as any)?.siders === "string" ? String((data as any)?.siders) : ((data as any)?.siders ?? "—")}
                        </div>
                      </div>
                    </div>

                    {!isOwner ? (
                      <div className="mt-4 p-4 rounded-2xl bg-gray-50 border border-gray-200 text-xs text-gray-700">
                        <div>
                          They show you: <span className="font-black text-gray-900">{SIDES[viewSide]?.label || viewSide}</span>
                        </div>
                        <div className="mt-1">
                          You show them:{" "}
                          <span className="font-black text-gray-900">
                            {viewerSidedAs ? (SIDES[viewerSidedAs]?.label || viewerSidedAs) : "Public"}
                          </span>
                        </div>
                      </div>
                    ) : null}

                    {String((facet as any)?.pulse?.text || "").trim() ? (
                      <div className="mt-4 p-4 rounded-2xl bg-white border border-gray-200">
                        <div className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">
                          {String((facet as any)?.pulse?.label || (displaySide === "public" ? "Town Hall" : "Pulse")).trim()}
                        </div>
                        <div className="mt-1 text-sm font-extrabold text-gray-900">
                          {String((facet as any)?.pulse?.text || "").trim()}
                        </div>
                      </div>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => setAboutOpen(false)}
                      className="w-full mt-5 py-3 rounded-xl bg-gray-900 text-white font-extrabold text-sm shadow-md active:scale-95 transition-all"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : null}
'''

# Insert About button + sheet just before the Posts section (idempotent).
if "sd_820_profile_about_sheet" not in s:
    if "{/* Posts */}" in s:
        s = s.replace("{/* Posts */}", ABOUT_BLOCK + "\n\n              {/* Posts */}", 1)
    else:
        print("⚠️  WARN: could not find '{/* Posts */}' anchor to insert About block; skipping insert.")

if s != orig:
    write_text(p, s)
    print("PATCHED:", p)
else:
    print("NO CHANGE:", p)

# ------------------------------------------------------------
# 2) Patch ProfileV2Header clean variant (remove clutter)
# ------------------------------------------------------------
p2 = root / "frontend/src/components/ProfileV2Header.tsx"
if not p2.exists():
    die(f"Missing file: {p2}")

h = read_text(p2)
h_orig = h

# Replace the noisy meta row (location + website + privacy) with a single privacy pill.
meta_pat = (
    r'<div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 mt-4 text-xs text-gray-500 font-medium">\s*'
    r'\{location\s*\?\s*\(.*?\)\s*:\s*null\}\s*'
    r'\{website\s*\?\s*\(.*?\)\s*:\s*null\}\s*'
    r'<div className="flex items-center gap-1 text-gray-500 bg-gray-50 px-2 py-0\.5 rounded border border-gray-100">.*?</div>\s*'
    r'</div>'
)
meta_rep = (
    '<div className="mt-4 inline-flex items-center gap-1 px-3 py-1 rounded-full border text-xs font-semibold bg-gray-50 border-gray-100 text-gray-600">'
    '{SIDES[displaySide]?.isPrivate ? <Lock size={12} /> : <ShieldCheck size={12} />} {SIDES[displaySide]?.privacyHint || "Visible"}'
    '</div>'
)
h, n = re.subn(meta_pat, meta_rep, h, flags=re.DOTALL, count=1)
if n == 0:
    print("⚠️  WARN: did not find the meta row block in ProfileV2Header (maybe already changed).")

# Remove Shared Sets and Pulse sections from the clean header (they live in About sheet now).
# Shared Sets
h = re.sub(
    r'\n\s*\{\s*/\*\s*Shared Sets\s*\*/\s*\}\s*\n\s*\{sharedSets\s*&&\s*sharedSets\.length\s*>\s*0\s*\?\s*\(.*?\)\s*:\s*null\}\s*',
    "\n",
    h,
    flags=re.DOTALL,
    count=1,
)

# Pulse
h = re.sub(
    r'\n\s*\{\s*/\*\s*Pulse\s*\*/\s*\}\s*\n\s*\{pulse\s*&&\s*\(pulse\.label\s*\|\|\s*pulse\.text\)\s*\?\s*\(.*?\)\s*:\s*null\}\s*',
    "\n",
    h,
    flags=re.DOTALL,
    count=1,
)

if h != h_orig:
    write_text(p2, h)
    print("PATCHED:", p2)
else:
    print("NO CHANGE:", p2)

PY

echo ""
echo "✅ ${SD_ID} applied."
echo "Backup saved at: ${BACKUP_DIR}"
echo ""
echo "Next (VS Code terminal, repo root):"
echo "  ./verify_overlays.sh"
echo "  bash scripts/run_tests.sh"
echo "  cd frontend && npm run typecheck && npm run build"
echo ""
echo "Smoke test:"
echo "  - Open /u/<username> and confirm:"
echo "    - No stray '/* sd_... */' text"
echo "    - Header is shorter + calmer"
echo "    - About button opens details"

