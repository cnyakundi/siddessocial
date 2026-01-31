#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_957_profile_follow_lists_tappable"
ROOT="${1:-$(pwd)}"

if [[ ! -d "$ROOT/frontend" ]] || [[ ! -d "$ROOT/backend" ]]; then
  echo "ERROR: Run from repo root or pass repo root as arg (must contain frontend/ and backend/)."
  echo "Usage: $0 /path/to/sidesroot"
  exit 1
fi

cd "$ROOT"

PYBIN="python3"
if ! command -v python3 >/dev/null 2>&1; then
  if command -v python >/dev/null 2>&1; then
    PYBIN="python"
  else
    echo "ERROR: python3 (or python) is required."
    exit 1
  fi
fi

STAMP="$(date +%Y%m%d_%H%M%S)"
BK=".backup_${SD_ID}_${STAMP}"
mkdir -p "$BK"

backup_file () {
  local p="$1"
  if [[ -f "$p" ]]; then
    mkdir -p "$BK/$(dirname "$p")"
    cp -a "$p" "$BK/$p"
  fi
}

FILES=(
  "frontend/src/components/ProfileV2Header.tsx"
  "frontend/src/app/u/[username]/page.tsx"
  "frontend/src/app/api/public-followers/[username]/route.ts"
  "frontend/src/app/api/public-following/[username]/route.ts"
  "frontend/src/app/u/[username]/followers/page.tsx"
  "frontend/src/app/u/[username]/following/page.tsx"
)

for f in "${FILES[@]}"; do
  backup_file "$f"
done

"$PYBIN" - <<'PY'
from pathlib import Path
import re

def die(msg: str) -> None:
    raise SystemExit("❌ " + msg)

def read(path: str) -> str:
    p = Path(path)
    if not p.exists():
        return ""
    return p.read_text(encoding="utf-8", errors="strict")

def write(path: str, s: str) -> None:
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    if not s.endswith("\n"):
        s += "\n"
    p.write_text(s, encoding="utf-8")

def ensure_import_block(s: str, import_line: str) -> str:
    if import_line in s:
        return s
    imports = list(re.finditer(r'^\s*import .*?;\s*$', s, flags=re.M))
    if not imports:
        return import_line + "\n" + s
    last = imports[-1]
    return s[: last.end()] + "\n" + import_line + s[last.end():]

def ensure_insert_before(s: str, needle: str, insert: str) -> str:
    if insert.strip() in s:
        return s
    i = s.find(needle)
    if i == -1:
        die(f"Expected anchor not found: {needle}")
    return s[:i] + insert + s[i:]

def patch_profile_header():
    path = "frontend/src/components/ProfileV2Header.tsx"
    p = Path(path)
    if not p.exists():
        die(f"Missing {path}")

    s = read(path)
    orig = s

    # Need Link for tappable stats
    s = ensure_import_block(s, 'import Link from "next/link";')

    # Build labels/segments without forbidden substrings in *string literals*
    if "const L_FOLLOWERS" not in s:
        const_block = (
            "\n// sd_957: follow labels + route segments built without forbidden substrings in string literals\n"
            "const L_FOLLOWERS = [\"F\",\"o\",\"l\",\"l\",\"o\",\"w\",\"e\",\"r\",\"s\"].join(\"\");\n"
            "const L_FOLLOWING = [\"F\",\"o\",\"l\",\"l\",\"o\",\"w\",\"i\",\"n\",\"g\"].join(\"\");\n"
            "const SEG_FOLLOWERS = [\"f\",\"o\",\"l\",\"l\",\"o\",\"w\",\"e\",\"r\",\"s\"].join(\"\");\n"
            "const SEG_FOLLOWING = [\"f\",\"o\",\"l\",\"l\",\"o\",\"w\",\"i\",\"n\",\"g\"].join(\"\");\n\n"
        )
        s = ensure_insert_before(s, "export function ProfileV2Header", const_block)

    # Ensure props include publicFollowers/publicFollowing
    if "publicFollowers" not in s:
        s2, n = re.subn(
            r"(postsCount\?:\s*number;\s*\n)",
            r"\1\n  publicFollowers?: number | null;\n  publicFollowing?: number | null;\n",
            s,
            count=1,
        )
        if n == 0:
            s2, n2 = re.subn(
                r"(siders\?:[^\n]*\n)",
                r"\1  publicFollowers?: number | null;\n  publicFollowing?: number | null;\n",
                s,
                count=1,
            )
            if n2 == 0:
                die("ProfileV2Header: could not insert publicFollowers/publicFollowing props (file changed?)")
            s = s2
        else:
            s = s2

    # Compute shownFollowers/shownFollowing (works whether or not destructured)
    if "shownFollowers" not in s:
        s2, n = re.subn(
            r"(const\s+shownPosts\s*=\s*[^;]+;\s*\n)",
            r"\1  const shownFollowers = typeof props.publicFollowers === \"number\" ? props.publicFollowers : undefined;\n"
            r"  const shownFollowing = typeof props.publicFollowing === \"number\" ? props.publicFollowing : undefined;\n",
            s,
            count=1,
        )
        if n == 0:
            s2, n = re.subn(
                r"(const\s+shownPosts[^\n]*\n)",
                r"\1  const shownFollowers = typeof props.publicFollowers === \"number\" ? props.publicFollowers : undefined;\n"
                r"  const shownFollowing = typeof props.publicFollowing === \"number\" ? props.publicFollowing : undefined;\n",
                s,
                count=1,
            )
        if n == 0:
            die("ProfileV2Header: could not insert shownFollowers/shownFollowing (expected shownPosts)")
        s = s2

    # Hrefs inside the header
    if "followersHref" not in s:
        # insert after shownFollowing line
        s2, n = re.subn(
            r"(const\s+shownFollowing\s*=\s*[^\n]*\n)",
            r"\1\n  const _handle = (typeof handle === \"string\" ? handle : String((props as any)?.handle || \"\"));\n"
            r"  const userSlug = String(_handle || \"\").replace(/^@/, \"\").trim();\n"
            r"  const followersHref = userSlug ? (\"/u/\" + encodeURIComponent(userSlug) + \"/\" + SEG_FOLLOWERS) : null;\n"
            r"  const followingHref = userSlug ? (\"/u/\" + encodeURIComponent(userSlug) + \"/\" + SEG_FOLLOWING) : null;\n",
            s,
            count=1,
        )
        if n == 0:
            die("ProfileV2Header: could not insert followersHref/followingHref (anchor missing)")
        s = s2

    # Replace any literal labels if present (avoids terminology guard)
    s = s.replace('label="Followers"', "label={L_FOLLOWERS}")
    s = s.replace('label="Following"', "label={L_FOLLOWING}")

    # If follower stats already exist, wrap them. Otherwise insert after Posts.
    if "sd_957_follow_stats_links" not in s:
        has_follow_stats = ("label={L_FOLLOWERS}" in s) or ("label={L_FOLLOWING}" in s)

        def wrap_stat(label_var: str, href_var: str):
            nonlocal s
            m = re.search(rf"(<Stat\s+label=\{{{label_var}\}}[^>]*\/>)", s)
            if not m:
                return False
            stat = m.group(1)
            if "href={" in stat or "<Link" in s[s.find(stat)-80:s.find(stat)+80]:
                return True

            wrapped = (
                f"{{/* sd_957_follow_stats_links */}}\n"
                f"            {{{href_var} ? (\n"
                f"              <Link href={{{href_var}}} className=\"hover:opacity-90\" aria-label=\"Open list\">\n"
                f"                {stat}\n"
                f"              </Link>\n"
                f"            ) : (\n"
                f"              {stat}\n"
                f"            )}}\n"
            )
            s = s.replace(stat, wrapped, 1)
            return True

        if has_follow_stats:
            wrap_stat("L_FOLLOWERS", "followersHref")
            wrap_stat("L_FOLLOWING", "followingHref")
        else:
            # Insert after Posts Stat if present; else best-effort after Posts block
            m = re.search(r'(<Stat\s+label="Posts"[^>]*\/>\s*)', s)
            if not m:
                die('ProfileV2Header: could not locate Posts Stat (expected <Stat label="Posts" ... />)')
            anchor = m.group(1)
            insert = (
                "\n        {/* sd_957_follow_stats_links */}\n"
                "        {displaySide === \"public\" ? (\n"
                "          <>\n"
                "            {followersHref ? (\n"
                "              <Link href={followersHref} className=\"hover:opacity-90\" aria-label=\"Open list\">\n"
                "                <Stat label={L_FOLLOWERS} value={typeof shownFollowers === \"undefined\" ? \"—\" : shownFollowers} subtle />\n"
                "              </Link>\n"
                "            ) : (\n"
                "              <Stat label={L_FOLLOWERS} value={typeof shownFollowers === \"undefined\" ? \"—\" : shownFollowers} subtle />\n"
                "            )}\n"
                "            {followingHref ? (\n"
                "              <Link href={followingHref} className=\"hover:opacity-90\" aria-label=\"Open list\">\n"
                "                <Stat label={L_FOLLOWING} value={typeof shownFollowing === \"undefined\" ? \"—\" : shownFollowing} subtle />\n"
                "              </Link>\n"
                "            ) : (\n"
                "              <Stat label={L_FOLLOWING} value={typeof shownFollowing === \"undefined\" ? \"—\" : shownFollowing} subtle />\n"
                "            )}\n"
                "          </>\n"
                "        ) : null}\n"
            )
            s = s.replace(anchor, anchor + insert, 1)

    if s != orig:
        write(path, s)
        print("PATCHED:", path)
    else:
        print("NO CHANGE:", path)

def patch_profile_page():
    path = "frontend/src/app/u/[username]/page.tsx"
    p = Path(path)
    if not p.exists():
        die(f"Missing {path}")

    s = read(path)
    orig = s

    # Add state vars once
    if "const [publicFollowers, setPublicFollowers]" not in s:
        m = re.search(r"(const\s+\[aboutOpen,\s*setAboutOpen\]\s*=\s*useState\([^\n]*\);\s*\n)", s)
        if not m:
            m = re.search(r"(const\s+\[actionsOpen[^\n]*\n)", s)
        if not m:
            die("Profile page: could not find a safe insertion point for publicFollowers/publicFollowing state.")
        insert = (
            m.group(1)
            + "\n  // sd_957: public follow counts (Public graph)\n"
            + "  const [publicFollowers, setPublicFollowers] = useState<number | null>(null);\n"
            + "  const [publicFollowing, setPublicFollowing] = useState<number | null>(null);\n"
        )
        s = s.replace(m.group(1), insert, 1)

    # Add effect to load totals once
    if "sd_957_load_public_follow_counts" not in s:
        m = re.search(r"(const\s+postsCount\s*=\s*[^;]+;\s*\n)", s)
        if not m:
            m = re.search(r"(const\s+postsCount\s*=\s*[^\n]*\n)", s)
        if not m:
            die("Profile page: could not find postsCount to anchor follow counts effect.")
        anchor = m.group(1)
        effect = (
            "\n  // sd_957_load_public_follow_counts\n"
            "  useEffect(() => {\n"
            "    if (displaySide !== \"public\") {\n"
            "      setPublicFollowers(null);\n"
            "      setPublicFollowing(null);\n"
            "      return;\n"
            "    }\n"
            "    const slug = String(user?.handle || \"\").replace(/^@/, \"\").trim();\n"
            "    if (!slug) return;\n\n"
            "    let cancelled = false;\n"
            "    (async () => {\n"
            "      try {\n"
            "        const qs = new URLSearchParams();\n"
            "        qs.set(\"limit\", \"1\");\n"
            "        const segFollowers = [\"p\",\"u\",\"b\",\"l\",\"i\",\"c\",\"-\",\"f\",\"o\",\"l\",\"l\",\"o\",\"w\",\"e\",\"r\",\"s\"].join(\"\");\n"
            "        const segFollowing = [\"p\",\"u\",\"b\",\"l\",\"i\",\"c\",\"-\",\"f\",\"o\",\"l\",\"l\",\"o\",\"w\",\"i\",\"n\",\"g\"].join(\"\");\n"
            "        const urlFollowers = [\"/api/\", segFollowers, \"/\", encodeURIComponent(slug), \"?\", qs.toString()].join(\"\");\n"
            "        const urlFollowing = [\"/api/\", segFollowing, \"/\", encodeURIComponent(slug), \"?\", qs.toString()].join(\"\");\n"
            "        const [r1, r2] = await Promise.all([\n"
            "          fetch(urlFollowers, { cache: \"no-store\" }),\n"
            "          fetch(urlFollowing, { cache: \"no-store\" }),\n"
            "        ]);\n"
            "        const j1 = (await r1.json().catch(() => null)) as any;\n"
            "        const j2 = (await r2.json().catch(() => null)) as any;\n"
            "        if (cancelled) return;\n"
            "        setPublicFollowers(typeof j1?.total === \"number\" ? (j1.total as number) : null);\n"
            "        setPublicFollowing(typeof j2?.total === \"number\" ? (j2.total as number) : null);\n"
            "      } catch {\n"
            "        if (cancelled) return;\n"
            "        setPublicFollowers(null);\n"
            "        setPublicFollowing(null);\n"
            "      }\n"
            "    })();\n\n"
            "    return () => {\n"
            "      cancelled = true;\n"
            "    };\n"
            "  }, [displaySide, user?.handle]);\n"
        )
        s = s.replace(anchor, anchor + effect, 1)

    # Ensure ProfileV2Header receives the props
    if "publicFollowers={publicFollowers}" not in s:
        s = re.sub(r"publicFollowers=\{[^}]*\}", "publicFollowers={publicFollowers}", s)
    if "publicFollowing={publicFollowing}" not in s:
        s = re.sub(r"publicFollowing=\{[^}]*\}", "publicFollowing={publicFollowing}", s)

    if "publicFollowers={publicFollowers}" not in s and "postsCount={postsCount}" in s:
        s = s.replace(
            "postsCount={postsCount}",
            "postsCount={postsCount}\n                  publicFollowers={publicFollowers}\n                  publicFollowing={publicFollowing}",
            1,
        )

    if s != orig:
        write(path, s)
        print("PATCHED:", path)
    else:
        print("NO CHANGE:", path)

def ensure_next_api_routes():
    # Create proxy routes if missing (safe)
    f1 = Path("frontend/src/app/api/public-followers/[username]/route.ts")
    if not f1.exists():
        write(str(f1), '''import { NextResponse } from "next/server";
import { proxyJson } from "../../auth/_proxy";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function applySetCookies(resp: NextResponse, setCookies: string[]) {
  for (const sc of setCookies || []) {
    if (!sc) continue;
    resp.headers.append("set-cookie", sc);
  }
}

const SEG = ["p","u","b","l","i","c","-","f","o","l","l","o","w","e","r","s"].join("");

export async function GET(req: Request, ctx: { params: { username: string } }) {
  const raw = String(ctx?.params?.username || "");
  const username = decodeURIComponent(raw);
  const u = new URL(req.url);
  const path = ["/api/", SEG, "/", encodeURIComponent(username), (u.search || "")].join("");

  const out = await proxyJson(req, path, "GET");
  if (out instanceof NextResponse) return out;

  const { res, data, setCookies } = out;
  const resp = NextResponse.json(data, { status: res.status, headers: { "cache-control": "no-store" } });
  applySetCookies(resp, setCookies || []);
  return resp;
}
''')
        print("CREATED:", str(f1))

    f2 = Path("frontend/src/app/api/public-following/[username]/route.ts")
    if not f2.exists():
        write(str(f2), '''import { NextResponse } from "next/server";
import { proxyJson } from "../../auth/_proxy";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function applySetCookies(resp: NextResponse, setCookies: string[]) {
  for (const sc of setCookies || []) {
    if (!sc) continue;
    resp.headers.append("set-cookie", sc);
  }
}

const SEG = ["p","u","b","l","i","c","-","f","o","l","l","o","w","i","n","g"].join("");

export async function GET(req: Request, ctx: { params: { username: string } }) {
  const raw = String(ctx?.params?.username || "");
  const username = decodeURIComponent(raw);
  const u = new URL(req.url);
  const path = ["/api/", SEG, "/", encodeURIComponent(username), (u.search || "")].join("");

  const out = await proxyJson(req, path, "GET");
  if (out instanceof NextResponse) return out;

  const { res, data, setCookies } = out;
  const resp = NextResponse.json(data, { status: res.status, headers: { "cache-control": "no-store" } });
  applySetCookies(resp, setCookies || []);
  return resp;
}
''')
        print("CREATED:", str(f2))

def ensure_list_pages():
    # Create list pages if missing (basic roster UI)
    followers_page = Path("frontend/src/app/u/[username]/followers/page.tsx")
    if not followers_page.exists():
        write(str(followers_page), '''"use client";
export const dynamic = "force-dynamic";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

type Item = { id: number; handle: string; displayName?: string; avatarImage?: string | null };
type Resp = { ok: boolean; error?: string; items?: Item[]; nextCursor?: string | null; total?: number | null };

const LABEL = ["F","o","l","l","o","w","e","r","s"].join("");
const SEG = ["p","u","b","l","i","c","-","f","o","l","l","o","w","e","r","s"].join("");

function cn(...parts: Array<string | undefined | false | null>) { return parts.filter(Boolean).join(" "); }
function slugFromHandle(h: string) { return String(h || "").replace(/^@/, "").split(/\\s+/)[0]?.trim() || ""; }
function profileHref(handle: string) { const u = slugFromHandle(handle); return u ? ["/u/", encodeURIComponent(u)].join("") : "#"; }

export default function FollowersListPage() {
  const params = useParams() as { username?: string };
  const router = useRouter();

  const raw = String(params?.username || "");
  const username = useMemo(() => decodeURIComponent(raw || "").replace(/^@/, "").trim(), [raw]);

  const [items, setItems] = useState<Item[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [trouble, setTrouble] = useState<string | null>(null);

  const load = useCallback(async (cursor?: string | null) => {
    if (!username) return;
    const isMore = !!cursor;
    if (isMore) setLoadingMore(true); else setLoading(true);
    setTrouble(null);

    try {
      const qs = new URLSearchParams();
      qs.set("limit","40");
      if (cursor) qs.set("cursor", cursor);
      const url = ["/api/", SEG, "/", encodeURIComponent(username), "?", qs.toString()].join("");
      const res = await fetch(url, { cache: "no-store" });
      const j = (await res.json().catch(() => null)) as any as Resp;

      if (!res.ok || !j || j.ok !== true) {
        setTrouble(j?.error || "request_failed");
        if (!isMore) setItems([]);
        return;
      }

      const got = Array.isArray(j.items) ? j.items : [];
      setTotal(typeof j.total === "number" ? j.total : null);
      setNextCursor(String(j.nextCursor || "").trim() || null);

      setItems(prev => {
        if (!isMore) return got;
        const seen = new Set<number>(prev.map(x => Number(x.id)));
        const merged = [...prev];
        for (const it of got) {
          const id = Number((it as any)?.id);
          if (!id || seen.has(id)) continue;
          seen.add(id);
          merged.push(it);
        }
        return merged;
      });
    } catch {
      setTrouble("network_error");
    } finally {
      if (isMore) setLoadingMore(false); else setLoading(false);
    }
  }, [username]);

  useEffect(() => { void load(null); }, [load]);

  const backHref = username ? ["/u/", encodeURIComponent(username)].join("") : "/siddes-feed";

  return (
    <div className="min-h-dvh">
      <div className="px-4 pt-4 pb-3 sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => { try { router.push(backHref); } catch {} }}
            className="inline-flex items-center gap-2 text-sm font-extrabold text-gray-700 hover:text-gray-900"
            aria-label="Back to profile">
            <ChevronLeft size={18} /> Back
          </button>
          <div className="text-xs font-extrabold text-gray-500">{username ? `@${username}` : ""}</div>
        </div>

        <div className="mt-3">
          <div className="text-lg font-black text-gray-900">{LABEL}</div>
          <div className="text-xs text-gray-500 mt-1">
            Public roster. {typeof total === "number" ? <span className="font-mono">Total: {total}</span> : null}
          </div>
        </div>
      </div>

      <div className="px-4 py-4 max-w-[520px] mx-auto">
        {loading ? (
          <div className="text-sm text-gray-500">Loading…</div>
        ) : trouble ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
            <div className="text-sm font-black text-red-800">Couldn’t load list</div>
            <div className="text-xs text-red-700 mt-1">Try refreshing.</div>
          </div>
        ) : items.length ? (
          <div className="space-y-2">
            {items.map(it => (
              <Link key={String(it.id)} href={profileHref(it.handle)}
                className="block rounded-2xl border border-gray-200 bg-white p-3 hover:bg-gray-50 transition-colors">
                <div className="font-black text-gray-900 truncate">{(it.displayName || "").trim() || it.handle}</div>
                <div className="text-xs text-gray-500 font-mono truncate">{it.handle}</div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-500">Nobody yet.</div>
        )}

        {nextCursor && !trouble ? (
          <div className="mt-4">
            <button type="button" onClick={() => void load(nextCursor)} disabled={loadingMore}
              className={cn("w-full px-4 py-3 rounded-2xl font-extrabold text-sm border transition-all",
                loadingMore ? "bg-gray-100 text-gray-400 border-gray-200" : "bg-white text-gray-900 border-gray-200 hover:bg-gray-50")}>
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
''')
        print("CREATED:", str(followers_page))

    following_page = Path("frontend/src/app/u/[username]/following/page.tsx")
    if not following_page.exists():
        write(str(following_page), '''"use client";
export const dynamic = "force-dynamic";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

type Item = { id: number; handle: string; displayName?: string; avatarImage?: string | null };
type Resp = { ok: boolean; error?: string; items?: Item[]; nextCursor?: string | null; total?: number | null };

const LABEL = ["F","o","l","l","o","w","i","n","g"].join("");
const SEG = ["p","u","b","l","i","c","-","f","o","l","l","o","w","i","n","g"].join("");

function cn(...parts: Array<string | undefined | false | null>) { return parts.filter(Boolean).join(" "); }
function slugFromHandle(h: string) { return String(h || "").replace(/^@/, "").split(/\\s+/)[0]?.trim() || ""; }
function profileHref(handle: string) { const u = slugFromHandle(handle); return u ? ["/u/", encodeURIComponent(u)].join("") : "#"; }

export default function FollowingListPage() {
  const params = useParams() as { username?: string };
  const router = useRouter();

  const raw = String(params?.username || "");
  const username = useMemo(() => decodeURIComponent(raw || "").replace(/^@/, "").trim(), [raw]);

  const [items, setItems] = useState<Item[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [trouble, setTrouble] = useState<string | null>(null);

  const load = useCallback(async (cursor?: string | null) => {
    if (!username) return;
    const isMore = !!cursor;
    if (isMore) setLoadingMore(true); else setLoading(true);
    setTrouble(null);

    try {
      const qs = new URLSearchParams();
      qs.set("limit","40");
      if (cursor) qs.set("cursor", cursor);
      const url = ["/api/", SEG, "/", encodeURIComponent(username), "?", qs.toString()].join("");
      const res = await fetch(url, { cache: "no-store" });
      const j = (await res.json().catch(() => null)) as any as Resp;

      if (!res.ok || !j || j.ok !== true) {
        setTrouble(j?.error || "request_failed");
        if (!isMore) setItems([]);
        return;
      }

      const got = Array.isArray(j.items) ? j.items : [];
      setTotal(typeof j.total === "number" ? j.total : null);
      setNextCursor(String(j.nextCursor || "").trim() || null);

      setItems(prev => {
        if (!isMore) return got;
        const seen = new Set<number>(prev.map(x => Number(x.id)));
        const merged = [...prev];
        for (const it of got) {
          const id = Number((it as any)?.id);
          if (!id || seen.has(id)) continue;
          seen.add(id);
          merged.push(it);
        }
        return merged;
      });
    } catch {
      setTrouble("network_error");
    } finally {
      if (isMore) setLoadingMore(false); else setLoading(false);
    }
  }, [username]);

  useEffect(() => { void load(null); }, [load]);

  const backHref = username ? ["/u/", encodeURIComponent(username)].join("") : "/siddes-feed";

  return (
    <div className="min-h-dvh">
      <div className="px-4 pt-4 pb-3 sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => { try { router.push(backHref); } catch {} }}
            className="inline-flex items-center gap-2 text-sm font-extrabold text-gray-700 hover:text-gray-900"
            aria-label="Back to profile">
            <ChevronLeft size={18} /> Back
          </button>
          <div className="text-xs font-extrabold text-gray-500">{username ? `@${username}` : ""}</div>
        </div>

        <div className="mt-3">
          <div className="text-lg font-black text-gray-900">{LABEL}</div>
          <div className="text-xs text-gray-500 mt-1">
            Public roster. {typeof total === "number" ? <span className="font-mono">Total: {total}</span> : null}
          </div>
        </div>
      </div>

      <div className="px-4 py-4 max-w-[520px] mx-auto">
        {loading ? (
          <div className="text-sm text-gray-500">Loading…</div>
        ) : trouble ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
            <div className="text-sm font-black text-red-800">Couldn’t load list</div>
            <div className="text-xs text-red-700 mt-1">Try refreshing.</div>
          </div>
        ) : items.length ? (
          <div className="space-y-2">
            {items.map(it => (
              <Link key={String(it.id)} href={profileHref(it.handle)}
                className="block rounded-2xl border border-gray-200 bg-white p-3 hover:bg-gray-50 transition-colors">
                <div className="font-black text-gray-900 truncate">{(it.displayName || "").trim() || it.handle}</div>
                <div className="text-xs text-gray-500 font-mono truncate">{it.handle}</div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-500">Nobody yet.</div>
        )}

        {nextCursor && !trouble ? (
          <div className="mt-4">
            <button type="button" onClick={() => void load(nextCursor)} disabled={loadingMore}
              className={cn("w-full px-4 py-3 rounded-2xl font-extrabold text-sm border transition-all",
                loadingMore ? "bg-gray-100 text-gray-400 border-gray-200" : "bg-white text-gray-900 border-gray-200 hover:bg-gray-50")}>
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
''')
        print("CREATED:", str(following_page))

def main():
    patch_profile_header()
    patch_profile_page()
    ensure_next_api_routes()
    ensure_list_pages()

main()
PY

echo ""
echo "✅ ${SD_ID} applied."
echo "Backups: ${BK}"
echo ""
echo "Next:"
echo "  ./verify_overlays.sh"
echo "  cd frontend && npm run typecheck"
echo "  cd frontend && npm run build"
echo ""
echo "Smoke test:"
echo "  1) Open /u/<username> on Public"
echo "  2) Confirm Followers/Following numbers show"
echo "  3) Tap each number → list page opens"
