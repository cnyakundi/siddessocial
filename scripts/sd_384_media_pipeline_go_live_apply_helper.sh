#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_384"
SD_TITLE="Media pipeline go-live wiring (R2 -> Post attach -> Feed render -> /m signed redirects)"

ROOT="$(pwd)"
TS="$(date +%Y%m%d_%H%M%S)"
BK=".backup_${SD_ID}_media_pipeline_${TS}"

echo "==> ${SD_ID}: ${SD_TITLE}"
echo "==> Repo root: ${ROOT}"
echo "==> Backup dir: ${BK}"

if [[ ! -d "${ROOT}/frontend/src" ]] || [[ ! -d "${ROOT}/backend" ]]; then
  echo "ERROR: Run from repo root (expected ./frontend and ./backend)."
  exit 1
fi
if [[ ! -f "${ROOT}/backend/manage.py" ]]; then
  echo "ERROR: Expected ./backend/manage.py to exist."
  exit 1
fi

mkdir -p "${BK}"

backup_file() {
  local p="$1"
  if [[ -f "$p" ]]; then
    mkdir -p "${BK}/$(dirname "$p")"
    cp -p "$p" "${BK}/$p"
  fi
}

write_file() {
  local p="$1"
  mkdir -p "$(dirname "$p")"
  backup_file "$p"
  cat > "$p"
  echo "WROTE: $p"
}

perl_patch_file() {
  local p="$1"
  local marker="$2"
  local prog="$3"
  if [[ ! -f "$p" ]]; then
    echo "ERROR: Missing file to patch: $p"
    exit 1
  fi
  if grep -q "$marker" "$p"; then
    echo "SKIP (already applied): $p"
    return 0
  fi
  backup_file "$p"
  perl -0777 -i -pe "$prog" "$p"
  echo "PATCHED: $p"
}

# ------------------------------------------------------------
# 1) Frontend: New API proxies for /api/media/*
# ------------------------------------------------------------

write_file "frontend/src/app/api/media/sign-upload/route.ts" <<'EOF'
import { NextResponse } from "next/server";
import { resolveStubViewer } from "@/src/lib/server/stubViewer";
import { proxyJson } from "../../auth/_proxy";

// sd_384_media: Next proxy for Django /api/media/sign-upload
function withDevViewer(req: Request): Request {
  if (process.env.NODE_ENV === "production") return req;
  const r = resolveStubViewer(req);
  if (!r.viewerId) return req;
  const h = new Headers(req.headers);
  h.set("x-sd-viewer", r.viewerId);
  return new Request(req.url, { method: req.method, headers: h });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const req2 = withDevViewer(req);
  const out = await proxyJson(req2, "/api/media/sign-upload", "POST", body);
  if (out instanceof NextResponse) return out;

  const { res, data, setCookies } = out;
  const r = NextResponse.json(data, { status: res.status });
  for (const c of setCookies) r.headers.append("set-cookie", c);
  return r;
}
EOF

write_file "frontend/src/app/api/media/commit/route.ts" <<'EOF'
import { NextResponse } from "next/server";
import { resolveStubViewer } from "@/src/lib/server/stubViewer";
import { proxyJson } from "../../auth/_proxy";

// sd_384_media: Next proxy for Django /api/media/commit
function withDevViewer(req: Request): Request {
  if (process.env.NODE_ENV === "production") return req;
  const r = resolveStubViewer(req);
  if (!r.viewerId) return req;
  const h = new Headers(req.headers);
  h.set("x-sd-viewer", r.viewerId);
  return new Request(req.url, { method: req.method, headers: h });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const req2 = withDevViewer(req);
  const out = await proxyJson(req2, "/api/media/commit", "POST", body);
  if (out instanceof NextResponse) return out;

  const { res, data, setCookies } = out;
  const r = NextResponse.json(data, { status: res.status });
  for (const c of setCookies) r.headers.append("set-cookie", c);
  return r;
}
EOF

write_file "frontend/src/app/api/media/url/route.ts" <<'EOF'
import { NextResponse } from "next/server";
import { resolveStubViewer } from "@/src/lib/server/stubViewer";
import { proxyJson } from "../../auth/_proxy";

// sd_384_media: Next proxy for Django /api/media/url?key=
function withDevViewer(req: Request): Request {
  if (process.env.NODE_ENV === "production") return req;
  const r = resolveStubViewer(req);
  if (!r.viewerId) return req;
  const h = new Headers(req.headers);
  h.set("x-sd-viewer", r.viewerId);
  return new Request(req.url, { method: req.method, headers: h });
}

export async function GET(req: Request) {
  const u = new URL(req.url);
  const key = String(u.searchParams.get("key") || "").trim();
  if (!key) return NextResponse.json({ ok: false, error: "missing_key" }, { status: 400 });

  const req2 = withDevViewer(req);
  const out = await proxyJson(req2, `/api/media/url?key=${encodeURIComponent(key)}`, "GET");
  if (out instanceof NextResponse) return out;

  const { res, data, setCookies } = out;
  const r = NextResponse.json(data, { status: res.status });
  for (const c of setCookies) r.headers.append("set-cookie", c);
  return r;
}
EOF

# ------------------------------------------------------------
# 2) Frontend: /m/<key> route (Next) -> 302 to short-lived signed R2 GET URL
# ------------------------------------------------------------

write_file "frontend/src/app/m/[...key]/route.ts" <<'EOF'
import { NextResponse } from "next/server";
import { resolveStubViewer } from "@/src/lib/server/stubViewer";
import { proxyJson } from "@/src/app/api/auth/_proxy";

export const dynamic = "force-dynamic";

// sd_384_media: same-origin media serving. Next calls Django /api/media/url then redirects.
function withDevViewer(req: Request): Request {
  if (process.env.NODE_ENV === "production") return req;
  const r = resolveStubViewer(req);
  if (!r.viewerId) return req;
  const h = new Headers(req.headers);
  h.set("x-sd-viewer", r.viewerId);
  return new Request(req.url, { method: req.method, headers: h });
}

export async function GET(req: Request, ctx: { params: { key: string[] } }) {
  const parts = Array.isArray(ctx?.params?.key) ? ctx.params.key : [];
  const key = parts.join("/").replace(/^\/+/, "").trim();
  if (!key) return new NextResponse("bad_request", { status: 400 });

  const req2 = withDevViewer(req);
  const out = await proxyJson(req2, `/api/media/url?key=${encodeURIComponent(key)}`, "GET");
  if (out instanceof NextResponse) {
    out.headers.set("cache-control", "no-store");
    return out;
  }

  const { res, data, setCookies } = out;
  const url = data && typeof data.url === "string" ? String(data.url) : "";
  if (!res.ok || !url) {
    const status = res.status || 404;
    return new NextResponse(status === 401 ? "restricted" : status === 403 ? "forbidden" : "not_found", { status });
  }

  const r = NextResponse.redirect(url, { status: 302 });
  r.headers.set("cache-control", "no-store");
  for (const c of setCookies) r.headers.append("set-cookie", c);
  return r;
}
EOF

# ------------------------------------------------------------
# 3) Frontend client helper for signing + uploading
# ------------------------------------------------------------

write_file "frontend/src/lib/mediaClient.ts" <<'EOF'
"use client";

// sd_384_media: minimal R2 upload client (sign -> PUT)
export type MediaKind = "image" | "video";

export type SignedUpload = {
  ok: boolean;
  restricted?: boolean;
  error?: string;
  media?: { id: string; r2Key: string; kind: MediaKind; contentType: string; status?: string };
  upload?: { method: "PUT" | string; url: string; headers?: Record<string, string>; expiresIn?: number };
  serve?: { url: string };
};

export async function signUpload(file: File, kind: MediaKind = "image"): Promise<SignedUpload> {
  const contentType = String(file.type || "application/octet-stream").toLowerCase();
  const ext = (() => {
    const name = String((file as any).name || "");
    const m = name.match(/\.([a-z0-9]{1,8})$/i);
    return m ? m[1].toLowerCase() : "";
  })();

  const res = await fetch("/api/media/sign-upload", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ kind, contentType, bytes: (file as any).size || undefined, ext }),
  });

  const data = (await res.json().catch(() => null)) as SignedUpload | null;
  return data || { ok: false, error: `sign_failed_${res.status}` };
}

export async function uploadToSignedUrl(url: string, file: File, headers?: Record<string, string>): Promise<boolean> {
  const h = new Headers(headers || {});
  if (!h.has("content-type") && file.type) h.set("content-type", file.type);
  const res = await fetch(url, { method: "PUT", headers: h, body: file });
  return res.ok;
}
EOF

# ------------------------------------------------------------
# 4) Backend patches: attach MediaObjects to posts + allow viewers of post to fetch private media
# ------------------------------------------------------------

# 4a) backend/siddes_post/views.py
POST_VIEWS="backend/siddes_post/views.py"
perl_prog_post_views=$(cat <<'PERL'
# sd_384_media: patch siddes_post/views.py
use strict;
use warnings;

my $helpers = <<'INS';

# sd_384_media: media attachments (R2 keys)
def _parse_media_keys(body: Dict[str, Any]) -> list[str]:
    raw = body.get("mediaKeys") or body.get("media_keys") or body.get("media") or []
    keys: list[str] = []
    if isinstance(raw, str):
        raw = [p.strip() for p in raw.split(",")]
    if isinstance(raw, list):
        for x in raw:
            k = str(x or "").strip()
            if k:
                keys.append(k)
    out: list[str] = []
    seen = set()
    for k in keys:
        if k in seen:
            continue
        seen.add(k)
        out.append(k)
    return out


def _media_for_post(post_id: str) -> list[Dict[str, Any]]:
    pid = str(post_id or "").strip()
    if not pid:
        return []
    try:
        from siddes_media.models import MediaObject  # type: ignore
        qs = MediaObject.objects.filter(post_id=pid, status="committed").order_by("created_at", "id")
        out: list[Dict[str, Any]] = []
        for m in qs[:4]:
            out.append(
                {
                    "id": str(getattr(m, "id", "") or ""),
                    "r2Key": str(getattr(m, "r2_key", "") or ""),
                    "kind": str(getattr(m, "kind", "") or "image"),
                    "contentType": str(getattr(m, "content_type", "") or ""),
                    "url": f"/m/{str(getattr(m, 'r2_key', '') or '')}",
                }
            )
        return out
    except Exception:
        return []
INS

# Insert helpers after _reply_count
s{
(def\s+_reply_count\(post_id:\s+str\)\s+->\s+int:\n[\s\S]*?return\s+0\n)
}{
$1\n$helpers\n
}ms or die "sd_384_media: failed to insert helpers after _reply_count\\n";

# Add media into _feed_post_from_record just before decorator after function
my $ins_media_out = <<'INS';
    # sd_384_media: attach media in post payloads
    try:
        if pid:
            media = _media_for_post(pid)
            if media:
                out["media"] = media
                out["kind"] = "image"
    except Exception:
        pass
INS

s{
(\n\s*return\s+out\n\n\n\@method_decorator)
}{
$ins_media_out\n    return out\n\n\n@method_decorator
}ms or die "sd_384_media: failed to inject media into _feed_post_from_record\\n";

# Parse/validate media keys after client_key line
my $ins_media_parse = <<'INS';
        # sd_384_media: optional media attachments (R2 keys)
        media_keys = _parse_media_keys(body)
        if len(media_keys) > 4:
            return Response({"ok": False, "error": "too_many_media"}, status=status.HTTP_400_BAD_REQUEST)

        if media_keys:
            try:
                from siddes_media.models import MediaObject  # type: ignore
                qs = MediaObject.objects.filter(r2_key__in=media_keys, owner_id=viewer)
                found = {str(o.r2_key): o for o in qs}
                missing = [k for k in media_keys if k not in found]
                if missing:
                    return Response({"ok": False, "error": "invalid_media"}, status=status.HTTP_400_BAD_REQUEST)
                used = [k for k, o in found.items() if str(getattr(o, "post_id", "") or "").strip()]
                if used:
                    return Response({"ok": False, "error": "media_already_used"}, status=status.HTTP_400_BAD_REQUEST)
            except Exception:
                return Response({"ok": False, "error": "media_unavailable"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
INS

s{
(client_key\s*=\s*str\(body\.get\(\"client_key\"\)\s*or\s*body\.get\(\"clientKey\"\)\s*or\s*\"\"\)\.strip\(\)\s*or\s*None\n)
}{
$1$ins_media_parse\n
}ms or die "sd_384_media: failed to insert media_keys parse in PostCreateView\\n";

# Attach media objects right after post creation
my $ins_attach = <<'INS';
        # sd_384_media: commit + attach media to post (visibility enforced server-side here)
        if media_keys:
            try:
                from siddes_media.models import MediaObject  # type: ignore
                MediaObject.objects.filter(r2_key__in=media_keys, owner_id=viewer, post_id__isnull=True).update(
                    status="committed",
                    post_id=str(getattr(rec, "id", "") or ""),
                    is_public=(side == "public"),
                )
            except Exception:
                pass
INS

s{
(rec\s*=\s*POST_STORE\.create\([^\n]*\)\n)
}{
$1$ins_attach\n
}ms or die "sd_384_media: failed to attach media after POST_STORE.create\\n";

# Detach media on delete (fail-safe: no orphan public media)
my $ins_detach = <<'INS';
        # sd_384_media: detach media objects (fail-safe: no orphan public media)
        try:
            from siddes_media.models import MediaObject  # type: ignore
            MediaObject.objects.filter(post_id=str(post_id)).update(post_id=None, is_public=False)
        except Exception:
            pass
INS

s{
(\n\s*try:\n\s*PostLike\.objects\.filter\(post_id=str\(post_id\)\)\.delete\(\))
}{
$ins_detach$1
}ms or die "sd_384_media: failed to inject detach in delete()\\n";

PERL
)

perl_patch_file "$POST_VIEWS" "sd_384_media" "$perl_prog_post_views"

# 4b) backend/siddes_feed/feed_stub.py
FEED_STUB="backend/siddes_feed/feed_stub.py"
perl_prog_feed_stub=$(cat <<'PERL'
# sd_384_media: patch siddes_feed/feed_stub.py
use strict;
use warnings;

my $ins_bulk_media = <<'INS';

# sd_384_media: bulk media attach (committed MediaObjects)
def _bulk_media(post_ids: List[str]) -> Dict[str, List[Dict[str, Any]]]:
    out: Dict[str, List[Dict[str, Any]]] = {str(pid): [] for pid in post_ids}
    if not post_ids:
        return out
    try:
        from siddes_media.models import MediaObject  # type: ignore
        qs = (
            MediaObject.objects.filter(post_id__in=post_ids, status="committed")
            .order_by("post_id", "created_at", "id")
        )
        for m in qs:
            pid = str(getattr(m, "post_id", "") or "").strip()
            if not pid or pid not in out:
                continue
            if len(out[pid]) >= 4:
                continue
            out[pid].append(
                {
                    "id": str(getattr(m, "id", "") or ""),
                    "r2Key": str(getattr(m, "r2_key", "") or ""),
                    "kind": str(getattr(m, "kind", "") or "image"),
                    "contentType": str(getattr(m, "content_type", "") or ""),
                    "url": f"/m/{str(getattr(m, 'r2_key', '') or '')}",
                }
            )
    except Exception:
        pass
    return out
INS

# Insert before _bulk_echo
s{
(return\s+like_counts,\s+reply_counts,\s+liked_ids\n\n\ndef\s+_bulk_echo)
}{
$1
}ms or die "sd_384_media: failed to locate _bulk_engagement end\\n";

# Actually inject by matching the exact boundary
s{
(return\s+like_counts,\s+reply_counts,\s+liked_ids\n)(\n\n\ndef\s+_bulk_echo)
}{
$1\n$ins_bulk_media\n$2
}ms or die "sd_384_media: failed to insert _bulk_media\\n";

# Replace items build block up to Public topics guard
my $new_block = <<'INS';
    post_ids = [str(getattr(r, "id", "") or "").strip() for r in visible if str(getattr(r, "id", "") or "").strip()]
    like_counts, reply_counts, liked_ids = _bulk_engagement(viewer_id, post_ids)
    echo_counts, echoed_ids = _bulk_echo(viewer_id, post_ids, side, visible)
    media_map = _bulk_media(post_ids)

    items: List[dict] = []
    for r in visible:
        pid = str(getattr(r, "id", "") or "").strip()
        it = _hydrate_from_record(
            r,
            viewer_id=viewer_id,
            like_count=int(like_counts.get(pid, 0) or 0),
            reply_count=int(reply_counts.get(pid, 0) or 0),
            liked=(pid in liked_ids),
            echo_count=int(echo_counts.get(pid, 0) or 0),
            echoed=(pid in echoed_ids),
        )
        med = media_map.get(pid) or []
        if med:
            it["media"] = med
            it["kind"] = "image"
        items.append(it)
INS

s{
(\n\s*post_ids\s*=\s*\[str\(getattr\(r,\s*\"id\",\s*\"\"\)\s*or\s*\"\"\)\.strip\(\)\s*for\s*r\s*in\s*visible\s*if\s*str\(getattr\(r,\s*\"id\",\s*\"\"\)\s*or\s*\"\"\)\.strip\(\)\]\n[\s\S]*?\n\s*items:\s*List\[dict\]\s*=\s*\[\]\n[\s\S]*?\n\s*items\.append\([\s\S]*?\)\n\s*\)\n\s*\)\n)(\n\n\s*# Final guard for Public topics)
}{
\n$new_block$2
}ms or die "sd_384_media: failed to rewrite items build block\\n";

PERL
)

perl_patch_file "$FEED_STUB" "sd_384_media" "$perl_prog_feed_stub"

# 4c) backend/siddes_media/views.py
MEDIA_VIEWS="backend/siddes_media/views.py"
perl_prog_media_views=$(cat <<'PERL'
# sd_384_media: patch siddes_media/views.py to allow post viewers to fetch private media
use strict;
use warnings;

my $ins_can_view = <<'INS';

# sd_384_media: allow access to private media if viewer can view attached Post
def _viewer_can_view_post(viewer_id: str, post_id: str) -> bool:
    pid = str(post_id or "").strip()
    vid = str(viewer_id or "").strip()
    if not pid or not vid:
        return False
    try:
        from siddes_post.runtime_store import POST_STORE  # type: ignore
        from siddes_post.views import _set_meta, _can_view_post_record  # type: ignore

        rec = POST_STORE.get(pid)
        if rec is None:
            return False

        ok_set, set_side = _set_meta(vid, getattr(rec, "set_id", None))
        if not ok_set:
            return False

        allowed = {"public", "friends", "close", "work"}
        if set_side and set_side in allowed and str(getattr(rec, "side", "") or "") != set_side:
            return False

        return bool(
            _can_view_post_record(
                viewer_id=vid,
                side=str(getattr(rec, "side", "") or "public"),
                author_id=str(getattr(rec, "author_id", "") or ""),
                set_id=getattr(rec, "set_id", None),
                is_hidden=bool(getattr(rec, "is_hidden", False)),
            )
        )
    except Exception:
        return False
INS

# Insert helper after _viewer_ctx
s{
(def\s+_viewer_ctx\(request\)\s*->\s*Tuple\[bool,\s*str,\s*str\]:[\s\S]*?return\s+has_viewer,\s+viewer,\s+role\n\n)
}{
$1$ins_can_view\n
}ms or die "sd_384_media: failed to insert _viewer_can_view_post\\n";

# Patch MediaSignedUrlView private gating
s{
if\s+not\s+obj\.is_public:\n\s+if\s+not\s+has_viewer:\n\s+return\s+Response\(_restricted_payload\(has_viewer,\s+viewer,\s+role\),\s+status=status\.HTTP_200_OK\)\n\s+if\s+obj\.owner_id\s+!=\s+viewer:\n\s+return\s+Response\(\{'ok':\s+False,\s+'error':\s+'forbidden'\},\s+status=status\.HTTP_403_FORBIDDEN\)
}{
if not obj.is_public:
            if not has_viewer:
                return Response(_restricted_payload(has_viewer, viewer, role), status=status.HTTP_200_OK)
            if obj.owner_id != viewer:
                pid = str(getattr(obj, "post_id", "") or "").strip()
                if not pid or not _viewer_can_view_post(viewer, pid):
                    return Response({'ok': False, 'error': 'forbidden'}, status=status.HTTP_403_FORBIDDEN)
}ms or die "sd_384_media: failed to patch MediaSignedUrlView gating\\n";

# Patch MediaRedirectView private gating
s{
if\s+not\s+obj\.is_public:\n\s+if\s+not\s+has_viewer:\n\s+return\s+HttpResponse\('restricted',\s+status=401\)\n\s+if\s+obj\.owner_id\s+!=\s+viewer:\n\s+return\s+HttpResponse\('forbidden',\s+status=403\)
}{
if not obj.is_public:
            if not has_viewer:
                return HttpResponse('restricted', status=401)
            if obj.owner_id != viewer:
                pid = str(getattr(obj, "post_id", "") or "").strip()
                if not pid or not _viewer_can_view_post(viewer, pid):
                    return HttpResponse('forbidden', status=403)
}ms or die "sd_384_media: failed to patch MediaRedirectView gating\\n";

PERL
)

perl_patch_file "$MEDIA_VIEWS" "sd_384_media" "$perl_prog_media_views"

# ------------------------------------------------------------
# 5) Frontend patches: types + PostCard render + Composer uploads
# ------------------------------------------------------------

# 5a) feedTypes.ts
FEED_TYPES="frontend/src/lib/feedTypes.ts"
perl_prog_feed_types=$(cat <<'PERL'
# sd_384_media: patch feedTypes.ts
use strict;
use warnings;

# Add MediaAttachment after PostKind
s{
(export\s+type\s+PostKind\s+=\s+\"text\"\s+\|\s+\"image\"\s+\|\s+\"link\";\n)
}{
$1
// sd_384_media: media attachments returned by backend
export type MediaAttachment = {
  id: string;
  r2Key: string;
  kind: "image" | "video";
  contentType?: string;
  url: string; // served via /m/<r2Key>
};

}ms or die "sd_384_media: failed to insert MediaAttachment type\\n";

# Add media?: MediaAttachment[]; after kind in FeedPost
s{
(kind:\s*PostKind;\n)
}{
$1  media?: MediaAttachment[];\n
}ms or die "sd_384_media: failed to add media field in FeedPost\\n";

PERL
)

perl_patch_file "$FEED_TYPES" "sd_384_media" "$perl_prog_feed_types"

# 5b) PostCard.tsx: render media grid + remove placeholder-only image
POST_CARD="frontend/src/components/PostCard.tsx"
perl_prog_post_card=$(cat <<'PERL'
# sd_384_media: patch PostCard.tsx
use strict;
use warnings;

my $ins_helpers = <<'INS';

type MediaItem = { id: string; url: string; kind: "image" | "video" };

// sd_384_media: simple media renderer (1 big, 2-4 grid)
function MediaGrid({ items }: { items: MediaItem[] }) {
  const imgs = items.filter((x) => x.kind === "image");
  const vids = items.filter((x) => x.kind === "video");

  if (vids.length) {
    // Minimal: render first video (keeps layout stable)
    const v = vids[0];
    return (
      <div className="w-full mb-3 rounded-xl overflow-hidden border border-gray-200 bg-black">
        <video src={v.url} controls preload="metadata" className="w-full h-auto" />
      </div>
    );
  }

  if (!imgs.length) return null;

  if (imgs.length === 1) {
    return (
      <div className="w-full mb-3 rounded-xl overflow-hidden border border-gray-200 bg-gray-100">
        <img src={imgs[0].url} alt="" className="w-full h-auto object-cover" loading="lazy" />
      </div>
    );
  }

  return (
    <div className="w-full mb-3 grid grid-cols-2 gap-2">
      {imgs.slice(0, 4).map((m) => (
        <div key={m.id || m.url} className="rounded-xl overflow-hidden border border-gray-200 bg-gray-100">
          <img src={m.url} alt="" className="w-full h-40 object-cover" loading="lazy" />
        </div>
      ))}
    </div>
  );
}
INS

# Insert helpers right after cn() helper
s{
(function\s+cn\([\s\S]*?\n\}\n)
}{
$1\n$ins_helpers\n
}ms or die "sd_384_media: failed to insert MediaGrid helper\\n";

# Insert mediaItems useMemo after linkInfo
my $ins_media_items = <<'INS';
  // sd_384_media: backend-supplied media attachments
  const mediaItems: MediaItem[] = useMemo(() => {
    const arr = (post as any)?.media;
    if (!Array.isArray(arr)) return [];
    return arr
      .map((m: any) => {
        const url = String(m?.url || "");
        const kind = String(m?.kind || "image") === "video" ? "video" : "image";
        const id = String(m?.id || url);
        return { id, url, kind } as MediaItem;
      })
      .filter((m: any) => !!m.url);
  }, [post]);
INS

s{
(const\s+linkInfo\s*=\s*useMemo\([\s\S]*?\},\s*\[rawText\]\);\n)
}{
$1$ins_media_items\n
}ms or die "sd_384_media: failed to insert mediaItems useMemo\\n";

# Replace placeholder image block with real media render (fallback to old placeholder)
s{
\{post\.kind\s*===\s*\"image\"\s*\?\s*\(\n\s*<div[\s\S]*?<ImageIcon\s+size=\{32\}\s*\/>\n\s*<\/div>\n\s*\)\s*:\s*null\}
}{
{mediaItems.length ? (
            <MediaGrid items={mediaItems} />
          ) : post.kind === "image" ? (
            <div className="w-full h-56 bg-gray-100 rounded-xl mb-3 flex items-center justify-center text-gray-400 overflow-hidden">
              <ImageIcon size={32} />
            </div>
          ) : null}
}ms or die "sd_384_media: failed to replace image placeholder block\\n";

PERL
)

perl_patch_file "$POST_CARD" "sd_384_media" "$perl_prog_post_card"

# 5c) Composer: add photo picker + upload flow + send mediaKeys with post
COMPOSE="frontend/src/app/siddes-compose/client.tsx"
perl_prog_compose=$(cat <<'PERL'
# sd_384_media: patch composer for image attachments
use strict;
use warnings;

# Add ImagePlus to lucide import
s{
import\s+\{\s*AlertTriangle,\s*ChevronDown,\s*Globe,\s*Loader2,\s*Trash2,\s*X\s*\}\s+from\s+\"lucide-react\";
}{
import { AlertTriangle, ChevronDown, Globe, Loader2, Trash2, X, ImagePlus } from "lucide-react";
}ms or die "sd_384_media: failed to patch lucide-react import\\n";

# Add mediaClient import after toast import
s{
import\s+\{\s*toast\s*\}\s+from\s+\"@/src/lib/toast\";
}{
import { toast } from "@/src/lib/toast";
import { signUpload, uploadToSignedUrl } from "@/src/lib/mediaClient";
}ms or die "sd_384_media: failed to insert mediaClient import\\n";

# Insert media state block after topicPickerOpen state
my $ins_media_state = <<'INS';

  // sd_384_media: image attachments (R2)
  type MediaDraftItem = {
    id: string;
    name: string;
    previewUrl: string;
    status: "uploading" | "ready" | "failed";
    r2Key?: string;
  };

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [mediaItems, setMediaItems] = useState<MediaDraftItem[]>([]);

  const mediaBusy = mediaItems.some((m) => m.status === "uploading");
  const mediaFailed = mediaItems.some((m) => m.status === "failed");
  const mediaKeys = mediaItems
    .map((m) => (m.status === "ready" ? m.r2Key : null))
    .filter((x): x is string => Boolean(x));

  const clearMedia = () => {
    setMediaItems((cur) => {
      for (const m of cur) {
        try {
          if (m.previewUrl) URL.revokeObjectURL(m.previewUrl);
        } catch {}
      }
      return [];
    });
  };

  const removeMedia = (id: string) => {
    setMediaItems((cur) => {
      const hit = cur.find((x) => x.id === id);
      if (hit?.previewUrl) {
        try {
          URL.revokeObjectURL(hit.previewUrl);
        } catch {}
      }
      return cur.filter((x) => x.id !== id);
    });
  };

  const pickMedia = () => {
    try {
      if (!isOnline) {
        toast.error("Go online to add photos.");
        return;
      }
      if (mediaItems.length >= 4) {
        toast.error("Max 4 photos per post.");
        return;
      }
      fileInputRef.current?.click();
    } catch {}
  };

  const addMediaFiles = async (files: FileList | File[]) => {
    if (!isOnline) {
      toast.error("Go online to upload photos.");
      return;
    }

    const list = Array.from(files as any);
    const images = list.filter((f: any) => String(f?.type || "").toLowerCase().startsWith("image/"));
    if (!images.length) {
      toast.error("Please choose image files.");
      return;
    }

    const room = Math.max(0, 4 - mediaItems.length);
    const toAdd = images.slice(0, room);

    for (const file of toAdd) {
      const id = `m_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      const previewUrl = URL.createObjectURL(file);

      setMediaItems((cur) => [...cur, { id, name: String(file?.name || "photo"), previewUrl, status: "uploading" }]);

      try {
        const signed = await signUpload(file, "image");
        const url = signed?.upload?.url ? String(signed.upload.url) : "";
        const r2Key = signed?.media?.r2Key ? String(signed.media.r2Key) : "";

        if (!signed?.ok || !url || !r2Key) throw new Error(signed?.error || "sign_failed");

        const ok = await uploadToSignedUrl(url, file, signed?.upload?.headers || {});
        if (!ok) throw new Error("upload_failed");

        setMediaItems((cur) => cur.map((m) => (m.id === id ? { ...m, status: "ready", r2Key } : m)));
      } catch {
        setMediaItems((cur) => cur.map((m) => (m.id === id ? { ...m, status: "failed" } : m)));
      }
    }
  };
INS

s{
const\s+\[topicPickerOpen,\s*setTopicPickerOpen\]\s*=\s*useState\(false\);\n
}{
const [topicPickerOpen, setTopicPickerOpen] = useState(false);
$ins_media_state

}ms or die "sd_384_media: failed to insert media state block\\n";

# Tighten canPost to include media status
s{
const\s+canPost\s*=\s*text\.trim\(\)\.length\s*>\s*0\s*&&\s*!posting\s*&&\s*!overLimit;
}{
const canPost = text.trim().length > 0 && !posting && !overLimit && !mediaBusy && !mediaFailed;
}ms or die "sd_384_media: failed to patch canPost\\n";

# Ensure reset() clears media
s{
const\s+reset\s*=\s*\(\)\s*=>\s*\{\n\s*setText\(\"\"\);\n\s*setUrgent\(false\);\n\s*setSelectedCircleId\(null\);\n\s*setError\(null\);\n\s*clearDraft\(side\);\n\s*\};
}{
const reset = () => {
      setText("");
      setUrgent(false);
      setSelectedCircleId(null);
      setError(null);
      clearMedia();
      clearDraft(side);
    };
}ms or die "sd_384_media: failed to patch reset()\\n";

# If offline and media exists, block queueing
s{
if\s*\(!onlineNow\)\s*\{\n\s*const\s+queued\s*=\s*enqueuePost
}{
if (!onlineNow) {
      if (mediaKeys.length) {
        setError({ kind: "network", message: "Media uploads require an online connection." });
        setPosting(false);
        return;
      }
      const queued = enqueuePost
}ms or die "sd_384_media: failed to block offline media queue\\n";

# Add mediaKeys into POST /api/post payload
s{
client_key:\s*clientKey,\n\s*\}\),\n\s*\}\);
}{
client_key: clientKey,
          mediaKeys,
        }),
      });
}ms or die "sd_384_media: failed to add mediaKeys to POST body\\n";

# Insert preview strip before Suggestions block
my $preview_block = <<'INS';

                {/* sd_384_media: previews */}
                {mediaItems.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {mediaItems.map((m) => (
                      <div
                        key={m.id}
                        className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-200 bg-gray-100"
                        title={m.name}
                      >
                        <img src={m.previewUrl} alt="" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeMedia(m.id)}
                          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-white/90 border border-gray-200 text-gray-700 font-extrabold flex items-center justify-center hover:bg-white"
                          aria-label="Remove photo"
                        >
                          ×
                        </button>

                        {m.status !== "ready" ? (
                          <div className="absolute inset-0 bg-black/35 text-white text-[10px] font-extrabold flex items-center justify-center">
                            {m.status === "uploading" ? "Uploading…" : "Failed"}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
INS

s{
</textarea>\n\n\s*\{\s*/\*\s*Suggestions\s*\(confidence gated,\s*reversible\)\s*\*/\}
}{
</textarea>
$preview_block

                {/* Suggestions (confidence gated, reversible) */}
}ms or die "sd_384_media: failed to insert preview block\\n";

# Add Photo button in footer near Drafts
my $photo_btn = <<'INS';

              <button
                type="button"
                onClick={pickMedia}
                disabled={posting || mediaBusy || !isOnline || mediaItems.length >= 4}
                className={cn(
                  "inline-flex items-center gap-2 px-3 py-2 rounded-full border text-xs font-extrabold transition-colors",
                  "border-gray-200 bg-white text-gray-700 hover:bg-gray-50",
                  (posting || mediaBusy || !isOnline || mediaItems.length >= 4) ? "opacity-50 cursor-not-allowed" : ""
                )}
                aria-label="Add photo"
                title={!isOnline ? "Go online to add photos" : mediaItems.length >= 4 ? "Max 4 photos" : "Add photo"}
              >
                <ImagePlus size={16} />
                <span className="hidden sm:inline">Photo</span>
              </button>
INS

s{
(<button\n\s*type=\"button\"\n\s*onClick=\{\(\)\s*=>\s*setDraftsOpen\(true\)\}[\s\S]*?>\n\s*Drafts\n\s*</button>\n)
}{
$1$photo_btn\n
}ms or die "sd_384_media: failed to insert Photo button\\n";

# Add hidden file input before DraftsSheet
my $file_input = <<'INS';

      {/* sd_384_media: hidden file picker */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = e.target.files;
          if (files && files.length) addMediaFiles(files);
          try {
            // allow picking the same file twice
            (e.target as any).value = "";
          } catch {}
        }}
      />
INS

s{
(\n\s*</div>\n\n\s*{\s*/\*\s*Drafts\s*\*/\}\n\s*<DraftsSheet)
}{
$file_input$1
}ms or die "sd_384_media: failed to insert hidden file input\\n";

PERL
)

perl_patch_file "$COMPOSE" "sd_384_media" "$perl_prog_compose"

# ------------------------------------------------------------
# Final notes
# ------------------------------------------------------------

echo ""
echo "==> DONE: ${SD_ID} applied."
echo
