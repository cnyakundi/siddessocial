#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"

if [ ! -d "$ROOT/backend" ] || [ ! -d "$ROOT/frontend" ]; then
  echo "ERROR: Run this from sidesroot repo root (folder containing backend/ and frontend/)."
  exit 1
fi

echo "== sd_530: Prism Profile follow + multi-side profile fetch foundation =="

# ---------- Backend: add UserFollow model (idempotent) ----------
MODEL_FILE="$ROOT/backend/siddes_prism/models.py"
if ! grep -q "class UserFollow(models.Model)" "$MODEL_FILE"; then
  cat >> "$MODEL_FILE" <<'EOF'


class UserFollow(models.Model):
    """Public follow edge: follower follows target.

    One-way subscription for *Public* content only.
    Does NOT grant access to private Sides.
    """

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
EOF
  echo "OK: appended UserFollow model"
else
  echo "OK: UserFollow model already present"
fi

# ---------- Backend: migration 0005_userfollow.py ----------
MIG_FILE="$ROOT/backend/siddes_prism/migrations/0005_userfollow.py"
if [ ! -f "$MIG_FILE" ]; then
  cat > "$MIG_FILE" <<'EOF'
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
  echo "OK: wrote migration 0005_userfollow.py"
else
  echo "OK: migration already exists"
fi

# ---------- Backend: urls.py add follow route ----------
URLS_FILE="$ROOT/backend/siddes_prism/urls.py"
if ! grep -q "follow_action" "$URLS_FILE"; then
  perl -i -pe 's/from \.views import PrismView, ProfileView, SideActionView/from \.views import PrismView, ProfileView, SideActionView, FollowActionView/' "$URLS_FILE"
  perl -0777 -i -pe 's/path\("side", SideActionView\.as_view\(\), name="side_action"\),/path("side", SideActionView.as_view(), name="side_action"),\n    path("follow", FollowActionView.as_view(), name="follow_action"),/s' "$URLS_FILE"
  echo "OK: added follow route to siddes_prism/urls.py"
else
  echo "OK: follow route already wired"
fi

# ---------- Backend: views.py patch (ProfileView + FollowActionView) ----------
VIEWS_FILE="$ROOT/backend/siddes_prism/views.py"

python3 - <<'PY'
import re
from pathlib import Path

path = Path("backend/siddes_prism/views.py")
txt = path.read_text()

# ensure UserFollow import
txt = re.sub(
    r"from \.models import PrismFacet, PrismSideId, SideMembership\s*\n",
    "from .models import PrismFacet, PrismSideId, SideMembership, UserFollow\n",
    txt,
)

if "class FollowActionView(APIView):" in txt and "allowedSides" in txt and "requestedSide" in txt:
    Path("backend/siddes_prism/views.py").write_text(txt)
    print("OK: views.py already includes FollowActionView + multi-side ProfileView")
    raise SystemExit(0)

# Replace ProfileView.get and insert FollowActionView before SideActionView.
pat = re.compile(
    r"@method_decorator\(dev_csrf_exempt, name=\"dispatch\"\)\nclass ProfileView\(APIView\):.*?\n\n@method_decorator\(dev_csrf_exempt, name=\"dispatch\"\)\nclass SideActionView",
    re.S,
)

replacement = """@method_decorator(dev_csrf_exempt, name="dispatch")
class ProfileView(APIView):
    \"\"\"Viewer-resolved profile: GET /api/profile/<username>

    Supports optional query param:
      ?side=public|friends|close|work

    Viewer may only fetch sides in `allowedSides` (no access escalation).
    \"\"\"

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

        # Access level: what does the target show the viewer? (owner=target, member=viewer)
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

        # Viewer’s outgoing side edge (owner=viewer, member=target)
        viewer_sided_as = None
        if viewer and viewer.id != target.id:
            rel_out = SideMembership.objects.filter(owner=viewer, member=target).first()
            viewer_sided_as = rel_out.side if rel_out else None

        # Public follow status (separate from SideMembership)
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
        siders_count = None
        if view_side != \"close\":
            try:
                siders_count = int(SideMembership.objects.filter(member=target).count())
            except Exception:
                siders_count = None

        # Shared sets (best-effort)
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


@method_decorator(dev_csrf_exempt, name="dispatch")
class FollowActionView(APIView):
    \"\"\"Viewer action: Follow/Unfollow someone. POST /api/follow

    Body:
      {\"username\": \"@alice\", \"follow\": true|false}
    \"\"\"

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


@method_decorator(dev_csrf_exempt, name="dispatch")
class SideActionView"""

m = pat.search(txt)
if not m:
    raise SystemExit("ERROR: Could not locate ProfileView block to patch.")

txt = txt[:m.start()] + replacement + txt[m.end():]
Path("backend/siddes_prism/views.py").write_text(txt)
print("OK: patched ProfileView + added FollowActionView")
PY

# ---------- Frontend: profile proxy forwards ?side=... ----------
PROXY_FILE="$ROOT/frontend/src/app/api/profile/[username]/route.ts"
python3 - <<'PY'
from pathlib import Path
p = Path("frontend/src/app/api/profile/[username]/route.ts")
t = p.read_text()
needle = 'const path = "/api/profile/" + encodeURIComponent(username);'
if needle in t:
    t = t.replace(
        '  const username = decodeURIComponent(raw);\n  const path = "/api/profile/" + encodeURIComponent(username);\n',
        '  const username = decodeURIComponent(raw);\n  const u = new URL(req.url);\n  const path = "/api/profile/" + encodeURIComponent(username) + (u.search || "");\n'
    )
    p.write_text(t)
    print("OK: forwarded query params in profile proxy")
else:
    print("OK: profile proxy already forwards query params (or already patched)")
PY

echo ""
echo "NEXT STEPS:"
echo "1) From repo root, run migrations in backend container:"
echo "   docker compose -f ops/docker/docker-compose.dev.yml exec backend python manage.py migrate"
echo "2) Restart backend:"
echo "   docker compose -f ops/docker/docker-compose.dev.yml restart backend"
echo "3) Quick sanity checks:"
echo "   - GET /api/profile/@<user>?side=public"
echo "   - POST /api/follow  {username:'@<user>', follow:true}"
echo ""
echo "DONE (foundation)."
