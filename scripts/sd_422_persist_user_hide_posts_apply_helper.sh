#!/usr/bin/env bash
set -euo pipefail

# sd_422: Persist user "Hide post" server-side (personal hide, NOT moderation hide)

NAME="sd_422_persist_user_hide_posts"

if [[ ! -d "backend" || ! -d "frontend" ]]; then
  echo "ERROR: Run from repo root (must contain backend/ and frontend/)."
  echo "Current: $(pwd)"
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node is required (used for safe in-place edits)."
  exit 1
fi

STAMP="$(date +%Y%m%d_%H%M%S)"
BK=".backup_${NAME}_${STAMP}"
mkdir -p "$BK"

backup_file() {
  local p="$1"
  if [[ -e "$p" ]]; then
    mkdir -p "$BK/$(dirname "$p")"
    cp -a "$p" "$BK/$p"
  fi
}

# Backup key files
backup_file "backend/siddes_safety/models.py"
backup_file "backend/siddes_safety/views.py"
backup_file "backend/siddes_safety/urls.py"
backup_file "backend/siddes_backend/settings.py"
backup_file "backend/siddes_backend/middleware.py"
backup_file "backend/siddes_feed/feed_stub.py"
backup_file "backend/siddes_search/views.py"
backup_file "backend/siddes_post/views.py"
backup_file "frontend/src/components/PostCard.tsx"

# Backup migrations dir (small, but important)
if [[ -d "backend/siddes_safety/migrations" ]]; then
  mkdir -p "$BK/backend/siddes_safety"
  cp -a "backend/siddes_safety/migrations" "$BK/backend/siddes_safety/"
fi

echo "== ${NAME} =="
echo "Backups: ${BK}"
echo ""

node - <<'NODE'
const fs = require("fs");
const path = require("path");

function read(p){ return fs.readFileSync(p, "utf8"); }
function write(p, s){ fs.writeFileSync(p, s.endsWith("\n") ? s : (s + "\n"), "utf8"); }
function exists(p){ return fs.existsSync(p); }
function mkdirp(p){ fs.mkdirSync(p, { recursive: true }); }

function patchSafetyModels() {
  const p = "backend/siddes_safety/models.py";
  let s = read(p);

  if (s.includes("class UserHiddenPost")) {
    console.log("OK: models.py already has UserHiddenPost");
    return;
  }

  const markerRe = /^class ModerationAuditEvent\(models\.Model\):/m;
  const idx = s.search(markerRe);
  if (idx < 0) throw new Error("Could not find ModerationAuditEvent marker in " + p);

  const insert =
`\n\nclass UserHiddenPost(models.Model):
    """A viewer hides a post (remove from their view)."""

    viewer_id = models.CharField(max_length=64, db_index=True)
    post_id = models.CharField(max_length=128, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("viewer_id", "post_id")

\na`;
  // remove the sentinel "a" line marker
  const cleaned = insert.replace(/\n\na$/, "\n\n");

  s = s.slice(0, idx) + cleaned + s.slice(idx);
  write(p, s);
  console.log("OK: added UserHiddenPost to models.py");
}

function ensureSafetyMigration() {
  const dir = "backend/siddes_safety/migrations";
  mkdirp(dir);

  // If any migration already mentions UserHiddenPost, do not create a new one.
  const all = fs.readdirSync(dir).filter(f => /^\d{4}_.+\.py$/.test(f));
  for (const f of all) {
    const txt = read(path.join(dir, f));
    if (txt.includes("UserHiddenPost")) {
      console.log("OK: migration already exists for UserHiddenPost (" + f + ")");
      return;
    }
  }

  if (all.length === 0) throw new Error("No existing migrations found in " + dir);

  const nums = all.map(f => parseInt(f.slice(0,4), 10)).filter(n => Number.isFinite(n));
  const max = Math.max(...nums);
  const maxStr = String(max).padStart(4, "0");
  const depFile = all.find(f => f.startsWith(maxStr + "_"));
  if (!depFile) throw new Error("Could not determine latest migration dependency in " + dir);
  const dep = depFile.replace(/\.py$/, "");

  const next = String(max + 1).padStart(4, "0");
  const fname = `${next}_user_hidden_posts.py`;
  const outPath = path.join(dir, fname);

  const content =
`from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("siddes_safety", "${dep}"),
    ]

    operations = [
        migrations.CreateModel(
            name="UserHiddenPost",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("viewer_id", models.CharField(db_index=True, max_length=64)),
                ("post_id", models.CharField(db_index=True, max_length=128)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "unique_together": {("viewer_id", "post_id")},
            },
        ),
    ]
`;

  write(outPath, content);
  console.log("OK: created migration " + outPath + " (depends on " + dep + ")");
}

function patchSafetyViews() {
  const p = "backend/siddes_safety/views.py";
  let s = read(p);

  // Ensure UserHiddenPost is imported from .models
  const impRe = /^from \.models import ([^\n]+)\n/m;
  const m = s.match(impRe);
  if (!m) throw new Error("Could not find .models import line in " + p);

  const parts = m[1].split(",").map(x => x.trim()).filter(Boolean);
  if (!parts.includes("UserHiddenPost")) {
    parts.push("UserHiddenPost");
    s = s.replace(impRe, "from .models import " + parts.join(", ") + "\n");
  }

  // Append HiddenPostsView if missing
  if (!s.includes("class HiddenPostsView")) {
    s += `

@method_decorator(dev_csrf_exempt, name="dispatch")
class HiddenPostsView(APIView):
    """Viewer-only: hide/unhide posts for personal view.

    GET  /api/hidden-posts -> { hidden: [postId...] }
    POST /api/hidden-posts { postId, hidden: true|false }
    """

    throttle_scope = "safety_hide"
    permission_classes: list = []

    def get(self, request):
        has_viewer, viewer, role = _viewer_ctx(request)
        if not has_viewer:
            return _restricted(has_viewer, viewer, role, code=status.HTTP_401_UNAUTHORIZED)
        if role != "me":
            return _restricted(has_viewer, viewer, role, code=status.HTTP_403_FORBIDDEN)

        rows = list(
            UserHiddenPost.objects.filter(viewer_id=viewer)
            .order_by("-created_at")
            .values_list("post_id", flat=True)[:5000]
        )
        hidden = [str(x) for x in rows if str(x).strip()]
        return Response({"ok": True, "hidden": hidden}, status=status.HTTP_200_OK)

    def post(self, request):
        has_viewer, viewer, role = _viewer_ctx(request)
        if not has_viewer:
            return _restricted(has_viewer, viewer, role, code=status.HTTP_401_UNAUTHORIZED)
        if role != "me":
            return _restricted(has_viewer, viewer, role, code=status.HTTP_403_FORBIDDEN)

        body: Dict[str, Any] = request.data if isinstance(request.data, dict) else {}
        pid = str(body.get("postId") or body.get("post_id") or body.get("id") or "").strip()
        if not pid:
            return Response({"ok": False, "error": "invalid_post_id"}, status=status.HTTP_400_BAD_REQUEST)

        raw = body.get("hidden")
        hidden = True
        if raw is not None:
            if typeof raw === "boolean":
                hidden = raw
        # python-style parsing (keep in Python, not JS) -> handled below
`;
    // The above accidentally inserted JS 'typeof' if we leave it. Fix by not doing that:
    // Replace that bad chunk with correct Python implementation by inserting separately below.
    // We'll instead append the correct class block in one go (no JS in it). So: re-build s cleanly.
    s = s.replace(/if typeof raw === "boolean":[\s\S]*?handled below\n/m, "");

    s += `
        raw = body.get("hidden")
        hidden = True
        if raw is not None:
            if isinstance(raw, bool):
                hidden = raw
            else:
                ss = str(raw or "").strip().lower()
                if ss in ("true", "1", "yes", "y"):
                    hidden = True
                elif ss in ("false", "0", "no", "n"):
                    hidden = False

        if hidden:
            UserHiddenPost.objects.get_or_create(viewer_id=viewer, post_id=pid)
        else:
            UserHiddenPost.objects.filter(viewer_id=viewer, post_id=pid).delete()

        return Response({"ok": True, "postId": pid, "hidden": bool(hidden)}, status=status.HTTP_200_OK)
`;
  }

  write(p, s);
  console.log("OK: patched siddes_safety/views.py");
}

function patchSafetyUrls() {
  const p = "backend/siddes_safety/urls.py";
  let s = read(p);

  // Ensure HiddenPostsView is in the import list
  const importRe = /from \.views import \(\n([\s\S]*?)\n\)\n/m;
  const m = s.match(importRe);
  if (!m) throw new Error("Could not parse import block in " + p);

  let body = m[1];
  if (!body.includes("HiddenPostsView")) {
    if (body.includes("BlocksView,")) {
      body = body.replace(/(\s*BlocksView,\n)/, "$1    HiddenPostsView,\n");
    } else {
      body = body.replace(/(\s*BlockDeleteView,\n)/, "$1    HiddenPostsView,\n");
    }
    s = s.replace(importRe, "from .views import (\n" + body + "\n)\n");
  }

  // Ensure route exists
  if (!s.includes('path("hidden-posts"')) {
    const needle = 'path("blocks/<path:token>", BlockDeleteView.as_view()),\n';
    if (s.includes(needle)) {
      s = s.replace(
        needle + "\n",
        needle + "\n    path(\"hidden-posts\", HiddenPostsView.as_view()),\n\n"
      );
    } else {
      // fallback: insert after blocks/<path:token> line by scanning
      const lines = s.split("\n");
      const out = [];
      let inserted = false;
      for (const line of lines) {
        out.push(line);
        if (!inserted && line.includes('path("blocks/<path:token>"')) {
          out.push("");
          out.push('    path("hidden-posts", HiddenPostsView.as_view()),');
          out.push("");
          inserted = true;
        }
      }
      s = out.join("\n");
    }
  }

  write(p, s);
  console.log("OK: patched siddes_safety/urls.py");
}

function patchThrottleSettings() {
  const p = "backend/siddes_backend/settings.py";
  let s = read(p);
  if (s.includes('"safety_hide":') || s.includes("'safety_hide':")) {
    console.log("OK: settings.py already has safety_hide throttle");
    return;
  }

  const re = /(\s*"safety_report":\s*_env\("SIDDES_THROTTLE_SAFETY_REPORT",\s*"20\/min"\),\s*\n)/;
  if (!re.test(s)) {
    console.warn("WARN: Could not find safety_report throttle line to anchor safety_hide insertion. Skipping.");
    return;
  }

  s = s.replace(re, `$1        "safety_hide": _env("SIDDES_THROTTLE_SAFETY_HIDE", "60/min"),\n`);
  write(p, s);
  console.log("OK: added safety_hide throttle to settings.py");
}

function patchAllowlists() {
  const p = "backend/siddes_backend/middleware.py";
  let s = read(p);

  // AccountStateMiddleware default allowlist
  const accOld = "'/api/auth/,/api/blocks,/api/reports,/api/moderation/',";
  const accNew = "'/api/auth/,/api/blocks,/api/reports,/api/appeals,/api/hidden-posts,/api/moderation/',";
  if (s.includes(accOld) && !s.includes("/api/hidden-posts")) {
    s = s.replace(accOld, accNew);
  }

  // PanicModeMiddleware default allowlist
  const panicOld = "\"/api/auth/,/api/reports,/api/blocks,/api/moderation/\",";
  const panicNew = "\"/api/auth/,/api/reports,/api/blocks,/api/appeals,/api/hidden-posts,/api/moderation/\",";
  if (s.includes(panicOld) && !s.includes("/api/hidden-posts")) {
    s = s.replace(panicOld, panicNew);
  }

  write(p, s);
  console.log("OK: patched middleware allowlists (appeals + hidden-posts)");
}

function patchFeedStub() {
  const p = "backend/siddes_feed/feed_stub.py";
  let s = read(p);

  if (!s.includes("UserHiddenPost") && s.includes('if t == "all":')) {
    const anchor = '    if t == "all":\n        t = None\n';
    if (s.includes(anchor)) {
      const ins =
`\n\n    # sd_422_user_hide: per-viewer hidden posts (skip during feed scan)\n    hidden_ids: set[str] = set()\n    try:\n        from siddes_safety.models import UserHiddenPost  # type: ignore\n\n        rows = list(\n            UserHiddenPost.objects.filter(viewer_id=str(viewer_id))\n            .values_list(\"post_id\", flat=True)[:5000]\n        )\n        hidden_ids = {str(x).strip() for x in rows if str(x).strip()}\n    except Exception:\n        hidden_ids = set()\n`;
      s = s.replace(anchor, anchor + ins);
    }
  }

  // Skip hidden posts during scan loop (so pagination still fills up)
  if (!s.includes("if pid and pid in hidden_ids")) {
    const needle =
`        for r in recs:
            last_scanned = r

            if not _can_view_record(viewer_id, r):
                continue
`;
    if (s.includes(needle)) {
      const rep =
`        for r in recs:
            last_scanned = r

            pid = str(getattr(r, "id", "") or "").strip()
            if pid and pid in hidden_ids:
                continue

            if not _can_view_record(viewer_id, r):
                continue
`;
      s = s.replace(needle, rep);
    } else {
      console.warn("WARN: Could not patch feed_stub scan loop (pattern not found).");
    }
  }

  write(p, s);
  console.log("OK: patched feed_stub.py (hide filter)");
}

function patchSearchViews() {
  const p = "backend/siddes_search/views.py";
  let s = read(p);

  if (!s.includes("sd_422_user_hide")) {
    // SearchPostsView query
    const re1 = /qs = Post\.objects\.filter\(side=\"public\", is_hidden=False, text__icontains=qt\)\.order_by\(\"-created_at\"\)\[:lim\]/;
    if (re1.test(s)) {
      s = s.replace(re1,
`qs = Post.objects.filter(side="public", is_hidden=False, text__icontains=qt).order_by("-created_at")
        # sd_422_user_hide: exclude posts the viewer hid
        try:
            from siddes_safety.models import UserHiddenPost  # type: ignore
            qs = qs.exclude(id__in=UserHiddenPost.objects.filter(viewer_id=viewer).values("post_id"))
        except Exception:
            pass
        qs = qs[:lim]`
      );
    }

    // UserPublicPostsView query
    const re2 = /qs = Post\.objects\.filter\(side=\"public\", is_hidden=False, author_id=author_token\)\.order_by\(\"-created_at\"\)\[:lim\]/;
    if (re2.test(s)) {
      s = s.replace(re2,
`qs = Post.objects.filter(side="public", is_hidden=False, author_id=author_token).order_by("-created_at")
        # sd_422_user_hide: exclude posts the viewer hid
        try:
            from siddes_safety.models import UserHiddenPost  # type: ignore
            qs = qs.exclude(id__in=UserHiddenPost.objects.filter(viewer_id=viewer).values("post_id"))
        except Exception:
            pass
        qs = qs[:lim]`
      );
    }

    // Add a tiny marker so we don't double-apply
    s = s.replace(/class SearchPostsView\(APIView\):/, "# sd_422_user_hide\nclass SearchPostsView(APIView):");
  }

  write(p, s);
  console.log("OK: patched siddes_search/views.py (hide filter)");
}

function patchPostDetailView() {
  const p = "backend/siddes_post/views.py";
  let s = read(p);

  if (!s.includes("sd_422_user_hide")) {
    const needle = "        rec = POST_STORE.get(post_id)\n";
    if (s.includes(needle)) {
      const insert =
`        # sd_422_user_hide: treat user-hidden posts as not_found for this viewer
        try:
            from siddes_safety.models import UserHiddenPost  # type: ignore
            if UserHiddenPost.objects.filter(viewer_id=viewer, post_id=str(post_id)).exists():
                return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception:
            pass

        rec = POST_STORE.get(post_id)
`;
      s = s.replace(needle, insert);
    } else {
      console.warn("WARN: Could not patch PostDetailView (pattern not found).");
    }
  }

  write(p, s);
  console.log("OK: patched siddes_post/views.py (hide enforcement)");
}

function ensureFrontendHiddenRoute() {
  const p = "frontend/src/app/api/hidden-posts/route.ts";
  if (exists(p)) {
    console.log("OK: frontend hidden-posts route already exists");
    return;
  }
  mkdirp(path.dirname(p));
  const content =
`import { NextResponse } from "next/server";
import { proxyJson } from "../auth/_proxy";

export async function GET(req: Request) {
  const out = await proxyJson(req, "/api/hidden-posts", "GET");
  if (out instanceof NextResponse) return out;
  const { res, data, setCookies } = out;
  const r = NextResponse.json(data, { status: res.status });
  for (const c of setCookies) r.headers.append("set-cookie", c);
  return r;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const out = await proxyJson(req, "/api/hidden-posts", "POST", body);
  if (out instanceof NextResponse) return out;
  const { res, data, setCookies } = out;
  const r = NextResponse.json(data, { status: res.status });
  for (const c of setCookies) r.headers.append("set-cookie", c);
  return r;
}
`;
  write(p, content);
  console.log("OK: created frontend API route /api/hidden-posts");
}

function patchPostCard() {
  const p = "frontend/src/components/PostCard.tsx";
  let s = read(p);

  if (s.includes("sd_422_user_hide")) {
    console.log("OK: PostCard already patched for server hide");
    return;
  }

  const re =
/onHide=\{\(\) => \{\s*setHidden\(true\);\s*toast\.undo\(\"Post hidden\.\", \(\) => setHidden\(false\)\);\s*\}\}/m;

  if (!re.test(s)) {
    console.warn("WARN: Could not find PostCard onHide block to patch. Skipping.");
    return;
  }

  const rep =
`onHide={() => {
          const pid = String((post as any)?.id || "").trim();
          if (!pid) {
            toast.error("Could not hide.");
            return;
          }

          // Optimistic hide in UI.
          setHidden(true);

          (async () => {
            try {
              const res = await fetch("/api/hidden-posts", {
                method: "POST",
                cache: "no-store",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ postId: pid, hidden: true }),
              });
              const j = await res.json().catch(() => null);
              if (!res.ok || !j || j.ok !== true) throw new Error("hide_failed");
            } catch {
              setHidden(false);
              toast.error("Could not hide.");
            }
          })();

          toast.undo("Post hidden.", () => {
            setHidden(false);
            (async () => {
              try {
                await fetch("/api/hidden-posts", {
                  method: "POST",
                  cache: "no-store",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ postId: pid, hidden: false }),
                });
              } catch {
                // ignore
              }
            })();
          });
        }} /* sd_422_user_hide */`;

  s = s.replace(re, rep);
  write(p, s);
  console.log("OK: patched PostCard.tsx (server hide + undo)");
}

function patchBackendHiddenEndpoint() {
  // safety urls already route /api/* via siddes_backend/api.py
  // so adding to siddes_safety/urls.py is enough.
  // nothing else needed here.
}

function main() {
  patchSafetyModels();
  ensureSafetyMigration();
  patchSafetyViews();
  patchSafetyUrls();
  patchThrottleSettings();
  patchAllowlists();
  patchFeedStub();
  patchSearchViews();
  patchPostDetailView();
  ensureFrontendHiddenRoute();
  patchPostCard();
  patchBackendHiddenEndpoint();
}

main();
NODE

echo ""
echo "OK: ${NAME} applied."
echo "Backups: ${BK}"
echo ""
echo "Next (VS Code terminal):"
echo "  docker compose -f ops/docker/docker-compose.dev.yml exec backend python manage.py migrate"
echo "  cd frontend && npm run typecheck"
echo "  cd frontend && npm run build"
echo ""
echo "Quick verify:"
echo "  1) Hide a post -> refresh feed: it stays gone."
echo "  2) Undo -> refresh feed: it returns."
echo "  3) Search: hidden post no longer appears."
echo "  4) Direct /siddes-post/<id>: returns not_found for that viewer when hidden."
