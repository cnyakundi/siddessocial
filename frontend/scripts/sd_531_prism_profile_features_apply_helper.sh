#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"

if [ ! -d "$ROOT/backend" ] || [ ! -d "$ROOT/frontend" ]; then
  echo "ERROR: Run from your sidesroot repo root (folder containing backend/ and frontend/)."
  echo "Usage: $0 /path/to/sidesroot"
  exit 1
fi

# Enter repo root so relative paths work
cd "$ROOT"


TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.backup_sd_531_prism_profile_features_${TS}"
mkdir -p "$BK"

backup_file() {
  local rel="$1"
  local src="$ROOT/$rel"
  if [ -f "$src" ]; then
    mkdir -p "$BK/$(dirname "$rel")"
    cp -a "$src" "$BK/$rel"
  fi
}

echo "== sd_531: Prism Profile — tabs + follow + connect sheet (server-truth) =="

# Back up files we will touch
backup_file "backend/siddes_prism/models.py"
backup_file "backend/siddes_prism/views.py"
backup_file "backend/siddes_prism/urls.py"
backup_file "frontend/src/app/api/profile/[username]/route.ts"
backup_file "frontend/src/app/u/[username]/page.tsx"
backup_file "frontend/src/components/PrismProfile.tsx"
# New files (backup if exist)
backup_file "backend/siddes_prism/migrations/0005_userfollow.py"
backup_file "frontend/src/app/api/follow/route.ts"

PYTHON_BIN=""
if command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="python3"
elif command -v python >/dev/null 2>&1; then
  PYTHON_BIN="python"
else
  echo "ERROR: python3 is required for this apply-helper."
  exit 1
fi

# ---------- Backend: add UserFollow model (idempotent) ----------
"$PYTHON_BIN" - <<'PY'
import re
from pathlib import Path

p = Path("backend/siddes_prism/models.py")
txt = p.read_text()

if "class UserFollow(models.Model):" in txt:
    print("OK: UserFollow model already present")
    raise SystemExit(0)

append = """

class UserFollow(models.Model):
    '''Public follow edge: follower follows target.

    One-way subscription for *Public* content only.
    Does NOT grant access to Friends/Close/Work.
    '''

    follower = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="follow_outgoing",
    )
    target = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="follow_incoming",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["follower", "target"], name="userfollow_follower_target"),
            models.CheckConstraint(check=~models.Q(follower=models.F("target")), name="userfollow_no_self"),
        ]
        indexes = [
            models.Index(fields=["target", "created_at"], name="userfollow_target_created"),
            models.Index(fields=["follower", "created_at"], name="userfollow_follower_created"),
        ]
"""

txt = txt.rstrip() + "\n" + append
p.write_text(txt)
print("OK: appended UserFollow model")
PY

# ---------- Backend: migration 0005_userfollow.py ----------
if [ ! -f "$ROOT/backend/siddes_prism/migrations/0005_userfollow.py" ]; then
  cat > "$ROOT/backend/siddes_prism/migrations/0005_userfollow.py" <<'EOF'
from __future__ import annotations

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("siddes_prism", "0004_prismfacet_avatar_media_key"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="UserFollow",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "follower",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="follow_outgoing",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "target",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="follow_incoming",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "indexes": [
                    models.Index(fields=["target", "created_at"], name="userfollow_target_created"),
                    models.Index(fields=["follower", "created_at"], name="userfollow_follower_created"),
                ],
            },
        ),
        migrations.AddConstraint(
            model_name="userfollow",
            constraint=models.UniqueConstraint(fields=("follower", "target"), name="userfollow_follower_target"),
        ),
        migrations.AddConstraint(
            model_name="userfollow",
            constraint=models.CheckConstraint(check=~models.Q(follower=models.F("target")), name="userfollow_no_self"),
        ),
    ]
EOF
  echo "OK: wrote backend/siddes_prism/migrations/0005_userfollow.py"
else
  echo "OK: migration 0005_userfollow.py already exists"
fi

# ---------- Backend: urls.py add follow route ----------
"$PYTHON_BIN" - <<'PY'
from pathlib import Path
import re

p = Path("backend/siddes_prism/urls.py")
txt = p.read_text()

if "FollowActionView" in txt and 'path("follow"' in txt:
    print("OK: follow route already wired")
    raise SystemExit(0)

# Add FollowActionView import
m = re.search(r"from \.views import ([^\n]+)", txt)
if not m:
    raise SystemExit("ERROR: Could not find views import in siddes_prism/urls.py")
imports = m.group(1).strip()
if "FollowActionView" not in imports:
    imports = imports + ", FollowActionView"
txt = re.sub(r"from \.views import [^\n]+", "from .views import " + imports, txt)

# Add follow path
if 'path("follow"' not in txt:
    txt = txt.replace(
        'path("side", SideActionView.as_view(), name="side_action"),',
        'path("side", SideActionView.as_view(), name="side_action"),\n    path("follow", FollowActionView.as_view(), name="follow_action"),'
    )

p.write_text(txt)
print("OK: patched backend/siddes_prism/urls.py")
PY

# ---------- Backend: views.py patch (ProfileView + FollowActionView) ----------
"$PYTHON_BIN" - <<'PY'
from pathlib import Path
import re

p = Path("backend/siddes_prism/views.py")
txt = p.read_text()

# Import UserFollow
txt = re.sub(
    r"from \.models import PrismFacet, PrismSideId, SideMembership",
    "from .models import PrismFacet, PrismSideId, SideMembership, UserFollow",
    txt,
)

if "class FollowActionView(APIView):" in txt and "allowedSides" in txt and "requestedSide" in txt:
    p.write_text(txt)
    print("OK: views.py already has FollowActionView + multi-side ProfileView")
    raise SystemExit(0)

pat = re.compile(
    r"@method_decorator\(dev_csrf_exempt, name=\"dispatch\"\)\nclass ProfileView\(APIView\):.*?\n\n@method_decorator\(dev_csrf_exempt, name=\"dispatch\"\)\nclass SideActionView",
    re.S,
)

replacement = """@method_decorator(dev_csrf_exempt, name=\"dispatch\")
class ProfileView(APIView):
    \"""Viewer-resolved profile: GET /api/profile/<username>

    Supports optional query param:
      ?side=public|friends|close|work

    Viewer may only fetch sides in `allowedSides` (no access escalation).
    \"""

    def get(self, request, username: str):
        User = get_user_model()
        uname = _normalize_username(username).lower()
        if not uname:
            return Response({\"ok\": False, \"error\": \"not_found\"}, status=status.HTTP_404_NOT_FOUND)

        target = User.objects.filter(username__iexact=uname).first()
        if not target:
            return Response({\"ok\": False, \"error\": \"not_found\"}, status=status.HTTP_404_NOT_FOUND)

        viewer = _user_from_request(request)
        viewer_authed = bool(viewer)

        # sd_424_profile_blocks: Blocks hard-stop profile visibility
        if viewer and viewer.id != target.id:
            try:
                viewer_tok = viewer_id_for_user(viewer)
                target_tok = \"@\" + str(getattr(target, \"username\", \"\") or \"\").lower()
                if target_tok and is_blocked_pair(viewer_tok, target_tok):
                    return Response({\"ok\": False, \"error\": \"not_found\"}, status=status.HTTP_404_NOT_FOUND)
            except Exception:
                pass

        # What does the target show the viewer? (owner=target, member=viewer)
        view_side = \"public\"
        if viewer and viewer.id != target.id:
            rel_in = SideMembership.objects.filter(owner=target, member=viewer).first()
            if rel_in and rel_in.side in VIEW_SIDES:
                view_side = rel_in.side

        # Allowed sides (switching among these does NOT escalate access)
        if view_side == \"friends\":
            allowed_sides = [\"public\", \"friends\"]
        elif view_side == \"close\":
            allowed_sides = [\"public\", \"friends\", \"close\"]
        elif view_side == \"work\":
            allowed_sides = [\"public\", \"work\"]
        else:
            allowed_sides = [\"public\"]

        requested = str(request.query_params.get(\"side\") or \"\").strip().lower()
        if not requested:
            requested = view_side

        if requested not in VIEW_SIDES:
            return Response({\"ok\": False, \"error\": \"invalid_side\"}, status=status.HTTP_400_BAD_REQUEST)

        if requested not in allowed_sides:
            return Response(
                {
                    \"ok\": False,
                    \"error\": \"locked\",
                    \"user\": {\"id\": target.id, \"username\": target.username, \"handle\": \"@\" + target.username},
                    \"viewSide\": view_side,
                    \"requestedSide\": requested,
                    \"allowedSides\": allowed_sides,
                    \"viewerAuthed\": viewer_authed,
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        _ensure_facets(target)
        facet = PrismFacet.objects.filter(user=target, side=requested).first()
        if not facet:
            facet = PrismFacet.objects.create(user=target, side=requested)

        # What has the viewer done to this target? (owner=viewer, member=target)
        viewer_sided_as = None
        if viewer and viewer.id != target.id:
            rel_out = SideMembership.objects.filter(owner=viewer, member=target).first()
            viewer_sided_as = rel_out.side if rel_out else None

        # Public follow (separate from SideMembership)
        viewer_follows = False
        if viewer and viewer.id != target.id:
            try:
                viewer_follows = UserFollow.objects.filter(follower=viewer, target=target).exists()
            except Exception:
                viewer_follows = False

        followers_count = None
        try:
            followers_count = int(UserFollow.objects.filter(target=target).count())
        except Exception:
            followers_count = None

        # Siders count: how many owners have placed target into a side
        siders_count: Optional[int] = None
        if view_side != \"close\":
            try:
                siders_count = int(SideMembership.objects.filter(member=target).count())
            except Exception:
                siders_count = None

        # Shared sets: sets owned by viewer that include target (best-effort; contract-safe)
        shared_sets: List[str] = []
        if viewer and viewer.id != target.id:
            try:
                from siddes_sets.models import SiddesSet

                v_vid = viewer_id_for_user(viewer)
                t_vid = viewer_id_for_user(target)

                cand = list(SiddesSet.objects.filter(owner_id=v_vid).order_by(\"-updated_at\")[:200])
                for s in cand:
                    try:
                        members = list(getattr(s, \"members\", []) or [])
                        if t_vid in members:
                            label = str(getattr(s, \"label\", \"\") or \"\").strip()
                            if label:
                                shared_sets.append(label)
                    except Exception:
                        continue

                seen = set()
                out = []
                for x in shared_sets:
                    if x in seen:
                        continue
                    seen.add(x)
                    out.append(x)
                shared_sets = out[:6]
            except Exception:
                shared_sets = []

        return Response(
            {
                \"ok\": True,
                \"user\": {\"id\": target.id, \"username\": target.username, \"handle\": \"@\" + target.username},
                \"viewSide\": view_side,
                \"requestedSide\": requested,
                \"allowedSides\": allowed_sides,
                \"facet\": _facet_dict(facet),
                \"siders\": (\"Close Vault\" if view_side == \"close\" else siders_count),
                \"viewerSidedAs\": viewer_sided_as,
                \"viewerAuthed\": viewer_authed,
                \"viewerFollows\": bool(viewer_follows),
                \"followers\": followers_count,
                \"sharedSets\": shared_sets,
            },
            status=status.HTTP_200_OK,
        )


@method_decorator(dev_csrf_exempt, name=\"dispatch\")
class FollowActionView(APIView):
    \"""Viewer action: Follow/Unfollow someone. POST /api/follow

    Body:
      {\"username\": \"@alice\", \"follow\": true|false}
    \"""

    def post(self, request):
        viewer = _user_from_request(request)
        if not viewer:
            return Response({\"ok\": False, \"error\": \"restricted\"}, status=status.HTTP_401_UNAUTHORIZED)

        body: Dict[str, Any] = request.data if isinstance(request.data, dict) else {}
        uname = _normalize_username(body.get(\"username\") or body.get(\"handle\") or \"\")
        if not uname:
            return Response({\"ok\": False, \"error\": \"missing_username\"}, status=status.HTTP_400_BAD_REQUEST)

        want = body.get(\"follow\")
        follow = bool(want) if isinstance(want, (bool, int)) else str(want or \"\").strip().lower() in (\"1\", \"true\", \"yes\", \"y\", \"on\", \"follow\")

        User = get_user_model()
        target = User.objects.filter(username__iexact=uname).first()
        if not target:
            return Response({\"ok\": False, \"error\": \"not_found\"}, status=status.HTTP_404_NOT_FOUND)

        if target.id == viewer.id:
            return Response({\"ok\": False, \"error\": \"cannot_follow_self\"}, status=status.HTTP_400_BAD_REQUEST)

        # Respect blocks (allow unfollow; prevent follow when blocked)
        try:
            viewer_tok = viewer_id_for_user(viewer)
            target_tok = \"@\" + str(getattr(target, \"username\", \"\") or \"\").lower()
            if target_tok and follow and is_blocked_pair(viewer_tok, target_tok):
                return Response({\"ok\": False, \"error\": \"restricted\"}, status=status.HTTP_403_FORBIDDEN)
        except Exception:
            pass

        if not follow:
            UserFollow.objects.filter(follower=viewer, target=target).delete()
            try:
                cnt = int(UserFollow.objects.filter(target=target).count())
            except Exception:
                cnt = None
            return Response({\"ok\": True, \"following\": False, \"followers\": cnt}, status=status.HTTP_200_OK)

        try:
            UserFollow.objects.get_or_create(follower=viewer, target=target)
        except Exception:
            pass

        try:
            cnt = int(UserFollow.objects.filter(target=target).count())
        except Exception:
            cnt = None

        return Response({\"ok\": True, \"following\": True, \"followers\": cnt}, status=status.HTTP_200_OK)


@method_decorator(dev_csrf_exempt, name=\"dispatch\")
class SideActionView"""

m = pat.search(txt)
if not m:
    raise SystemExit("ERROR: Could not locate ProfileView block to patch in backend/siddes_prism/views.py")

txt = txt[:m.start()] + replacement + txt[m.end():]
p.write_text(txt)
print("OK: patched backend/siddes_prism/views.py (ProfileView + FollowActionView)")
PY

# ---------- Frontend: profile proxy forwards ?side=... ----------
"$PYTHON_BIN" - <<'PY'
from pathlib import Path

p = Path("frontend/src/app/api/profile/[username]/route.ts")
t = p.read_text()

if "new URL(req.url)" in t and "u.search" in t:
    print("OK: profile proxy already forwards query params")
    raise SystemExit(0)

old = '  const username = decodeURIComponent(raw);\n  const path = "/api/profile/" + encodeURIComponent(username);\n'
new = '  const username = decodeURIComponent(raw);\n  const u = new URL(req.url);\n  const path = "/api/profile/" + encodeURIComponent(username) + (u.search || "");\n'
if old not in t:
    raise SystemExit("ERROR: Could not patch profile proxy (unexpected contents).")
t = t.replace(old, new)
p.write_text(t)
print("OK: patched frontend profile proxy to forward query params")
PY

# ---------- Frontend: add /api/follow proxy ----------
if [ ! -f "$ROOT/frontend/src/app/api/follow/route.ts" ]; then
  mkdir -p "$ROOT/frontend/src/app/api/follow"
  cat > "$ROOT/frontend/src/app/api/follow/route.ts" <<'EOF'
import { NextResponse } from "next/server";
import { proxyJson } from "../auth/_proxy";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function applySetCookies(resp: NextResponse, setCookies: string[]) {
  for (const sc of setCookies || []) {
    if (!sc) continue;
    resp.headers.append("set-cookie", sc);
  }
}

export async function POST(req: Request) {
  let body: any = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const out = await proxyJson(req, "/api/follow", "POST", body);
  if (out instanceof NextResponse) return out;

  const { res, data, setCookies } = out;
  const resp = NextResponse.json(data, {
    status: res.status,
    headers: { "cache-control": "no-store" },
  });
  applySetCookies(resp, setCookies || []);
  return resp;
}
EOF
  echo "OK: wrote frontend/src/app/api/follow/route.ts"
else
  echo "OK: frontend /api/follow proxy already exists"
fi

# ---------- Frontend: patch PrismProfile.tsx (payload + tabs + follow row) ----------
"$PYTHON_BIN" - <<'PY'
from pathlib import Path
import re

p = Path("frontend/src/components/PrismProfile.tsx")
t = p.read_text()

# 1) Extend ProfileViewPayload type with optional fields
if "allowedSides?:" not in t:
    t = re.sub(
        r"export type ProfileViewPayload = \{\n  ok: boolean;\n  user\?: \{ id: number; username: string; handle: string \};\n  viewSide\?: SideId;\n",
        "export type ProfileViewPayload = {\n  ok: boolean;\n  user?: { id: number; username: string; handle: string };\n  viewSide?: SideId;\n  requestedSide?: SideId;\n  allowedSides?: SideId[];\n  viewerAuthed?: boolean;\n  viewerFollows?: boolean;\n  followers?: number | null;\n",
        t,
    )

# 2) Add PrismSideTabs export if missing (after SIDE_ICON const block)
if "export function PrismSideTabs" not in t:
    idx = t.find("const SIDE_ICON")
    if idx == -1:
        raise SystemExit("ERROR: Could not locate SIDE_ICON in PrismProfile.tsx")
    end = t.find("};", idx)
    if end == -1:
        raise SystemExit("ERROR: Could not locate end of SIDE_ICON block")
    end += 3
    tabs_code = """

export function PrismSideTabs(props: {
  active: SideId;
  allowedSides: SideId[];
  onPick: (side: SideId) => void;
}) {
  const { active, allowedSides, onPick } = props;
  const items: SideId[] = ["public", "friends", "close", "work"];
  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
        {items.map((side) => {
          const t = SIDE_THEMES[side];
          const Icon = SIDE_ICON[side];
          const isActive = active === side;
          const isAllowed = Array.isArray(allowedSides) ? allowedSides.includes(side) : side === "public";
          return (
            <button
              key={side}
              type="button"
              onClick={() => onPick(side)}
              className={cn(
                "relative px-4 py-2 rounded-full font-extrabold text-sm whitespace-nowrap border transition-all flex items-center gap-2",
                isActive ? cn(t.lightBg, "border-gray-200") : "bg-white border-gray-200 hover:bg-gray-50",
                !isAllowed && !isActive ? "opacity-60" : ""
              )}
              aria-disabled={!isAllowed}
            >
              <Icon size={16} className={isActive ? t.text : "text-gray-600"} />
              <span className={isActive ? "text-gray-900" : "text-gray-700"}>{SIDES[side].label}</span>
              {!isAllowed ? (
                <span className="absolute -top-1 -right-1 bg-white rounded-full p-0.5 shadow-sm border border-gray-200">
                  <Lock size={12} className="text-gray-500" />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
"""
    t = t[:end] + tabs_code + t[end:]

# 3) Patch SideWithSheet signature to accept optional follow props
if "follow?:" not in t:
    t = t.replace(
        "export function SideWithSheet(props: {\n  open: boolean;\n  onClose: () => void;\n  current: SideId | null;\n  busy?: boolean;\n  onPick: (side: SideId | \"public\") => Promise<void> | void;\n}) {",
        "export function SideWithSheet(props: {\n  open: boolean;\n  onClose: () => void;\n  current: SideId | null;\n  busy?: boolean;\n  onPick: (side: SideId | \"public\") => Promise<void> | void;\n  follow?: {\n    following: boolean;\n    followers?: number | null;\n    busy?: boolean;\n    onToggle: () => Promise<void> | void;\n  };\n}) {",
    )

# Insert follow row after header section (before choices)
if "Public follow is separate from Sides" not in t:
    marker = "<div className=\"space-y-2\">"
    i = t.find(marker)
    if i == -1:
        raise SystemExit("ERROR: Could not find SideWithSheet body marker.")
    follow_ui = """
        {/* Public follow is separate from Sides */}
        {props.follow ? (
          <button
            type="button"
            disabled={!!busy || !!props.follow.busy}
            onClick={async () => {
              try {
                await props.follow?.onToggle();
              } catch {}
            }}
            className={cn(
              "w-full p-4 rounded-2xl bg-white hover:bg-gray-50 flex items-center gap-4 text-left border border-gray-200",
              props.follow.following ? "shadow-sm" : ""
            )}
          >
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-700 shadow-sm">
              <Globe size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-extrabold text-gray-900 flex items-center gap-2">
                {props.follow.following ? "Unfollow" : "Follow"}
                {props.follow.following ? <Check size={16} className="text-blue-600" strokeWidth={3} /> : null}
              </div>
              <div className="text-xs text-gray-500">
                {props.follow.following ? "Subscribed to Public only." : "Subscribe to Public highlights."}
                {typeof props.follow.followers === "number" ? ` • ${props.follow.followers} followers` : ""}
              </div>
            </div>
          </button>
        ) : null}

"""
    t = t[:i] + follow_ui + t[i:]

# Close gating: disable close unless current is friends/close
if "const closeLockedByUpgrade" not in t:
    t = t.replace(
        "          {choices.map((c) => {\n            const t = SIDE_THEMES[c.side];\n            const Icon = SIDE_ICON[c.side];\n            const active = current === c.side;",
        "          {choices.map((c) => {\n            const t = SIDE_THEMES[c.side];\n            const Icon = SIDE_ICON[c.side];\n            const active = current === c.side;\n            const closeLockedByUpgrade = c.side === \"close\" && !(current === \"friends\" || current === \"close\");",
    )
    t = t.replace("disabled={!!busy}", "disabled={!!busy || closeLockedByUpgrade}")
    t = t.replace(
        "<div className=\"text-xs text-gray-500\">{c.desc}</div>",
        "<div className=\"text-xs text-gray-500\">{c.desc}{closeLockedByUpgrade ? \" (Friends first)\" : \"\"}</div>",
    )

p.write_text(t)
print("OK: patched PrismProfile.tsx")
PY

# ---------- Frontend: patch /u/[username]/page.tsx (tabs + follow wiring) ----------
"$PYTHON_BIN" - <<'PY'
from pathlib import Path

p = Path("frontend/src/app/u/[username]/page.tsx")
t = p.read_text()

# Import PrismSideTabs
t = t.replace(
    "  CopyLinkButton,\n  PrismIdentityCard,\n  SideActionButtons,\n  SideWithSheet,\n  type ProfileViewPayload,\n} from \"@/src/components/PrismProfile\";",
    "  CopyLinkButton,\n  PrismIdentityCard,\n  PrismSideTabs,\n  SideActionButtons,\n  SideWithSheet,\n  type ProfileViewPayload,\n} from \"@/src/components/PrismProfile\";",
)

# Add activeIdentitySide state (default 'public')
if "activeIdentitySide" not in t:
    t = t.replace(
        "  const [err, setErr] = useState<string | null>(null);\n",
        "  const [err, setErr] = useState<string | null>(null);\n\n  const [activeIdentitySide, setActiveIdentitySide] = useState<SideId>(\"public\");\n",
    )

# Fetch now includes ?side=
t = t.replace(
    "        const res = await fetch(`/api/profile/${encodeURIComponent(handle)}`, { cache: \"no-store\" });",
    "        const qs = activeIdentitySide ? `?side=${encodeURIComponent(activeIdentitySide)}` : \"\";\n        const res = await fetch(`/api/profile/${encodeURIComponent(handle)}${qs}`, { cache: \"no-store\" });",
)

# Effect depends on activeIdentitySide
t = t.replace("  }, [handle]);", "  }, [handle, activeIdentitySide]);")

# On success, sync activeIdentitySide to requestedSide/viewSide
if "setActiveIdentitySide(nextSide)" not in t:
    t = t.replace(
        "          setData(j as ProfileViewPayload);\n",
        "          const nextSide = (j?.requestedSide || j?.viewSide || \"public\") as SideId;\n          setActiveIdentitySide(nextSide);\n          setData(j as ProfileViewPayload);\n",
    )

# Compute displaySide and allowedSides
t = t.replace(
    "  const viewSide = (data?.viewSide || \"public\") as SideId;\n  const facet = data?.facet;\n  const user = data?.user;\n",
    "  const viewSide = (data?.viewSide || \"public\") as SideId;\n  const displaySide = ((data as any)?.requestedSide || viewSide) as SideId;\n  const allowedSides = ((data as any)?.allowedSides || [\"public\"]) as SideId[];\n  const facet = data?.facet;\n  const user = data?.user;\n",
)

# Use displaySide for PrismIdentityCard theming
t = t.replace("              viewSide={viewSide}\n", "              viewSide={displaySide}\n")

# Add follow toggle helper before doPickSide
if "const doToggleFollow" not in t:
    insert_at = t.find("  const doPickSide")
    if insert_at == -1:
        raise SystemExit("ERROR: Could not locate doPickSide in page.tsx")
    follow_code = """
  const doToggleFollow = async () => {
    if (!user?.handle) return;
    const want = !((data as any)?.viewerFollows);
    setBusy(true);
    try {
      const res = await fetch("/api/follow", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: user.handle, follow: want }),
      });
      const j = (await res.json().catch(() => null)) as any;
      if (!res.ok || !j || j.ok !== true) {
        const msg = res.status === 429 ? "Slow down." : "Could not update follow.";
        toast.error(msg);
        throw new Error(msg);
      }
      setData((prev) => {
        if (!prev || !prev.ok) return prev;
        return {
          ...(prev as any),
          viewerFollows: !!j.following,
          followers: typeof j.followers === "number" ? j.followers : (prev as any).followers,
        } as any;
      });
    } finally {
      setBusy(false);
    }
  };

"""
    t = t[:insert_at] + follow_code + t[insert_at:]

# Insert PrismSideTabs above PrismIdentityCard
if "<PrismSideTabs" not in t:
    needle = "<>\n            <PrismIdentityCard"
    if needle not in t:
        raise SystemExit("ERROR: Could not locate PrismIdentityCard insertion point.")
    tabs = """<>
            <PrismSideTabs
              active={displaySide}
              allowedSides={allowedSides}
              onPick={(side) => {
                if (!allowedSides.includes(side)) {
                  toast.error("Locked.");
                  return;
                }
                setActiveIdentitySide(side);
              }}
            />

            <PrismIdentityCard"""
    t = t.replace(needle, tabs)

# Pass follow props to SideWithSheet
if "follow={{" not in t:
    t = t.replace(
        "<SideWithSheet\n              open={sideSheet}\n              onClose={() => setSideSheet(false)}\n              current={viewerSidedAs}\n              busy={busy}\n              onPick={doPickSide}\n            />",
        "<SideWithSheet\n              open={sideSheet}\n              onClose={() => setSideSheet(false)}\n              current={viewerSidedAs}\n              busy={busy}\n              follow={{\n                following: !!(data as any)?.viewerFollows,\n                followers: (data as any)?.followers ?? null,\n                busy,\n                onToggle: doToggleFollow,\n              }}\n              onPick={doPickSide}\n            />",
    )

# Remove old note about viewers not toggling identity
t = t.replace(
    "<div className=\"mt-4 text-xs text-gray-500\">\n              You are viewing <span className=\"font-extrabold text-gray-700\">{viewSide}</span> identity. Viewers cannot toggle identity.\n            </div>\n",
    "",
)

p.write_text(t)
print("OK: patched profile page")
PY

echo ""
echo "✅ sd_531 applied."
echo "Backups: $BK"
echo ""
echo "Next (VS Code terminal):"
echo "  docker compose -f ops/docker/docker-compose.dev.yml exec backend python manage.py migrate"
echo "  docker compose -f ops/docker/docker-compose.dev.yml restart backend"
echo "  cd frontend && npm run typecheck"
echo "  cd frontend && npm run build"
echo ""
echo "Smoke:"
echo "  1) Open a profile /u/<username> and confirm tabs render."
echo "  2) Toggle Follow (should hit /api/follow and persist)."
echo "  3) Switch to an allowed tab (Friends/Close/Work) and confirm it fetches facet via ?side=."
echo "  4) Open Side sheet; confirm Follow row appears and Close is gated behind Friends."
