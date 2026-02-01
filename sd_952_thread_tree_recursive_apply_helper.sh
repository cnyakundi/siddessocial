#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_952_thread_tree_recursive"
ROOT="$(pwd)"

echo "== ${SD_ID} (apply-helper) =="
echo "Repo: ${ROOT}"
echo ""

# Bulletproof preconditions (prevents wrong-directory + cd frontend errors)
for d in frontend backend scripts; do
  if [[ ! -d "$ROOT/$d" ]]; then
    echo "❌ Run from repo root. Missing ./$d"
    echo "Tip: cd /Users/cn/Downloads/sidesroot"
    exit 1
  fi
done

PAGE="frontend/src/app/siddes-post/[id]/page.tsx"
TREE="frontend/src/components/thread/ThreadTree.tsx"
STATE="docs/STATE.md"

if [[ ! -f "$PAGE" ]]; then
  echo "❌ Missing: $PAGE"
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "❌ node is required for safe patching."
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
backup_one "$TREE"
backup_one "$STATE"

echo "✅ Backup: $BK"
echo ""

node <<'NODE'
const fs = require("fs");
const path = require("path");

const PAGE = "frontend/src/app/siddes-post/[id]/page.tsx";
const TREE = "frontend/src/components/thread/ThreadTree.tsx";
const STATE = "docs/STATE.md";

function must(cond, msg) { if (!cond) throw new Error(msg); }
function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }
function writeFile(p, s) {
  ensureDir(path.dirname(p));
  if (!s.endsWith("\n")) s += "\n";
  fs.writeFileSync(p, s, "utf8");
}

// 1) Write ThreadTree.tsx
const TREE_SRC = `"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { CornerDownRight } from "lucide-react";
import { getStubViewerCookie, isStubMe } from "@/src/lib/stubViewerClient";

// sd_952: ThreadTree renders replies as a true tree (recursive) with calm thread rails + optional collapsing.
// It works with today's backend (depth <= 1), and remains compatible when we unlock deeper threading later.

type StoredReply = {
  id: string;
  postId: string;
  authorId: string;
  author?: string;
  handle?: string;
  text: string;
  createdAt: number;
  clientKey?: string | null;
  parentId?: string | null;
  depth?: number;
};

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

function toProfileHref(handleOrId?: string | null): string | null {
  const raw = String(handleOrId || "").trim();
  if (!raw) return null;
  const u = raw.replace(/^@/, "").split(/\\s+/)[0]?.trim() || "";
  return u ? \`/u/\${encodeURIComponent(u)}\` : null;
}

function ReplyAvatar({ label, tone }: { label: string; tone: "neutral" | "queued" }) {
  const base =
    tone === "queued"
      ? "bg-amber-100 text-amber-800 border-amber-200"
      : "bg-gray-100 text-gray-700 border-gray-200";

  const letter = (label || "R").replace(/^@/, "").trim().slice(0, 1).toUpperCase() || "R";

  return (
    <div
      className={cn("w-8 h-8 rounded-full border flex items-center justify-center text-xs font-black shrink-0", base)}
      aria-hidden="true"
      title={label}
    >
      {letter}
    </div>
  );
}

function fmtTime(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function normalizeParentId(r: StoredReply): string {
  const pid = (r as any).parentId ?? (r as any).parent_id ?? null;
  return String(pid || "").trim();
}

function computeName(r: StoredReply, mine: boolean): { name: string; handle: string; profileHref: string | null } {
  const handleRaw = !mine ? String(r.handle || "").trim() : "";
  const handle = handleRaw ? (handleRaw.startsWith("@") ? handleRaw : "@" + handleRaw) : "";
  const name = mine ? "You" : (r.author || (handleRaw ? handleRaw.replace(/^@/, "") : "") || "Unknown");
  const profileHref = handle ? toProfileHref(handle) : null;
  return { name, handle, profileHref };
}

type Tree = {
  roots: StoredReply[];
  childrenById: Map<string, StoredReply[]>;
  order: Map<string, number>;
  byId: Map<string, StoredReply>;
};

function buildTree(replies: StoredReply[]): Tree {
  const byId = new Map<string, StoredReply>();
  const order = new Map<string, number>();

  replies.forEach((r, idx) => {
    const id = String(r.id);
    byId.set(id, r);
    order.set(id, idx);
  });

  const childrenById = new Map<string, StoredReply[]>();
  const roots: StoredReply[] = [];

  replies.forEach((r) => {
    const pid = normalizeParentId(r);
    const parentExists = pid && byId.has(pid);

    if (parentExists) {
      const arr = childrenById.get(pid) || [];
      arr.push(r);
      childrenById.set(pid, arr);
    } else {
      roots.push(r);
    }
  });

  const sorter = (a: StoredReply, b: StoredReply) => (order.get(String(a.id)) ?? 0) - (order.get(String(b.id)) ?? 0);
  roots.sort(sorter);
  for (const [k, arr] of childrenById.entries()) {
    arr.sort(sorter);
    childrenById.set(k, arr);
  }

  return { roots, childrenById, order, byId };
}

export function ThreadTree({
  replies,
  viewerId,
  onReplyTo,
}: {
  replies: StoredReply[];
  viewerId: string | null;
  onReplyTo?: (parentId: string, label: string) => void;
}) {
  const tree = useMemo(() => buildTree(replies || []), [replies]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const isMine = (authorId: string) => {
    const v = viewerId || getStubViewerCookie() || null;
    return v ? String(authorId) === String(v) : isStubMe(authorId);
  };

  const renderNode = (r: StoredReply, level: number) => {
    const id = String(r.id);
    const mine = isMine(r.authorId);
    const { name, handle, profileHref } = computeName(r, mine);
    const when = fmtTime(Number(r.createdAt || 0));

    const kids = tree.childrenById.get(id) || [];
    const hasKids = kids.length > 0;

    const showAll = !!expanded[id];
    const visibleKids = showAll ? kids : kids.slice(0, 2);
    const hiddenCount = kids.length - visibleKids.length;

    const visualLevel = Math.max(0, Math.min(3, level));

    return (
      <div key={id} className="relative">
        <div style={{ paddingLeft: visualLevel > 0 ? 0 : 0 }}>
          <div className="flex gap-3 py-3 pr-4 group">
            <div className="relative flex-shrink-0">
              {profileHref ? (
                <Link href={profileHref} className="block" title="View profile">
                  <ReplyAvatar label={name} tone="neutral" />
                </Link>
              ) : (
                <ReplyAvatar label={name} tone="neutral" />
              )}

              {hasKids ? (
                <div className="absolute top-9 left-1/2 -translate-x-1/2 w-[2px] h-[calc(100%-10px)] bg-gray-100 rounded-full" />
              ) : null}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0">
                  {profileHref ? (
                    <Link href={profileHref} className="inline-flex items-baseline gap-2 min-w-0 hover:underline" title="View profile">
                      <span className="font-extrabold text-gray-900 text-sm truncate">{name}</span>
                      {handle ? <span className="text-xs font-bold text-gray-400 truncate">{handle}</span> : null}
                    </Link>
                  ) : (
                    <div className="inline-flex items-baseline gap-2 min-w-0">
                      <span className="font-extrabold text-gray-900 text-sm truncate">{name}</span>
                      {handle ? <span className="text-xs font-bold text-gray-400 truncate">{handle}</span> : null}
                    </div>
                  )}
                </div>

                {when ? <span className="text-gray-400 text-xs tabular-nums shrink-0">{when}</span> : null}
              </div>

              <div className="text-sm text-gray-900 leading-relaxed mt-1 whitespace-pre-wrap">{r.text}</div>

              {/* Backend currently limits nesting; Reply is root-only for now */}
              {level === 0 ? (
                <div className="mt-3">
                  <button
                    type="button"
                    className="px-3 py-2 rounded-full border border-gray-200 bg-white text-xs font-extrabold text-gray-800 hover:bg-gray-50 active:bg-gray-50/70"
                    onClick={() => onReplyTo?.(String(r.id), name)}
                  >
                    Reply
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          {hasKids ? (
            <div className="pl-4 border-l-2 border-gray-50 ml-4 space-y-2">
              {visibleKids.map((c) => renderNode(c, level + 1))}
              {hiddenCount > 0 ? (
                <div className="pl-12 py-2">
                  <button
                    type="button"
                    onClick={() => toggle(id)}
                    className="flex items-center gap-2 text-xs font-extrabold text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    <CornerDownRight className="w-3.5 h-3.5" />
                    Show {hiddenCount} more repl{hiddenCount === 1 ? "y" : "ies"}
                  </button>
                </div>
              ) : null}
              {kids.length > 2 ? (
                <div className="pl-12 py-2">
                  <button
                    type="button"
                    onClick={() => toggle(id)}
                    className="text-xs font-extrabold text-gray-500 hover:text-gray-900"
                  >
                    {showAll ? "Collapse replies" : "Show all replies"}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  return <>{tree.roots.map((r) => renderNode(r, 0))}</>;
}
`;
writeFile(TREE, TREE_SRC);
console.log("WROTE:", TREE);

// 2) Patch page.tsx: import ThreadTree + replace SentReplies flat map with <ThreadTree ... />
let s = fs.readFileSync(PAGE, "utf8");

// Ensure import exists
const importLine = 'import { ThreadTree } from "@/src/components/thread/ThreadTree";';
if (!s.includes(importLine)) {
  const imports = [...s.matchAll(/^import .*;\s*$/gm)];
  if (imports.length) {
    const last = imports[imports.length - 1];
    const idx = (last.index ?? 0) + last[0].length;
    s = s.slice(0, idx) + "\n" + importLine + s.slice(idx);
  } else {
    s = importLine + "\n" + s;
  }
}

// Replace only inside SentReplies
const sentStart = s.indexOf("function SentReplies(");
must(sentStart >= 0, "sd_952: could not find function SentReplies(");
const after = s.indexOf("function SideMismatchBanner", sentStart);
must(after >= 0, "sd_952: could not find function SideMismatchBanner after SentReplies (file shape drift).");

const sentSection = s.slice(sentStart, after);
if (sentSection.includes("<ThreadTree ")) {
  console.log("SKIP:", PAGE, "(SentReplies already uses ThreadTree)");
} else {
  const relIdx = sentSection.indexOf("{replies.map");
  must(relIdx >= 0, "sd_952: could not find '{replies.map' inside SentReplies.");

  const openIdx = sentStart + relIdx;
  const src = s;
  let i = openIdx;
  must(src[i] === "{", "sd_952 internal: expected '{' at map open index");
  let depth = 0;
  let mode = "code";

  function isEscaped(pos) {
    let back = 0;
    for (let k = pos - 1; k >= 0 && src[k] === "\\"; k--) back++;
    return back % 2 === 1;
  }

  for (; i < src.length; i++) {
    const ch = src[i];
    const nx = src[i + 1];

    if (mode === "line_comment") { if (ch === "\n") mode = "code"; continue; }
    if (mode === "block_comment") { if (ch === "*" && nx === "/") { mode = "code"; i++; } continue; }
    if (mode === "s_quote") { if (ch === "'" && !isEscaped(i)) mode = "code"; continue; }
    if (mode === "d_quote") { if (ch === '"' && !isEscaped(i)) mode = "code"; continue; }
    if (mode === "template") { if (ch === "`" && !isEscaped(i)) mode = "code"; continue; }

    if (ch === "/" && nx === "/") { mode = "line_comment"; i++; continue; }
    if (ch === "/" && nx === "*") { mode = "block_comment"; i++; continue; }
    if (ch === "'") { mode = "s_quote"; continue; }
    if (ch === '"') { mode = "d_quote"; continue; }
    if (ch === "`") { mode = "template"; continue; }

    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) {
        const closeIdx = i;
        const repl = `<ThreadTree replies={replies} viewerId={viewerId} onReplyTo={onReplyTo} />`;
        s = src.slice(0, openIdx) + repl + src.slice(closeIdx + 1);
        break;
      }
    }
  }

  must(i < src.length, "sd_952: failed to find end of replies.map(...) JSX expression.");

  fs.writeFileSync(PAGE, s, "utf8");
  console.log("PATCHED:", PAGE);
}

// 3) STATE.md update
try {
  if (fs.existsSync(STATE)) {
    const mark = "**sd_952:** Thread: recursive ThreadTree replies (tree rendering + thread rails + collapsed branches).";
    let t = fs.readFileSync(STATE, "utf8");
    if (!t.includes(mark)) {
      const line = `- ${mark}\n`;
      if (t.includes("## NEXT overlay")) t = t.replace("## NEXT overlay", "## NEXT overlay\n" + line);
      else t += "\n\n## NEXT overlay\n" + line;
      fs.writeFileSync(STATE, t, "utf8");
      console.log("PATCHED:", STATE);
    }
  }
} catch {}
NODE

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
