#!/usr/bin/env bash
set -euo pipefail

# sd_942_thread_quote_repost_notifications_desktop_apply_helper.sh
# Goals:
# 1) Reply count text + reply icon open ThreadView (post detail)
# 2) Repost/Quote:
#    - Repeat icon opens a selection sheet (Repost vs Quote)
#    - Post actions (⋯) includes "Quote post"
# 3) Desktop left rail top spacing aligns with DesktopTopBar
# 4) Inbox Alerts tab: extra bottom padding so last notification isn't hidden behind BottomNav

ROOT="$(pwd)"

need_file () {
  local rel="$1"
  if [[ ! -f "$ROOT/$rel" ]]; then
    echo "❌ Missing: $rel"
    echo "Run this from your repo root (the folder that contains ./frontend and ./backend)."
    exit 1
  fi
}

need_file "frontend/src/components/PostCard.tsx"
need_file "frontend/src/components/PostActionsSheet.tsx"
need_file "frontend/src/components/EchoSheet.tsx"
need_file "frontend/src/components/DesktopSideDock.tsx"
need_file "frontend/src/app/siddes-inbox/page.tsx"
need_file "frontend/src/app/siddes-post/[id]/page.tsx"

STAMP="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.backup_sd_942_${STAMP}"
mkdir -p "$BK"

backup () {
  local rel="$1"
  mkdir -p "$BK/$(dirname "$rel")"
  cp "$ROOT/$rel" "$BK/$rel"
}

echo "== sd_942: Thread + Quote/Repost + Desktop rail + Alerts padding =="
echo "Backups: $BK"

backup "frontend/src/components/PostCard.tsx"
backup "frontend/src/components/PostActionsSheet.tsx"
backup "frontend/src/components/EchoSheet.tsx"
backup "frontend/src/components/DesktopSideDock.tsx"
backup "frontend/src/app/siddes-inbox/page.tsx"
backup "frontend/src/app/siddes-post/[id]/page.tsx"

python3 - <<'PY'
from pathlib import Path
import re

def read(p: str) -> str:
    return Path(p).read_text(encoding="utf-8")

def write(p: str, s: str) -> None:
    Path(p).write_text(s, encoding="utf-8")

def sub_re(s: str, pattern: str, repl: str, min_n: int = 1, max_n=None, flags=re.DOTALL, label=""):
    new, n = re.subn(pattern, repl, s, flags=flags)
    if n < min_n:
        raise SystemExit(f"{label or pattern}: expected >= {min_n} replacement(s), got {n}")
    if max_n is not None and n > max_n:
        raise SystemExit(f"{label or pattern}: expected <= {max_n} replacement(s), got {n}")
    return new

# --- 1) PostCard patches ---
p = "frontend/src/components/PostCard.tsx"
s = read(p)

# Make reply-count text clickable (row counts)
s = sub_re(
    s,
    r"""\{replyCount\s*\?\s*\(\s*<span>\s*[\s\S]*?\{replyCount\}[\s\S]*?\{replyCount\s*===\s*1\s*\?\s*"reply"\s*:\s*"replies"\}[\s\S]*?</span>\s*\)\s*:\s*null\s*\}""",
    """{replyCount ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        openPost();
                      }}
                      className="hover:underline underline-offset-2"
                      aria-label={`Open thread (${replyCount} ${replyCount === 1 ? "reply" : "replies"})`}
                      title="Open thread"
                    >
                      {replyCount} {replyCount === 1 ? "reply" : "replies"}
                    </button>
                  ) : null}""",
    min_n=1,
    max_n=1,
    label="PostCard: replyCount span -> button"
)

# Reply icon opens thread, not reply composer
s = sub_re(
    s,
    r"""(\be\.stopPropagation\(\);\s*)openReply\(\);""",
    r"""\1openPost();""",
    min_n=1,
    max_n=5,
    label="PostCard: openReply() -> openPost() in click handlers"
)

# Repeat/Repost icon opens EchoSheet instead of instant echo
s = sub_re(
    s,
    r"""(\be\.stopPropagation\(\);\s*)toggleEcho\(\);""",
    r"""\1setOpenEcho(true);""",
    min_n=1,
    max_n=5,
    label="PostCard: toggleEcho() -> setOpenEcho(true) in click handlers"
)

# Add onQuote prop to PostActionsSheet call
needle = 'onEcho={canEcho ? () => setOpenEcho(true) : undefined}'
if needle not in s:
    raise SystemExit("PostCard: expected onEcho prop not found (file changed?)")
if 'onQuote={canEcho ? () => setOpenQuote(true) : undefined}' not in s:
    s = s.replace(needle, needle + '\n        onQuote={canEcho ? () => setOpenQuote(true) : undefined}', 1)

write(p, s)

# --- 2) PostActionsSheet: add Quote action ---
p = "frontend/src/components/PostActionsSheet.tsx"
s = read(p)

# Add PenLine icon import
if "PenLine" not in s:
    s = sub_re(
        s,
        r"""import \{([^}]*?)Repeat\s*\} from "lucide-react";""",
        r"""import {\1Repeat, PenLine } from "lucide-react";""",
        min_n=1,
        max_n=1,
        label="PostActionsSheet: add PenLine import"
    )

# Add onQuote in destructuring
s = sub_re(s, r"""onEcho,\s*onHide,""", "onEcho,\n  onQuote,\n  onHide,", 1, 1, label="PostActionsSheet: destructure onQuote")

# Add onQuote in props type
s = sub_re(
    s,
    r"""onEcho\?: \(\) => void;\s*onHide:""",
    """onEcho?: () => void;
  onQuote?: () => void;
  onHide:""",
    1, 1,
    label="PostActionsSheet: add onQuote prop type"
)

# Insert doQuote after doEcho
s = sub_re(
    s,
    r"""(const doEcho = \(\) => \{[\s\S]*?\};)\s*const doViewProfile = \(\) => \{""",
    r"""\1

  const doQuote = () => {
    if (!onQuote) return;
    onClose();
    setTimeout(() => {
      try { onQuote(); } catch {}
    }, 0);
  };

  const doViewProfile = () => {""",
    1, 1,
    label="PostActionsSheet: insert doQuote"
)

# Rename Echo -> Repost copy
s = s.replace('<div className="font-bold text-gray-900">Echo</div>', '<div className="font-bold text-gray-900">Repost</div>')
s = s.replace('<div className="text-xs text-gray-500">Echo or Quote Echo</div>', '<div className="text-xs text-gray-500">Repost instantly or Quote</div>')

# Insert Quote button after repost entry
marker = ') : null}          <button'
if marker in s:
    s = s.replace(
        marker,
        """) : null}

          {isPublic && onQuote ? (
            <button
              type="button"
              onClick={doQuote}
              className="w-full p-3 sm:p-4 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center gap-4 text-left"
            >
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-gray-800 shadow-sm">
                <PenLine size={18} />
              </div>
              <div>
                <div className="font-bold text-gray-900">Quote post</div>
                <div className="text-xs text-gray-500">Add a comment</div>
              </div>
            </button>
          ) : null}

          <button""",
        1,
    )

write(p, s)

# --- 3) EchoSheet: rename UI strings ---
p = "frontend/src/components/EchoSheet.tsx"
s = read(p)
s = s.replace("Echo to your Side", "Repost or Quote")
s = s.replace("Un-echo", "Undo repost")
s = s.replace("Remove this echo from your current Side", "Remove this repost from your current Side")
s = s.replace('<div className="font-bold text-gray-900">Echo</div>', '<div className="font-bold text-gray-900">Repost</div>', 1)
s = s.replace("Instantly share to your current Side", "Instant repost to your current Side")
s = s.replace("Quote Echo", "Quote")
write(p, s)

# --- 4) DesktopSideDock align ---
p = "frontend/src/components/DesktopSideDock.tsx"
s = read(p)
s = s.replace('className="h-20 flex items-center justify-center"', 'className="h-16 flex items-center justify-center"')
s = s.replace('className="w-full px-2 -mt-1"', 'className="w-full px-2 mt-1"')
write(p, s)

# --- 5) Inbox padding for Alerts tab ---
p = "frontend/src/app/siddes-inbox/page.tsx"
s = read(p)
s = s.replace(
    'return (\n    <div className="p-4 relative" style={pullStyle}>',
    'return (\n    <div className="p-4 pb-[calc(120px+env(safe-area-inset-bottom))] relative" style={pullStyle}>'
)
write(p, s)

# --- 6) Thread replies: depth fallback via parentId ---
p = "frontend/src/app/siddes-post/[id]/page.tsx"
s = read(p)
needle = "const depth = Math.max(0, Math.min(3, Number((r as any).depth || 0)));"
if needle in s:
    s = s.replace(
        needle,
        """const depth = (() => {
              const raw = Number((r as any).depth);
              if (Number.isFinite(raw) && raw > 0) return Math.max(0, Math.min(3, raw));

              const pid0 = String((r as any).parentId || (r as any).parent_id || "").trim();
              if (!pid0) return 0;

              let d = 1;
              let cur = pid0;
              const seen = new Set<string>();
              seen.add(String(r.id));
              while (cur && !seen.has(cur) && d < 3) {
                seen.add(cur);
                const parent = replies.find((x) => String((x as any).id) === cur);
                if (!parent) break;
                const next = String((parent as any).parentId || (parent as any).parent_id || "").trim();
                if (!next) break;
                cur = next;
                d += 1;
              }
              return Math.max(0, Math.min(3, d));
            })();""",
        1
    )
write(p, s)

print("OK: patches applied")
PY

echo ""
echo "✅ sd_942 applied."
echo ""
echo "Next:"
echo "  cd frontend && npm run typecheck"
echo "  cd frontend && npm run build"
echo ""
echo "Rollback:"
echo "  cp -R \"$BK/frontend\" \"$ROOT/\""
