#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_951_post_hero_v3_finish"
ROOT="$(pwd)"

echo "== ${SD_ID} (apply-helper) =="
echo "Repo: ${ROOT}"
echo ""

# Require repo root shape
if [[ ! -d "$ROOT/frontend" ]] || [[ ! -d "$ROOT/backend" ]] || [[ ! -d "$ROOT/scripts" ]]; then
  echo "❌ Run from repo root (must contain ./frontend ./backend ./scripts)."
  echo "Current: $ROOT"
  exit 1
fi

POSTCARD="frontend/src/components/PostCard.tsx"
PAGE="frontend/src/app/siddes-post/[id]/page.tsx"
HERO="frontend/src/components/thread/PostHero.tsx"
STATE="docs/STATE.md"

if [[ ! -f "${PAGE}" ]]; then
  echo "❌ Missing: ${PAGE}"
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "❌ node is required (used for safe patching)."
  exit 1
fi

STAMP="$(date +%Y%m%d_%H%M%S)"
BK=".backup_${SD_ID}_${STAMP}"
mkdir -p "$BK"

backup_one () {
  local rel="$1"
  if [[ -f "$rel" ]]; then
    mkdir -p "$BK/$(dirname "$rel")"
    cp -a "$rel" "$BK/$rel"
  fi
}

backup_one "$PAGE"
backup_one "$STATE"
backup_one "$POSTCARD"
backup_one "$HERO"

echo "✅ Backup: $BK"
echo ""

# -------------------------------------------------------------------
# Safety: if PostCard looks corrupted from the earlier sd_951 v1 attempt,
# restore it BEFORE we run gates.
# -------------------------------------------------------------------
if [[ -f "$POSTCARD" ]]; then
  SIZE="$(wc -c < "$POSTCARD" | tr -d ' ')"
  if [[ "${SIZE}" -lt 20000 ]]; then
    echo "⚠️ PostCard.tsx looks too small (${SIZE} bytes) — likely corrupted. Restoring from git..."
    git restore "$POSTCARD" || true
  fi

  if ! grep -q "export function PostCard" "$POSTCARD" 2>/dev/null; then
    echo "⚠️ PostCard.tsx missing 'export function PostCard' — restoring from git..."
    git restore "$POSTCARD" || true
  fi
fi

# -------------------------------------------------------------------
# Patch (Node) — ensure PostHero exists + swap the root PostCard(found.post)
# using a robust scanner (no fragile regex).
# -------------------------------------------------------------------
node <<'NODE'
const fs = require("fs");
const path = require("path");

const PAGE = "frontend/src/app/siddes-post/[id]/page.tsx";
const HERO = "frontend/src/components/thread/PostHero.tsx";
const STATE = "docs/STATE.md";

function must(cond, msg) {
  if (!cond) throw new Error(msg);
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function writeFile(p, s) {
  ensureDir(path.dirname(p));
  if (!s.endsWith("\n")) s += "\n";
  fs.writeFileSync(p, s, "utf8");
}

// 1) Ensure PostHero exists (overwrite is OK)
const HERO_SRC = `"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, MessageCircle, Repeat, Share2, MoreHorizontal } from "lucide-react";
import type { SideId } from "@/src/lib/sides";
import { cn } from "@/src/lib/cn";

// sd_951_v3: Dedicated "hero" renderer for Post Detail root post.
// We keep this separate from PostCard.tsx to avoid risky edits while iterating.

type ThemeLike = { text?: string; primaryBg?: string; lightBg?: string; border?: string };

type PostLike = {
  id: string;
  author?: { name?: string; handle?: string; avatarUrl?: string | null };
  authorName?: string;
  handle?: string;
  avatarUrl?: string | null;
  time?: string;
  content?: string;
  text?: string;
  likeCount?: number;
  likes?: number;
  replyCount?: number;
  replies?: number;
  liked?: boolean;
};

function safeText(p: PostLike): string {
  return String((p as any)?.content ?? (p as any)?.text ?? "");
}
function safeName(p: PostLike): string {
  return String((p as any)?.author?.name || (p as any)?.authorName || "User");
}
function safeHandle(p: PostLike): string {
  const h = String((p as any)?.author?.handle || (p as any)?.handle || "").trim();
  if (!h) return "@user";
  return h.startsWith("@") ? h : "@" + h;
}
function safeAvatar(p: PostLike): string | null {
  const a = (p as any)?.author?.avatarUrl ?? (p as any)?.avatarUrl ?? null;
  return a ? String(a) : null;
}
function countNum(v: any): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function PostHero({
  post,
  side,
  theme,
  onReply,
  onMore,
}: {
  post: any;
  side: SideId;
  theme?: ThemeLike;
  onReply?: () => void;
  onMore?: () => void;
}) {
  const router = useRouter();
  const p = post as PostLike;

  const name = useMemo(() => safeName(p), [p]);
  const handle = useMemo(() => safeHandle(p), [p]);
  const avatarUrl = useMemo(() => safeAvatar(p), [p]);
  const text = useMemo(() => safeText(p), [p]);

  const [liked, setLiked] = useState(Boolean((p as any)?.liked));
  const [likeBusy, setLikeBusy] = useState(false);

  const likeCount = useMemo(() => countNum((p as any)?.likeCount ?? (p as any)?.likes), [p]);
  const replyCount = useMemo(() => countNum((p as any)?.replyCount ?? (p as any)?.replies), [p]);
  const timeLabel = useMemo(() => String((p as any)?.time || "").trim(), [p]);

  const goProfile = () => {
    const raw = String((p as any)?.author?.handle || (p as any)?.handle || "").trim();
    const u = raw.startsWith("@") ? raw.slice(1) : raw;
    if (u) router.push(\`/u/\${encodeURIComponent(u)}\`);
  };

  const toggleLike = async () => {
    if (likeBusy) return;
    const id = String((p as any)?.id || "").trim();
    if (!id) return;

    setLikeBusy(true);
    const next = !liked;
    setLiked(next);
    try {
      const res = await fetch(\`/api/post/\${encodeURIComponent(id)}/like\`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ liked: next }),
      });
      if (!res.ok) setLiked(!next);
    } catch {
      setLiked(!next);
    } finally {
      setLikeBusy(false);
    }
  };

  return (
    <div className="bg-white">
      <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
        <button type="button" onClick={goProfile} className="flex items-start gap-3 text-left min-w-0">
          <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 border border-gray-200 flex-shrink-0">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 font-black">
                {name.slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="font-black text-gray-900 truncate">{name}</div>
              {timeLabel ? <div className="text-xs text-gray-400">· {timeLabel}</div> : null}
            </div>
            <div className="text-sm text-gray-500 truncate">{handle}</div>
          </div>
        </button>

        <button
          type="button"
          onClick={onMore}
          className="p-2 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-900"
          aria-label="More"
          title="More"
        >
          <MoreHorizontal size={18} />
        </button>
      </div>

      <div className="px-4 pb-4">
        <div className="text-[17px] leading-relaxed text-gray-900 whitespace-pre-wrap">{text}</div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="text-xs text-gray-500">
            <span className={cn("font-black", theme?.text)}>{side}</span>
          </div>
          <div />
        </div>

        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 text-sm">
          <span className="font-black text-gray-900">{likeCount}</span>
          <span className="text-gray-500">likes</span>
          <span className="text-gray-300 mx-1">•</span>
          <span className="font-black text-gray-900">{replyCount}</span>
          <span className="text-gray-500">replies</span>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <button
            type="button"
            onClick={toggleLike}
            disabled={likeBusy}
            className={cn(
              "min-w-[48px] min-h-[48px] px-3 rounded-full inline-flex items-center gap-2 text-sm font-extrabold hover:bg-gray-50 disabled:opacity-60",
              liked ? "text-rose-600" : "text-gray-600"
            )}
          >
            <Heart size={20} fill={liked ? "currentColor" : "none"} />
            <span className="hidden sm:inline">React</span>
          </button>

          <button
            type="button"
            onClick={() => { try { onReply?.(); } catch {} }}
            className="min-w-[48px] min-h-[48px] px-3 rounded-full inline-flex items-center gap-2 text-sm font-extrabold text-gray-600 hover:bg-gray-50"
          >
            <MessageCircle size={20} />
            <span className="hidden sm:inline">Reply</span>
          </button>

          <button
            type="button"
            className="min-w-[48px] min-h-[48px] px-3 rounded-full inline-flex items-center gap-2 text-sm font-extrabold text-gray-600 hover:bg-gray-50"
            aria-label="Echo"
            title="Echo"
          >
            <Repeat size={20} />
            <span className="hidden sm:inline">Echo</span>
          </button>

          <button
            type="button"
            className="min-w-[48px] min-h-[48px] px-3 rounded-full inline-flex items-center gap-2 text-sm font-extrabold text-gray-600 hover:bg-gray-50"
            aria-label="Share"
            title="Share"
          >
            <Share2 size={20} />
            <span className="hidden sm:inline">Share</span>
          </button>
        </div>
      </div>

      <div className="h-2 bg-gray-50" />
    </div>
  );
}
`;
writeFile(HERO, HERO_SRC);
console.log("WROTE:", HERO);

// 2) Patch page.tsx: import + replace root PostCard(found.post)
let page = fs.readFileSync(PAGE, "utf8");

const MARK = "sd_951_v3_post_hero_applied";
if (page.includes(MARK)) {
  console.log("OK: page.tsx already patched (marker found).");
} else {
  const importLine = 'import { PostHero } from "@/src/components/thread/PostHero";';
  if (!page.includes(importLine)) {
    // Insert after the PostCard import if present, else after the last import statement.
    const postCardImportRe = /^import\s+\{\s*PostCard\s*\}\s+from\s+"@\/src\/components\/PostCard";?\s*$/m;
    if (postCardImportRe.test(page)) {
      page = page.replace(postCardImportRe, (m) => `${m}\n${importLine}`);
    } else {
      const importRe = /^(import .*;\s*)$/gm;
      const matches = [...page.matchAll(importRe)];
      if (matches.length) {
        const last = matches[matches.length - 1];
        const idx = (last.index ?? 0) + last[0].length;
        page = page.slice(0, idx) + `\n${importLine}` + page.slice(idx);
      } else {
        page = `${importLine}\n` + page;
      }
    }
  }

  // Find the specific PostCard instance that renders the root post (found.post).
  const needleRe = /post=\{\s*found\.post\b/;
  const m = needleRe.exec(page);
  must(!!m, "sd_951_v3: could not find 'post={found.post...}' in PostDetail page.");

  const pos = m.index;
  const start = page.lastIndexOf("<PostCard", pos);
  must(start >= 0, "sd_951_v3: could not locate '<PostCard' start for the root post.");

  const endSelf = page.indexOf("/>", pos);
  const endClose = page.indexOf("</PostCard>", pos);

  let end = -1;
  if (endSelf !== -1 && (endClose === -1 || endSelf < endClose)) {
    end = endSelf + 2;
  } else if (endClose !== -1) {
    end = endClose + "</PostCard>".length;
  }
  must(end > start, "sd_951_v3: could not determine the end of the root <PostCard ...> block.");

  // Determine indentation for nice formatting
  const lineStart = page.lastIndexOf("\n", start);
  const indent = lineStart === -1 ? "" : page.slice(lineStart + 1, start);

  const repl =
`${indent}<PostHero
${indent}  post={found.post}
${indent}  side={found.side}
${indent}  theme={theme}
${indent}  onReply={() => { try { replyInputRef.current?.focus(); } catch {} }}
${indent}  onMore={() => { try { /* TODO: action sheet */ } catch {} }}
${indent}/>
`;

  page = page.slice(0, start) + repl + page.slice(end);

  // Marker
  page += `\n\n// ${MARK}\n`;

  fs.writeFileSync(PAGE, page, "utf8");
  console.log("PATCHED:", PAGE);
}

// 3) docs/STATE.md best-effort update
try {
  if (fs.existsSync(STATE)) {
    const mark = "**sd_951:** Thread: PostHero root post (detail hero) — root post uses dedicated hero renderer (no PostCard surgery).";
    let t = fs.readFileSync(STATE, "utf8");
    if (!t.includes(mark)) {
      const line = `- ${mark}\n`;
      if (t.includes("## NEXT overlay")) {
        t = t.replace("## NEXT overlay", "## NEXT overlay\n" + line);
      } else {
        t += "\n\n## NEXT overlay\n" + line;
      }
      fs.writeFileSync(STATE, t, "utf8");
      console.log("PATCHED:", STATE);
    } else {
      console.log("SKIP:", STATE, "(already has sd_951 entry)");
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
