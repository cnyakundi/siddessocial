#!/usr/bin/env bash
set -euo pipefail

# sd_717e_side_bound_topic_tags
# Siddes-native: hashtags are NOT global discovery. They are Side-bound filing labels ("folders").
# This patch adds end-to-end support for:
# - Backend: extract tags from text, include `tags: string[]` in feed/search/post payloads
# - Backend: feed filtering with `?tag=<name>` (cache-keyed to avoid leaks)
# - Frontend: render subtle tag chips under post text + tap to filter feed
# - Frontend: feed respects `tag` query param and shows a clearable filter pill
# - Bonus: fixes a real bug: FeedView computed `set` but never passed it to list_feed (set filters were ignored)

ROOT="$(pwd)"
if [[ ! -d "$ROOT/frontend" || ! -d "$ROOT/backend" ]]; then
  echo "ERROR: Run this from your repo root (expected ./frontend and ./backend)."
  exit 1
fi

STAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="$ROOT/.backup_sd_717e_side_bound_topic_tags_${STAMP}"
mkdir -p "$BACKUP_DIR"

backup_file() {
  local rel="$1"
  if [[ -f "$ROOT/$rel" ]]; then
    mkdir -p "$BACKUP_DIR/$(dirname "$rel")"
    cp -a "$ROOT/$rel" "$BACKUP_DIR/$rel"
  fi
}

TARGETS=(
  "backend/siddes_feed/views.py"
  "backend/siddes_feed/feed_stub.py"
  "backend/siddes_post/views.py"
  "backend/siddes_search/views.py"
  "frontend/src/app/api/feed/route.ts"
  "frontend/src/lib/feedProvider.ts"
  "frontend/src/lib/feedProviders/backendStub.ts"
  "frontend/src/lib/feedInstantCache.ts"
  "frontend/src/components/SideFeed.tsx"
  "frontend/src/components/PostCard.tsx"
)

for f in "${TARGETS[@]}"; do
  backup_file "$f"
done

python3 - <<'PY'
import re
from pathlib import Path

ROOT = Path(".").resolve()

def rpath(rel: str) -> Path:
    return ROOT / rel

def read(rel: str) -> str:
    return rpath(rel).read_text(encoding="utf-8")

def write(rel: str, s: str) -> None:
    rpath(rel).write_text(s, encoding="utf-8")

def insert_after(s: str, needle: str, insert: str) -> tuple[str, bool]:
    i = s.find(needle)
    if i == -1:
        return s, False
    j = i + len(needle)
    return s[:j] + insert + s[j:], True

def ensure_import_re_py(s: str) -> str:
    if re.search(r"^import\s+re\b", s, re.M):
        return s
    if "import os\n\nimport time\n" in s:
        return s.replace("import os\n\nimport time\n", "import os\n\nimport re\n\nimport time\n", 1)
    if "import time\n" in s:
        return s.replace("import time\n", "import re\nimport time\n", 1)
    if "from __future__ import annotations\n\n" in s:
        return s.replace("from __future__ import annotations\n\n", "from __future__ import annotations\n\nimport re\n", 1)
    return "import re\n" + s

def patch_backend_feed_views():
    rel = "backend/siddes_feed/views.py"
    s = read(rel)
    if "sd_717e_topic_tags" in s and "tag=tag" in s and "set_id=set_id" in s:
        return False

    tag_block = (
        "        # sd_717e_topic_tags: Side-bound topic tag filter (hashtags as folders)\n"
        "        tag_raw = str(getattr(request, \"query_params\", {}).get(\"tag\") or \"\").strip().lower()\n"
        "        if tag_raw.startswith(\"#\"):\n"
        "            tag_raw = tag_raw[1:]\n"
        "        tag = tag_raw or None\n\n"
    )
    if "sd_717e_topic_tags: Side-bound topic tag filter" not in s:
        s, ok = insert_after(s, "        topic = topic_raw or None\n\n", tag_block)
        if not ok:
            raise RuntimeError("backend/siddes_feed/views.py: couldn't insert tag parsing block")

    s = re.sub(
        r"def _feed_cache_key\(\*, viewer: str, role: str, side: str, topic: str \| None, set_id: str \| None, limit: int, cursor: str \| None\) -> str:",
        "def _feed_cache_key(*, viewer: str, role: str, side: str, topic: str | None, tag: str | None, set_id: str | None, limit: int, cursor: str | None) -> str:",
        s,
        count=1,
    )
    if "|tag=" not in s:
        s = s.replace(
            "raw = f\"v1|viewer={viewer}|role={role}|side={side}|topic={topic or ''}|set={set_id or ''}|limit={limit}|cursor={cursor or ''}\"",
            "raw = f\"v1|viewer={viewer}|role={role}|side={side}|topic={topic or ''}|tag={tag or ''}|set={set_id or ''}|limit={limit}|cursor={cursor or ''}\"",
            1,
        )

    if "tag=tag" not in s:
        s = s.replace(
            "topic=topic,\n                set_id=set_id,",
            "topic=topic,\n                tag=tag,\n                set_id=set_id,",
            1,
        )

    # Replace first list_feed call (also fixes missing set_id pass-through)
    s = re.sub(
        r"^\s*data\s*=\s*list_feed\([^\)]*\)\s*$",
        "        data = list_feed(viewer_id=viewer, side=side, topic=topic, tag=tag, set_id=set_id, limit=limit, cursor=cursor_raw)",
        s,
        count=1,
        flags=re.M,
    )

    write(rel, s)
    return True

def patch_backend_feed_stub():
    rel = "backend/siddes_feed/feed_stub.py"
    s = read(rel)
    if "sd_717e_topic_tags: Side-bound topic tags" in s and "tag_norm" in s:
        return False

    s = ensure_import_re_py(s)

    anchor = "\n\ndef _edit_window_sec"
    if anchor not in s:
        raise RuntimeError("backend/siddes_feed/feed_stub.py: couldn't find _edit_window_sec anchor")
    helper = """

# sd_717e_topic_tags: Side-bound topic tags (hashtags as private folders)
# Rule: tags are NOT global discovery; they are local filing labels within a Side.
TOPIC_TAG_MAX = 12
_TOPIC_TAG_RE = re.compile(r'(?<![A-Za-z0-9_])#([A-Za-z0-9_]{2,32})')


def _extract_topic_tags(text: str) -> List[str]:
    s = str(text or "")
    if not s:
        return []
    out: List[str] = []
    seen: set[str] = set()
    for m in _TOPIC_TAG_RE.finditer(s):
        raw = (m.group(1) or "").strip().lower()
        if not raw:
            continue
        if raw in seen:
            continue
        seen.add(raw)
        out.append(raw)
        if len(out) >= TOPIC_TAG_MAX:
            break
    return out

"""
    if "sd_717e_topic_tags: Side-bound topic tags" not in s:
        i = s.find(anchor)
        s = s[:i] + helper + s[i:]

    if "include derived tags for UI chips" not in s:
        spot = "\n\n    if getattr(rec, \"set_id\""
        j = s.find(spot)
        if j == -1:
            raise RuntimeError("backend/siddes_feed/feed_stub.py: couldn't find hydrate insertion spot")
        ins = (
            "\n    # sd_717e_topic_tags: include derived tags for UI chips (safe, side-bound)\n"
            "    tags = _extract_topic_tags(str(getattr(rec, \"text\", \"\") or \"\"))\n"
            "    if tags:\n"
            "        out[\"tags\"] = tags\n"
        )
        s = s[:j] + ins + s[j:]

    s = re.sub(
        r"def list_feed\(viewer_id: str, side: SideId, \*, topic: str \| None = None, set_id: str \| None = None, limit: int = 200, cursor: str \| None = None\)",
        "def list_feed(viewer_id: str, side: SideId, *, topic: str | None = None, tag: str | None = None, set_id: str | None = None, limit: int = 200, cursor: str | None = None)",
        s,
        count=1,
    )

    sfilter_line = "    sfilter = str(set_id or '').strip() or None\n"
    if "tag_norm" not in s:
        if sfilter_line not in s:
            raise RuntimeError("backend/siddes_feed/feed_stub.py: couldn't find sfilter line")
        s = s.replace(
            sfilter_line,
            sfilter_line
            + "\n    # sd_717e_topic_tags: normalize tag filter\n"
            + "    tag_raw = str(tag or \"\").strip().lower()\n"
            + "    if tag_raw.startswith(\"#\"):\n"
            + "        tag_raw = tag_raw[1:]\n"
            + "    tag_norm = tag_raw or None\n",
            1,
        )

    loop_anchor = (
        "        for r in recs:\n"
        "            last_scanned = r\n\n"
        "            pid = str(getattr(r, \"id\", \"\") or \"\").strip()\n"
    )
    if "side-bound tag filter (hashtags as folders)" not in s:
        if loop_anchor not in s:
            raise RuntimeError("backend/siddes_feed/feed_stub.py: couldn't find loop anchor to inject tag filter")
        s = s.replace(
            loop_anchor,
            "        for r in recs:\n"
            "            last_scanned = r\n\n"
            "            # sd_717e_topic_tags: side-bound tag filter (hashtags as folders)\n"
            "            if tag_norm:\n"
            "                try:\n"
            "                    tgs = _extract_topic_tags(str(getattr(r, \"text\", \"\") or \"\"))\n"
            "                    if tag_norm not in tgs:\n"
            "                        continue\n"
            "                except Exception:\n"
            "                    continue\n\n"
            "            pid = str(getattr(r, \"id\", \"\") or \"\").strip()\n",
            1,
        )

    if "Final guard for tag filter" not in s:
        s = s.replace(
            "    next_cursor = None\n",
            "    # sd_717e_topic_tags: Final guard for tag filter (should already be filtered)\n"
            "    if tag_norm:\n"
            "        tn = str(tag_norm).strip().lower()\n"
            "        def _has_tag(it: dict) -> bool:\n"
            "            arr = it.get(\"tags\")\n"
            "            if not isinstance(arr, list):\n"
            "                return False\n"
            "            for x in arr:\n"
            "                if str(x).strip().lower() == tn:\n"
            "                    return True\n"
            "            return False\n"
            "        items = [it for it in items if _has_tag(it)]\n\n"
            "    next_cursor = None\n",
            1,
        )

    write(rel, s)
    return True

def patch_backend_post_views():
    rel = "backend/siddes_post/views.py"
    s = read(rel)
    if "sd_717e_topic_tags_backend" in s:
        return False

    s = ensure_import_re_py(s)

    allowed_anchor = "_ALLOWED_SIDES = {\"public\", \"friends\", \"close\", \"work\"}\n\n"
    if allowed_anchor not in s:
        raise RuntimeError("backend/siddes_post/views.py: couldn't find _ALLOWED_SIDES anchor")
    helper = """# sd_717e_topic_tags_backend: Side-bound topic tags (hashtags as folders)
TOPIC_TAG_MAX = 12
_TOPIC_TAG_RE = re.compile(r'(?<![A-Za-z0-9_])#([A-Za-z0-9_]{2,32})')


def _extract_topic_tags(text: str) -> list[str]:
    s = str(text or "")
    if not s:
        return []
    out: list[str] = []
    seen: set[str] = set()
    for m in _TOPIC_TAG_RE.finditer(s):
        raw = (m.group(1) or "").strip().lower()
        if not raw:
            continue
        if raw in seen:
            continue
        seen.add(raw)
        out.append(raw)
        if len(out) >= TOPIC_TAG_MAX:
            break
    return out


"""
    s = s.replace(allowed_anchor, allowed_anchor + helper, 1)

    urg = "    if getattr(rec, \"urgent\", False):\n        out[\"urgent\"] = True\n\n"
    if urg in s:
        s = s.replace(
            urg,
            urg
            + "    # sd_717e_topic_tags_backend: include derived tags for UI chips\n"
            + "    tags = _extract_topic_tags(str(getattr(rec, \"text\", \"\") or \"\"))\n"
            + "    if tags:\n"
            + "        out[\"tags\"] = tags\n\n",
            1,
        )

    write(rel, s)
    return True

def patch_backend_search_views():
    rel = "backend/siddes_search/views.py"
    s = read(rel)
    if "sd_717e_topic_tags" in s and "\"tag\": tag" in s:
        return False

    block_pat = (
        r"(set_id = str\(getattr\(request, \"query_params\", {}\)\.get\(\"set\"\) or \"\"\)\.strip\(\) or None\n"
        r"\s*topic = str\(getattr\(request, \"query_params\", {}\)\.get\(\"topic\"\) or \"\"\)\.strip\(\) or None\n\n)"
    )
    m = re.search(block_pat, s)
    if not m:
        raise RuntimeError("backend/siddes_search/views.py: couldn't find set/topic block")
    if "sd_717e_topic_tags: side-bound tag filter" not in s:
        s = s[:m.start(1)] + m.group(1) + "        # sd_717e_topic_tags: side-bound tag filter\n        tag = str(getattr(request, \"query_params\", {}).get(\"tag\") or \"\").strip() or None\n\n" + s[m.end(1):]

    topic_anchor = "        if side == \"public\" and topic:\n            qs = qs.filter(public_channel=topic)\n"
    if topic_anchor in s and "cheap prefilter" not in s:
        s = s.replace(
            topic_anchor,
            topic_anchor
            + "        # sd_717e_topic_tags: cheap prefilter (still enforced by extractor in feed hydration)\n"
            + "        if tag:\n"
            + "            tn = str(tag).strip()\n"
            + "            if tn.startswith(\"#\"): tn = tn[1:]\n"
            + "            tn = tn.strip()\n"
            + "            if tn:\n"
            + "                qs = qs.filter(text__icontains=\"#\" + tn)\n",
            1,
        )

    s = s.replace(
        "\"filters\": {\"side\": side, \"set\": set_id, \"topic\": topic}",
        "\"filters\": {\"side\": side, \"set\": set_id, \"topic\": topic, \"tag\": tag}",
        1,
    )

    up_anchor = "        qs = Post.objects.filter(side=\"public\", is_hidden=False, author_id=author_token).order_by(\"-created_at\")\n"
    if up_anchor in s and "optional tag filter for profile public posts" not in s:
        s = s.replace(
            up_anchor,
            up_anchor
            + "        # sd_717e_topic_tags: optional tag filter for profile public posts\n"
            + "        tag = str(getattr(request, \"query_params\", {}).get(\"tag\") or \"\").strip() or None\n"
            + "        if tag:\n"
            + "            tn = str(tag).strip()\n"
            + "            if tn.startswith(\"#\"): tn = tn[1:]\n"
            + "            tn = tn.strip()\n"
            + "            if tn:\n"
            + "                qs = qs.filter(text__icontains=\"#\" + tn)\n",
            1,
        )

    write(rel, s)
    return True

def patch_frontend_feed_provider_types():
    rel = "frontend/src/lib/feedProvider.ts"
    s = read(rel)
    if "tag?: string | null" in s:
        return False
    s = s.replace(
        "opts?: { topic?: string | null; set?: string | null; limit?: number; cursor?: string | null }",
        "opts?: { topic?: string | null; tag?: string | null; set?: string | null; limit?: number; cursor?: string | null }",
        1,
    )
    s = s.replace(
        "list: (side: SideId, opts?: { topic?: string | null; set?: string | null }) => Promise<FeedItem[]>;",
        "list: (side: SideId, opts?: { topic?: string | null; tag?: string | null; set?: string | null }) => Promise<FeedItem[]>;",
        1,
    )
    write(rel, s)
    return True

def patch_frontend_backend_stub_provider():
    rel = "frontend/src/lib/feedProviders/backendStub.ts"
    s = read(rel)
    if "u.searchParams.set(\"tag\"" in s and "tag?: string | null" in s:
        return False

    s = s.replace(
        "opts?: { topic?: string | null; set?: string | null; limit?: number; cursor?: string | null }",
        "opts?: { topic?: string | null; tag?: string | null; set?: string | null; limit?: number; cursor?: string | null }",
    )
    if "u.searchParams.set(\"tag\"" not in s:
        s = s.replace(
            "  if (opts?.topic) u.searchParams.set(\"topic\", String(opts.topic));\n",
            "  if (opts?.topic) u.searchParams.set(\"topic\", String(opts.topic));\n  if (opts?.tag) u.searchParams.set(\"tag\", String(opts.tag));\n",
            1,
        )
    s = s.replace(
        "opts: { topic?: string | null; set?: string | null; limit?: number; cursor?: string | null }",
        "opts: { topic?: string | null; tag?: string | null; set?: string | null; limit?: number; cursor?: string | null }",
        1,
    )
    s = s.replace(
        "const res = await fetchWithFallback(side, { topic: opts?.topic ?? null, set: (opts as any)?.set ?? null, limit, cursor });",
        "const res = await fetchWithFallback(side, { topic: opts?.topic ?? null, tag: (opts as any)?.tag ?? null, set: (opts as any)?.set ?? null, limit, cursor });",
        1,
    )
    s = s.replace(
        "async list(side: SideId, opts?: { topic?: string | null; set?: string | null }): Promise<FeedItem[]>",
        "async list(side: SideId, opts?: { topic?: string | null; tag?: string | null; set?: string | null }): Promise<FeedItem[]>",
        1,
    )
    s = s.replace(
        "const page = await backendStubProvider.listPage(side, { topic: opts?.topic ?? null, set: (opts as any)?.set ?? null, limit: 50, cursor: null })",
        "const page = await backendStubProvider.listPage(side, { topic: opts?.topic ?? null, tag: (opts as any)?.tag ?? null, set: (opts as any)?.set ?? null, limit: 50, cursor: null })",
        1,
    )

    write(rel, s)
    return True

def patch_frontend_api_feed_route():
    rel = "frontend/src/app/api/feed/route.ts"
    s = read(rel)
    if "searchParams.get(\"tag\")" in s:
        return False
    anchor = "  const topic = (url.searchParams.get(\"topic\") || \"\").trim();\n  if (topic) proxUrl.searchParams.set(\"topic\", topic);\n\n"
    if anchor not in s:
        raise RuntimeError("frontend/src/app/api/feed/route.ts: couldn't find topic anchor to insert tag")
    s = s.replace(
        anchor,
        anchor + "  const tag = (url.searchParams.get(\"tag\") || \"\").trim();\n  if (tag) proxUrl.searchParams.set(\"tag\", tag);\n\n",
        1,
    )
    write(rel, s)
    return True

def patch_frontend_feed_instant_cache():
    rel = "frontend/src/lib/feedInstantCache.ts"
    s = read(rel)
    if "|tag:" in s:
        return False
    s = s.replace(
        "  topic?: string | null;\n  setId?: string | null;\n",
        "  topic?: string | null;\n  tag?: string | null;\n  setId?: string | null;\n",
        1,
    )
    s = s.replace(
        "  const topic = String(args.topic || \"\").trim() || \"_\";\n  const setId = String(args.setId || \"\").trim() || \"_\";\n",
        "  const topic = String(args.topic || \"\").trim() || \"_\";\n  const tag = String(args.tag || \"\").trim() || \"_\";\n  const setId = String(args.setId || \"\").trim() || \"_\";\n",
        1,
    )
    s = s.replace(
        "  return `feed:v1|epoch:${args.epoch}|viewer:${args.viewerId}|side:${args.side}|topic:${topic}|set:${setId}|cursor:${cursor}|limit:${limit}`;",
        "  return `feed:v1|epoch:${args.epoch}|viewer:${args.viewerId}|side:${args.side}|topic:${topic}|tag:${tag}|set:${setId}|cursor:${cursor}|limit:${limit}`;",
        1,
    )
    write(rel, s)
    return True

def patch_frontend_side_feed():
    rel = "frontend/src/components/SideFeed.tsx"
    s = read(rel)
    if "sd_717e_topic_tags" in s and "useSearchParams" in s and "clearTagFilter" in s:
        return False

    s = s.replace(
        'import { useRouter } from "next/navigation";',
        'import { useRouter, useSearchParams } from "next/navigation";',
        1,
    )

    anchor = "  const router = useRouter();\n"
    if anchor not in s:
        raise RuntimeError("frontend/src/components/SideFeed.tsx: couldn't find router line")

    if "clearTagFilter" not in s:
        tag_block = (
            "  const sp = useSearchParams();\n"
            "  const activeTagRaw = (sp.get(\"tag\") || \"\").trim();\n"
            "  const activeTagLabel = activeTagRaw ? activeTagRaw.replace(/^#/, \"\").trim() : \"\";\n"
            "  const activeTag = activeTagLabel ? activeTagLabel.toLowerCase() : null;\n\n"
            "  const clearTagFilter = useCallback(() => {\n"
            "    if (typeof window === \"undefined\") return;\n"
            "    try {\n"
            "      const u = new URL(window.location.href);\n"
            "      u.searchParams.delete(\"tag\");\n"
            "      u.searchParams.set(\"r\", String(Date.now()));\n"
            "      router.replace(u.pathname + u.search);\n"
            "    } catch {\n"
            "      router.replace(\"/siddes-feed?r=\" + String(Date.now()));\n"
            "    }\n"
            "  }, [router]);\n\n"
            "  // sd_717e_topic_tags: keep feed fetch/caching keyed by tag filter\n"
        )
        s = s.replace(anchor, anchor + tag_block, 1)

    s = s.replace(
        "const page = await provider.listPage(side, {\n        topic,\n        set: side !== \"public\" ? (activeSet || null) : null,\n        limit: PAGE_LIMIT,\n        cursor: nextCursor,\n      });",
        "const page = await provider.listPage(side, {\n        topic,\n        tag: activeTag,\n        set: side !== \"public\" ? (activeSet || null) : null,\n        limit: PAGE_LIMIT,\n        cursor: nextCursor,\n      });",
        1,
    )
    s = s.replace(
        "const page = await provider.listPage(side, { topic, set: setId, limit: PAGE_LIMIT, cursor: null });",
        "const page = await provider.listPage(side, { topic, tag: activeTag, set: setId, limit: PAGE_LIMIT, cursor: null });",
        1,
    )

    s = s.replace(
        "          side,\n          topic,\n          setId,\n          cursor: null,\n          limit: PAGE_LIMIT,",
        "          side,\n          topic,\n          tag: activeTag,\n          setId,\n          cursor: null,\n          limit: PAGE_LIMIT,",
        1,
    )

    ui_anchor = "        ) : null}\n        {restricted ? (\n"
    if "Filtered:" not in s:
        if ui_anchor not in s:
            raise RuntimeError("frontend/src/components/SideFeed.tsx: couldn't find insertion point for filter UI")
        ui = (
            "        ) : null}\n"
            "        {/* sd_717e_topic_tags: Side-bound tag filter UI */}\n"
            "        {activeTag ? (\n"
            "          <div className={cn(\"mb-3 px-3 py-2 rounded-2xl border flex items-center justify-between\", theme.lightBg, theme.border, theme.text)}>\n"
            "            <div className=\"text-xs font-extrabold truncate\">Filtered: <span className=\"font-black\">#{activeTagLabel}</span></div>\n"
            "            <button\n"
            "              type=\"button\"\n"
            "              onClick={clearTagFilter}\n"
            "              className=\"ml-3 px-3 py-1.5 rounded-full bg-white/70 hover:bg-white border border-gray-200 text-xs font-extrabold text-gray-900\"\n"
            "              aria-label=\"Clear tag filter\"\n"
            "            >\n"
            "              Clear\n"
            "            </button>\n"
            "          </div>\n"
            "        ) : null}\n"
            "        {restricted ? (\n"
        )
        s = s.replace(ui_anchor, ui, 1)

    write(rel, s)
    return True

def patch_frontend_post_card():
    rel = "frontend/src/components/PostCard.tsx"
    s = read(rel)
    if "sd_717e_topic_tags" in s and "topicTags" in s and "Filter by #" in s:
        return False

    anchor = "  const pathname = usePathname();\n"
    if anchor not in s:
        raise RuntimeError("frontend/src/components/PostCard.tsx: couldn't find pathname anchor")

    if "sd_717e_topic_tags: Side-bound topic tags" not in s:
        insert = anchor + """
  // sd_717e_topic_tags: Side-bound topic tags (#) are local filing labels, not global discovery.
  const topicTags = useMemo(() => {
    const arr = (post as any)?.tags;
    if (!Array.isArray(arr)) return [] as string[];
    const internal = new Set(["urgent"]);
    const out: string[] = [];
    for (const raw of arr as any[]) {
      const t0 = String(raw || "").trim();
      if (!t0) continue;
      const t1 = (t0.startsWith("#") ? t0.slice(1) : t0).trim();
      if (!t1) continue;
      const t = t1.toLowerCase();
      if (internal.has(t)) continue;
      if (out.includes(t)) continue;
      out.push(t);
      if (out.length >= 8) break;
    }
    return out;
  }, [post]);

  const onTagClick = React.useCallback(
    (e: React.MouseEvent, tag: string) => {
      e.preventDefault();
      e.stopPropagation();
      const t = String(tag || "").trim();
      if (!t) return;
      try {
        // Preserve the scroll position so Back feels native.
        saveReturnScroll(pathname || "/siddes-feed", window.scrollY);
      } catch {}
      router.push(`/siddes-feed?tag=${encodeURIComponent(t)}&r=${Date.now()}`);
    },
    [router, pathname]
  );

"""
        s = s.replace(anchor, insert, 1)

    ui_anchor = "          ) : null}\n\n          {isEchoPost && echoOf ? (\n"
    if "tag chips (subtle, folder-like)" not in s:
        if ui_anchor not in s:
            raise RuntimeError("frontend/src/components/PostCard.tsx: couldn't find insertion point for tag UI")
        ui = """          ) : null}

          {/* sd_717e_topic_tags: tag chips (subtle, folder-like) */}
          {topicTags.length ? (
            <div className="flex flex-wrap gap-2 mb-3">
              {topicTags.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={(e) => onTagClick(e, t)}
                  className={cn(
                    "text-[11px] px-2 py-1 rounded-full border font-extrabold tracking-wide",
                    theme.lightBg,
                    theme.text,
                    theme.border,
                    "hover:opacity-90"
                  )}
                  aria-label={`Filter by #${t}`}
                  title={`Filter by #${t}`}
                >
                  #{t}
                </button>
              ))}
            </div>
          ) : null}

          {isEchoPost && echoOf ? (
"""
        s = s.replace(ui_anchor, ui, 1)

    write(rel, s)
    return True

patched = []
def run(name, fn):
    changed = fn()
    if changed:
        patched.append(name)

run("backend/siddes_feed/views.py", patch_backend_feed_views)
run("backend/siddes_feed/feed_stub.py", patch_backend_feed_stub)
run("backend/siddes_post/views.py", patch_backend_post_views)
run("backend/siddes_search/views.py", patch_backend_search_views)

run("frontend/src/lib/feedProvider.ts", patch_frontend_feed_provider_types)
run("frontend/src/lib/feedProviders/backendStub.ts", patch_frontend_backend_stub_provider)
run("frontend/src/app/api/feed/route.ts", patch_frontend_api_feed_route)
run("frontend/src/lib/feedInstantCache.ts", patch_frontend_feed_instant_cache)
run("frontend/src/components/SideFeed.tsx", patch_frontend_side_feed)
run("frontend/src/components/PostCard.tsx", patch_frontend_post_card)

print("PATCHED:", ", ".join(patched) if patched else "(already applied)")
PY

echo ""
echo "✅ sd_717e applied."
echo "Backup: $BACKUP_DIR"
echo ""
echo "Next (VS Code terminal):"
echo "  ./verify_overlays.sh"
echo "  ./scripts/run_tests.sh"
echo "  cd frontend && npm run typecheck && npm run build"
echo ""
echo "Smoke test:"
echo "  1) Create a post with hashtags, e.g. 'Weekend plans #travel #food'"
echo "  2) Feed cards should show subtle chips: #travel #food"
echo "  3) Tap a chip → feed filters to that tag (URL has ?tag=travel)"
echo "  4) Clear button removes the filter"
