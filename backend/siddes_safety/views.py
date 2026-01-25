from __future__ import annotations

from typing import Any, Dict, Optional, Tuple

from django.conf import settings
from django.utils.decorators import method_decorator

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from siddes_backend.csrf import dev_csrf_exempt
from siddes_inbox.visibility_stub import resolve_viewer_role

from .models import ModerationAuditEvent, UserAppeal, UserBlock, UserReport, UserMute, UserHiddenPost
from .policy import normalize_target_token


_ALLOWED_REPORT_STATUSES = {"open", "reviewing", "resolved", "dismissed"}


def _raw_viewer_from_request(request) -> Optional[str]:
    user = getattr(request, "user", None)
    if user is not None and getattr(user, "is_authenticated", False):
        uid = str(getattr(user, "id", "") or "").strip()
        return f"me_{uid}" if uid else None

    if not getattr(settings, "DEBUG", False):
        return None

    raw = request.headers.get("x-sd-viewer") or getattr(request, "COOKIES", {}).get("sd_viewer")
    raw = str(raw or "").strip()
    return raw or None


def _viewer_ctx(request) -> Tuple[bool, str, str]:
    raw = _raw_viewer_from_request(request)
    has_viewer = bool(raw)
    viewer = (raw or "anon").strip() or "anon"
    role = resolve_viewer_role(viewer) or "anon"
    return has_viewer, viewer, role


def _restricted(has_viewer: bool, viewer: str, role: str, *, code: int) -> Response:
    return Response(
        {"ok": False, "restricted": True, "viewer": viewer if has_viewer else None, "role": role, "error": "restricted"},
        status=code,
    )


def _require_staff(request) -> Optional[Response]:
    user = getattr(request, "user", None)
    if not user or not getattr(user, "is_authenticated", False):
        return Response({"ok": False, "error": "auth_required"}, status=status.HTTP_401_UNAUTHORIZED)
    if not (getattr(user, "is_staff", False) or getattr(user, "is_superuser", False)):
        return Response({"ok": False, "error": "forbidden"}, status=status.HTTP_403_FORBIDDEN)
    return None


def _actor_id_from_request(request) -> str:
    u = getattr(request, "user", None)
    if u and getattr(u, "is_authenticated", False):
        uid = str(getattr(u, "id", "") or "").strip()
        if uid:
            return f"me_{uid}"
    # fallback (dev)
    raw = request.headers.get("x-sd-viewer") or getattr(request, "COOKIES", {}).get("sd_viewer")
    return str(raw or "").strip() or "unknown"


def _request_id(request) -> str:
    rid = str(getattr(request, "siddes_request_id", "") or "").strip()
    if rid:
        return rid[:64]
    hdr = str(request.headers.get("x-request-id") or "").strip()
    return hdr[:64]


def _audit(*, request, actor_id: str, action: str, target_type: str, target_id: str, meta: Optional[dict] = None) -> None:
    """Best-effort audit write. Must never break the request."""

    try:
        ModerationAuditEvent.objects.create(
            actor_id=str(actor_id or "").strip()[:64] or "unknown",
            action=str(action or "").strip()[:32] or "unknown",
            target_type=str(target_type or "").strip()[:16] or "unknown",
            target_id=str(target_id or "").strip()[:128] or "",
            meta=(meta or {}),
            request_id=_request_id(request),
        )
    except Exception:
        return



def _revoke_private_access_on_block(*, viewer_token: str, target_token: str) -> None:
    """Best-effort safety: blocking revokes private access edges.

    Effects (best-effort; must never raise):
    - Delete SideMembership edges in BOTH directions.
    - Remove each user from the other's Sets (both JSON + normalized table if present).

    NOTE: This function intentionally does NOT restore anything on unblock.
    """

    try:
        from django.contrib.auth import get_user_model
        from siddes_backend.identity import parse_viewer_user_id, normalize_handle, viewer_aliases
        from siddes_prism.models import SideMembership
        from siddes_sets.models import SiddesSet, SiddesSetMember
    except Exception:
        return

    def _safe_list(x: object) -> list[str]:
        try:
            return [str(v).strip() for v in (x or []) if str(v).strip()]
        except Exception:
            return []

    def _purge_member_from_sets(*, owner_ids: list[str], member_aliases: list[str]) -> None:
        if not owner_ids or not member_aliases:
            return

        # Normalized table (best-effort)
        try:
            SiddesSetMember.objects.filter(set__owner_id__in=owner_ids, member_id__in=member_aliases).delete()
        except Exception:
            pass

        # JSON members list (payload parity)
        try:
            qs = SiddesSet.objects.filter(owner_id__in=owner_ids)
            for st in qs.iterator():
                members = st.members if isinstance(st.members, list) else []
                members_s = [str(m).strip() for m in members if str(m).strip()]
                new = [m for m in members_s if m not in member_aliases]
                if new != members_s:
                    st.members = new
                    st.save(update_fields=["members", "updated_at"])
        except Exception:
            return

    try:
        vtok = str(viewer_token or "").strip()
        ttok = str(target_token or "").strip()
        if not vtok or not ttok:
            return

        v_uid = parse_viewer_user_id(vtok)
        if v_uid is None:
            # If we can't map the blocker to a real user, we can't revoke SideMembership.
            # Still attempt Sets cleanup via tokens.
            v_alias = list(viewer_aliases(vtok) or {vtok})
            t_alias = list(viewer_aliases(ttok) or {ttok})
            if vtok.startswith("me_") and "me" not in v_alias:
                v_alias.append("me")
            if ttok.startswith("me_") and "me" not in t_alias:
                t_alias.append("me")
            _purge_member_from_sets(owner_ids=_safe_list(v_alias), member_aliases=_safe_list(t_alias))
            _purge_member_from_sets(owner_ids=_safe_list(t_alias), member_aliases=_safe_list(v_alias))
            return

        User = get_user_model()
        viewer_user = User.objects.filter(id=v_uid).first()
        if viewer_user is None:
            return
        # Resolve target user.
        t_user = None
        t_user_viewer_id: Optional[str] = None
        t_user_handle: Optional[str] = None
        t_uid = parse_viewer_user_id(ttok)
        if t_uid is not None:
            t_user = User.objects.filter(id=t_uid).first()
        else:
            h = normalize_handle(ttok)
            if h:
                uname = h[1:]
                t_user = User.objects.filter(username__iexact=uname).first()

        # If the target is a handle token, Sets ownership is still commonly stored as "me_<id>".
        # We need both forms as aliases to reliably revoke membership for Sets owned by the target.
        try:
            if t_user is not None:
                tid = str(getattr(t_user, "id", "") or "").strip()
                if tid:
                    t_user_viewer_id = f"me_{tid}"
                uname2 = str(getattr(t_user, "username", "") or "").strip()
                if uname2:
                    t_user_handle = normalize_handle("@" + uname2) or ("@" + uname2.lower())
        except Exception:
            t_user_viewer_id = None
            t_user_handle = None

        if t_user is not None:
            SideMembership.objects.filter(owner=viewer_user, member=t_user).delete()
            SideMembership.objects.filter(owner=t_user, member=viewer_user).delete()

        # Token-based Set cleanup (both directions)
        v_alias = list(viewer_aliases(vtok) or {vtok})
        t_alias = list(viewer_aliases(ttok) or {ttok})

        # Add resolved target aliases (important when the block target was provided as a handle).
        if t_user_viewer_id and t_user_viewer_id not in t_alias:
            t_alias.append(t_user_viewer_id)
        if t_user_handle and t_user_handle not in t_alias:
            t_alias.append(t_user_handle)

        # Include legacy dev owner token for safety (seeded sets use owner_id="me").
        if vtok.startswith("me_") and "me" not in v_alias:
            v_alias.append("me")
        if ttok.startswith("me_") and "me" not in t_alias:
            t_alias.append("me")

        _purge_member_from_sets(owner_ids=_safe_list(v_alias), member_aliases=_safe_list(t_alias))
        _purge_member_from_sets(owner_ids=_safe_list(t_alias), member_aliases=_safe_list(v_alias))
    except Exception:
        return


@method_decorator(dev_csrf_exempt, name="dispatch")
class BlocksView(APIView):
    throttle_scope = "safety_block"
    permission_classes: list = []

    def get(self, request):
        has_viewer, viewer, role = _viewer_ctx(request)
        if not has_viewer:
            return _restricted(has_viewer, viewer, role, code=status.HTTP_401_UNAUTHORIZED)
        if role != "me":
            return _restricted(has_viewer, viewer, role, code=status.HTTP_403_FORBIDDEN)

        rows = list(UserBlock.objects.filter(blocker_id=viewer).values_list("blocked_token", flat=True))
        blocked = [str(x) for x in rows if str(x).strip()]
        return Response({"ok": True, "blocked": blocked}, status=status.HTTP_200_OK)

    def post(self, request):
        has_viewer, viewer, role = _viewer_ctx(request)
        if not has_viewer:
            return _restricted(has_viewer, viewer, role, code=status.HTTP_401_UNAUTHORIZED)
        if role != "me":
            return _restricted(has_viewer, viewer, role, code=status.HTTP_403_FORBIDDEN)

        body: Dict[str, Any] = request.data if isinstance(request.data, dict) else {}
        raw = body.get("target") or body.get("token") or body.get("handle")
        target = normalize_target_token(str(raw or ""))
        if not target:
            return Response({"ok": False, "error": "invalid_target"}, status=status.HTTP_400_BAD_REQUEST)

        if str(target).strip() == str(viewer).strip():
            return Response({"ok": False, "error": "cannot_block_self"}, status=status.HTTP_400_BAD_REQUEST)

        UserBlock.objects.get_or_create(blocker_id=viewer, blocked_token=target)

        _revoke_private_access_on_block(viewer_token=viewer, target_token=target)
        return Response({"ok": True, "blocked": True, "target": target}, status=status.HTTP_200_OK)


@method_decorator(dev_csrf_exempt, name="dispatch")
class BlockDeleteView(APIView):
    throttle_scope = "safety_block"
    permission_classes: list = []

    def delete(self, request, token: str):
        has_viewer, viewer, role = _viewer_ctx(request)
        if not has_viewer:
            return _restricted(has_viewer, viewer, role, code=status.HTTP_401_UNAUTHORIZED)
        if role != "me":
            return _restricted(has_viewer, viewer, role, code=status.HTTP_403_FORBIDDEN)

        target = normalize_target_token(token)
        if not target:
            return Response({"ok": False, "error": "invalid_target"}, status=status.HTTP_400_BAD_REQUEST)

        UserBlock.objects.filter(blocker_id=viewer, blocked_token=target).delete()
        return Response({"ok": True, "blocked": False, "target": target}, status=status.HTTP_200_OK)


@method_decorator(dev_csrf_exempt, name="dispatch")
class MutesView(APIView):
    throttle_scope = "safety_mute"
    permission_classes: list = []

    def get(self, request):
        has_viewer, viewer, role = _viewer_ctx(request)
        if not has_viewer:
            return _restricted(has_viewer, viewer, role, code=status.HTTP_401_UNAUTHORIZED)
        if role != "me":
            return _restricted(has_viewer, viewer, role, code=status.HTTP_403_FORBIDDEN)

        rows = list(UserMute.objects.filter(muter_id=viewer).values_list("muted_token", flat=True))
        muted = [str(x) for x in rows if str(x).strip()]
        return Response({"ok": True, "muted": muted}, status=status.HTTP_200_OK)

    def post(self, request):
        has_viewer, viewer, role = _viewer_ctx(request)
        if not has_viewer:
            return _restricted(has_viewer, viewer, role, code=status.HTTP_401_UNAUTHORIZED)
        if role != "me":
            return _restricted(has_viewer, viewer, role, code=status.HTTP_403_FORBIDDEN)

        body: Dict[str, Any] = request.data if isinstance(request.data, dict) else {}
        raw = body.get("target") or body.get("token") or body.get("handle")
        target = normalize_target_token(str(raw or ""))
        if not target:
            return Response({"ok": False, "error": "invalid_target"}, status=status.HTTP_400_BAD_REQUEST)

        if str(target).strip() == str(viewer).strip():
            return Response({"ok": False, "error": "cannot_mute_self"}, status=status.HTTP_400_BAD_REQUEST)

        UserMute.objects.get_or_create(muter_id=viewer, muted_token=target)
        return Response({"ok": True, "muted": True, "target": target}, status=status.HTTP_200_OK)


@method_decorator(dev_csrf_exempt, name="dispatch")
class MuteDeleteView(APIView):
    throttle_scope = "safety_mute"
    permission_classes: list = []

    def delete(self, request, token: str):
        has_viewer, viewer, role = _viewer_ctx(request)
        if not has_viewer:
            return _restricted(has_viewer, viewer, role, code=status.HTTP_401_UNAUTHORIZED)
        if role != "me":
            return _restricted(has_viewer, viewer, role, code=status.HTTP_403_FORBIDDEN)

        target = normalize_target_token(token)
        if not target:
            return Response({"ok": False, "error": "invalid_target"}, status=status.HTTP_400_BAD_REQUEST)

        UserMute.objects.filter(muter_id=viewer, muted_token=target).delete()
        return Response({"ok": True, "muted": False, "target": target}, status=status.HTTP_200_OK)




@method_decorator(dev_csrf_exempt, name="dispatch")
class HiddenPostsView(APIView):
    """Viewer-only hide/unhide posts (personal).

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
            .order_by('-created_at')
            .values_list('post_id', flat=True)[:5000]
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
        pid = str(body.get('postId') or body.get('post_id') or body.get('id') or '').strip()
        if not pid:
            return Response({"ok": False, "error": "invalid_post_id"}, status=status.HTTP_400_BAD_REQUEST)

        raw = body.get('hidden')
        hidden = True
        if raw is not None:
            if isinstance(raw, bool):
                hidden = raw
            else:
                ss = str(raw or '').strip().lower()
                if ss in ('true','1','yes','y'):
                    hidden = True
                elif ss in ('false','0','no','n'):
                    hidden = False

        if hidden:
            UserHiddenPost.objects.get_or_create(viewer_id=viewer, post_id=pid)
        else:
            UserHiddenPost.objects.filter(viewer_id=viewer, post_id=pid).delete()

        return Response({"ok": True, "postId": pid, "hidden": bool(hidden)}, status=status.HTTP_200_OK)

    # sd_422_user_hide
@method_decorator(dev_csrf_exempt, name="dispatch")
class ReportsCreateView(APIView):
    throttle_scope = "safety_report"
    permission_classes: list = []

    def post(self, request):
        has_viewer, viewer, role = _viewer_ctx(request)
        if not has_viewer:
            return _restricted(has_viewer, viewer, role, code=status.HTTP_401_UNAUTHORIZED)
        if role != "me":
            return _restricted(has_viewer, viewer, role, code=status.HTTP_403_FORBIDDEN)

        body: Dict[str, Any] = request.data if isinstance(request.data, dict) else {}

        target_type = str(body.get("targetType") or body.get("target_type") or "post").strip().lower()
        target_id = str(body.get("targetId") or body.get("target_id") or "").strip()
        reason = str(body.get("reason") or "other").strip().lower()[:32] or "other"
        details = str(body.get("details") or "").strip()[:2000]

        if target_type not in ("post", "user", "reply", "broadcast"):
            return Response({"ok": False, "error": "invalid_target_type"}, status=status.HTTP_400_BAD_REQUEST)
        if not target_id:
            return Response({"ok": False, "error": "missing_target_id"}, status=status.HTTP_400_BAD_REQUEST)

        rid = _request_id(request)

        UserReport.objects.create(
            reporter_id=viewer,
            target_type=target_type,
            target_id=target_id,
            reason=reason,
            details=details,
            request_id=rid,
            status="open",
        )

        return Response({"ok": True, "reported": True}, status=status.HTTP_200_OK)


@method_decorator(dev_csrf_exempt, name="dispatch")
class ReportsAdminListView(APIView):
    """Staff-only moderation list."""

    permission_classes: list = []

    def get(self, request):
        r = _require_staff(request)
        if r is not None:
            return r

        status_q = str(getattr(request, "query_params", {}).get("status") or "").strip().lower()
        qs = UserReport.objects.all().order_by("-created_at")
        if status_q in _ALLOWED_REPORT_STATUSES:
            qs = qs.filter(status=status_q)

        qs = qs[:500]

        # Bulk fetch post metadata for post targets (avoid N queries)
        post_ids = [str(rep.target_id) for rep in qs if str(rep.target_type) == "post" and str(rep.target_id).strip()]
        post_meta: Dict[str, Dict[str, Any]] = {}
        if post_ids:
            try:
                from siddes_post.models import Post  # type: ignore

                rows = Post.objects.filter(id__in=post_ids).values("id", "author_id", "text", "is_hidden")
                for r2 in rows:
                    pid = str(r2.get("id") or "").strip()
                    if not pid:
                        continue
                    post_meta[pid] = {
                        "authorId": str(r2.get("author_id") or "").strip() or None,
                        "preview": (str(r2.get("text") or "")[:180] if str(r2.get("text") or "") else "") or None,
                        "hidden": bool(r2.get("is_hidden") or False),
                    }
            except Exception:
                post_meta = {}

        items = []
        for rep in qs:
            meta = post_meta.get(str(rep.target_id)) if str(rep.target_type) == "post" else None
            items.append(
                {
                    "id": rep.id,
                    "createdAt": rep.created_at.isoformat() if rep.created_at else None,
                    "reporterId": rep.reporter_id,
                    "targetType": rep.target_type,
                    "targetId": rep.target_id,
                    "reason": rep.reason,
                    "details": rep.details,
                    "status": rep.status,
                    "requestId": rep.request_id,
                    "targetHidden": (meta.get("hidden") if meta else None),
                    "targetAuthorId": (meta.get("authorId") if meta else None),
                    "targetPreview": (meta.get("preview") if meta else None),
                }
            )

        return Response({"ok": True, "items": items}, status=status.HTTP_200_OK)


@method_decorator(dev_csrf_exempt, name="dispatch")
class ReportAdminUpdateView(APIView):
    """Staff-only moderation update."""

    permission_classes: list = []

    def patch(self, request, pk: int):
        r = _require_staff(request)
        if r is not None:
            return r

        body: Dict[str, Any] = request.data if isinstance(request.data, dict) else {}
        next_status = str(body.get("status") or "").strip().lower()
        if next_status not in _ALLOWED_REPORT_STATUSES:
            return Response({"ok": False, "error": "invalid_status"}, status=status.HTTP_400_BAD_REQUEST)

        rep = UserReport.objects.filter(id=pk).first()
        if not rep:
            return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        prev = str(rep.status or "").strip()
        rep.status = next_status
        rep.save(update_fields=["status"])

        _audit(
            request=request,
            actor_id=_actor_id_from_request(request),
            action="report_status",
            target_type="report",
            target_id=str(rep.id),
            meta={
                "prev": prev,
                "next": rep.status,
                "reportedTargetType": rep.target_type,
                "reportedTargetId": rep.target_id,
                "reason": rep.reason,
            },
        )

        return Response({"ok": True, "id": rep.id, "status": rep.status}, status=status.HTTP_200_OK)


@method_decorator(dev_csrf_exempt, name="dispatch")
class ModerationPostUpdateView(APIView):
    """Staff-only: hide/unhide a post.

    PATCH /api/moderation/posts/<post_id> { hidden: true|false }
    """

    throttle_scope = "moderation_post"
    permission_classes: list = []

    def patch(self, request, post_id: str):
        r = _require_staff(request)
        if r is not None:
            return r

        pid = str(post_id or "").strip()
        if not pid:
            return Response({"ok": False, "error": "missing_post_id"}, status=status.HTTP_400_BAD_REQUEST)

        body: Dict[str, Any] = request.data if isinstance(request.data, dict) else {}
        raw = body.get("hidden")
        hidden: Optional[bool] = None
        if isinstance(raw, bool):
            hidden = raw
        else:
            s = str(raw or "").strip().lower()
            if s in ("true", "1", "yes", "y"):
                hidden = True
            elif s in ("false", "0", "no", "n"):
                hidden = False

        if hidden is None:
            return Response({"ok": False, "error": "invalid_hidden"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            from siddes_post.models import Post  # type: ignore

            p = Post.objects.filter(id=pid).first()
            if not p:
                return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

            prev_hidden = bool(getattr(p, "is_hidden", False))
            p.is_hidden = bool(hidden)
            p.save(update_fields=["is_hidden"])

            _audit(
                request=request,
                actor_id=_actor_id_from_request(request),
                action=("post_hide" if bool(p.is_hidden) else "post_unhide"),
                target_type="post",
                target_id=pid,
                meta={"prevHidden": prev_hidden, "hidden": bool(p.is_hidden)},
            )

            return Response({"ok": True, "postId": pid, "hidden": bool(p.is_hidden)}, status=status.HTTP_200_OK)
        except Exception:
            return Response({"ok": False, "error": "server_error"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@method_decorator(dev_csrf_exempt, name="dispatch")
class ModerationAuditListView(APIView):
    """Staff-only: list moderation audit events."""

    throttle_scope = "moderation_audit"
    permission_classes: list = []

    def get(self, request):
        r = _require_staff(request)
        if r is not None:
            return r

        qp = getattr(request, "query_params", {})
        action_q = str(qp.get("action") or "").strip().lower()
        tt_q = str(qp.get("targetType") or qp.get("target_type") or "").strip().lower()
        tid_q = str(qp.get("targetId") or qp.get("target_id") or "").strip()

        try:
            limit = int(str(qp.get("limit") or "200").strip() or "200")
        except Exception:
            limit = 200
        limit = max(1, min(limit, 500))

        qs = ModerationAuditEvent.objects.all().order_by("-created_at")
        if action_q:
            qs = qs.filter(action__iexact=action_q)
        if tt_q:
            qs = qs.filter(target_type__iexact=tt_q)
        if tid_q:
            qs = qs.filter(target_id=tid_q)

        qs = qs[:limit]

        def _display(token: str) -> dict:
            try:
                from siddes_backend.identity import display_for_token  # type: ignore

                return display_for_token(token)
            except Exception:
                t = str(token or "").strip() or "unknown"
                return {"id": t, "handle": "@unknown", "name": t}

        items = []
        for e in qs:
            d = _display(str(e.actor_id or ""))
            items.append(
                {
                    "id": e.id,
                    "createdAt": e.created_at.isoformat() if e.created_at else None,
                    "actorId": str(e.actor_id or "").strip() or None,
                    "actorName": d.get("name"),
                    "actorHandle": d.get("handle"),
                    "action": e.action,
                    "targetType": e.target_type,
                    "targetId": e.target_id,
                    "requestId": e.request_id,
                    "meta": e.meta or {},
                }
            )

        return Response({"ok": True, "items": items}, status=status.HTTP_200_OK)


# --- Step 6.5: Export views (CSV/JSON) for moderation receipts ---
# NOTE: These endpoints are staff-only.

from datetime import datetime


def _export_limit(qp, *, default: int = 5000, max_limit: int = 10000) -> int:
    try:
        limit = int(str(qp.get("limit") or str(default)).strip())
    except Exception:
        limit = default
    limit = max(1, min(limit, max_limit))
    return limit


def _csv_response(filename: str, columns: list[str], rows: list[list[Any]]):
    import csv
    import io
    from django.http import HttpResponse

    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(columns)
    for r in rows:
        w.writerow(r)

    resp = HttpResponse(buf.getvalue(), content_type="text/csv; charset=utf-8")
    resp["Content-Disposition"] = f'attachment; filename="{filename}"'
    resp["Cache-Control"] = "no-store"
    return resp


@method_decorator(dev_csrf_exempt, name="dispatch")
class ReportsAdminExportView(APIView):
    """Staff-only: export reports as CSV or JSON.

    GET /api/reports/admin/export?status=open&format=csv|json&limit=5000
    """

    throttle_scope = "moderation_audit"
    permission_classes: list = []

    def get(self, request):
        r = _require_staff(request)
        if r is not None:
            return r

        qp = getattr(request, "query_params", {})
        status_q = str(qp.get("status") or "").strip().lower()
        fmt = str(qp.get("format") or "csv").strip().lower()
        limit = _export_limit(qp)

        qs = UserReport.objects.all().order_by("-created_at")
        if status_q in _ALLOWED_REPORT_STATUSES:
            qs = qs.filter(status=status_q)
        qs = qs[:limit]

        # Post metadata for post targets
        post_ids = [str(rep.target_id) for rep in qs if str(rep.target_type) == "post" and str(rep.target_id).strip()]
        post_meta: Dict[str, Dict[str, Any]] = {}
        if post_ids:
            try:
                from siddes_post.models import Post  # type: ignore

                rows = Post.objects.filter(id__in=post_ids).values("id", "author_id", "text", "is_hidden")
                for r2 in rows:
                    pid = str(r2.get("id") or "").strip()
                    if not pid:
                        continue
                    post_meta[pid] = {
                        "authorId": str(r2.get("author_id") or "").strip() or None,
                        "preview": (str(r2.get("text") or "")[:180] if str(r2.get("text") or "") else "") or None,
                        "hidden": bool(r2.get("is_hidden") or False),
                    }
            except Exception:
                post_meta = {}

        items: list[dict] = []
        for rep in qs:
            meta = post_meta.get(str(rep.target_id)) if str(rep.target_type) == "post" else None
            items.append(
                {
                    "id": rep.id,
                    "createdAt": rep.created_at.isoformat() if rep.created_at else None,
                    "reporterId": rep.reporter_id,
                    "targetType": rep.target_type,
                    "targetId": rep.target_id,
                    "reason": rep.reason,
                    "details": rep.details,
                    "status": rep.status,
                    "requestId": rep.request_id,
                    "targetHidden": (meta.get("hidden") if meta else None),
                    "targetAuthorId": (meta.get("authorId") if meta else None),
                    "targetPreview": (meta.get("preview") if meta else None),
                }
            )

        ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        bucket = status_q if status_q in _ALLOWED_REPORT_STATUSES else "all"

        if fmt == "json":
            resp = Response({"ok": True, "items": items}, status=status.HTTP_200_OK)
            resp["Cache-Control"] = "no-store"
            resp["Content-Disposition"] = f'attachment; filename="siddes_reports_{bucket}_{ts}.json"'
            return resp

        # CSV default
        columns = [
            "id",
            "createdAt",
            "status",
            "reporterId",
            "targetType",
            "targetId",
            "reason",
            "details",
            "requestId",
            "targetHidden",
            "targetAuthorId",
            "targetPreview",
        ]
        rows = []
        for it in items:
            rows.append([
                it.get("id"),
                it.get("createdAt"),
                it.get("status"),
                it.get("reporterId"),
                it.get("targetType"),
                it.get("targetId"),
                it.get("reason"),
                it.get("details"),
                it.get("requestId"),
                it.get("targetHidden"),
                it.get("targetAuthorId"),
                it.get("targetPreview"),
            ])

        return _csv_response(f"siddes_reports_{bucket}_{ts}.csv", columns, rows)


@method_decorator(dev_csrf_exempt, name="dispatch")
class ModerationAuditExportView(APIView):
    """Staff-only: export moderation audit events as CSV or JSON.

    GET /api/moderation/audit/export?format=csv|json&limit=5000&action=post_hide
    """

    throttle_scope = "moderation_audit"
    permission_classes: list = []

    def get(self, request):
        r = _require_staff(request)
        if r is not None:
            return r

        qp = getattr(request, "query_params", {})
        fmt = str(qp.get("format") or "csv").strip().lower()
        action_q = str(qp.get("action") or "").strip().lower()
        tt_q = str(qp.get("targetType") or qp.get("target_type") or "").strip().lower()
        tid_q = str(qp.get("targetId") or qp.get("target_id") or "").strip()
        limit = _export_limit(qp)

        qs = ModerationAuditEvent.objects.all().order_by("-created_at")
        if action_q:
            qs = qs.filter(action__iexact=action_q)
        if tt_q:
            qs = qs.filter(target_type__iexact=tt_q)
        if tid_q:
            qs = qs.filter(target_id=tid_q)

        qs = qs[:limit]

        def _display(token: str) -> dict:
            try:
                from siddes_backend.identity import display_for_token  # type: ignore

                return display_for_token(token)
            except Exception:
                t = str(token or "").strip() or "unknown"
                return {"id": t, "handle": "@unknown", "name": t}

        items: list[dict] = []
        for e in qs:
            d = _display(str(e.actor_id or ""))
            items.append(
                {
                    "id": e.id,
                    "createdAt": e.created_at.isoformat() if e.created_at else None,
                    "actorId": str(e.actor_id or "").strip() or None,
                    "actorName": d.get("name"),
                    "actorHandle": d.get("handle"),
                    "action": e.action,
                    "targetType": e.target_type,
                    "targetId": e.target_id,
                    "requestId": e.request_id,
                    "meta": e.meta or {},
                }
            )

        ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")

        if fmt == "json":
            resp = Response({"ok": True, "items": items}, status=status.HTTP_200_OK)
            resp["Cache-Control"] = "no-store"
            resp["Content-Disposition"] = f'attachment; filename="siddes_moderation_audit_{ts}.json"'
            return resp

        columns = [
            "id",
            "createdAt",
            "actorId",
            "actorHandle",
            "actorName",
            "action",
            "targetType",
            "targetId",
            "requestId",
            "meta",
        ]
        rows = []
        for it in items:
            rows.append([
                it.get("id"),
                it.get("createdAt"),
                it.get("actorId"),
                it.get("actorHandle"),
                it.get("actorName"),
                it.get("action"),
                it.get("targetType"),
                it.get("targetId"),
                it.get("requestId"),
                (str(it.get("meta")) if it.get("meta") is not None else ""),
            ])

        return _csv_response(f"siddes_moderation_audit_{ts}.csv", columns, rows)

# sd_319: Staff-only user state enforcement
_ALLOWED_USER_STATES = {"active", "read_only", "suspended", "banned"}


def _resolve_user_for_state(target: str):
    """Resolve a Django user from a target token.

    Accepts:
      - me_<id>
      - @username
      - username

    Returns (user, viewer_token, handle) or (None, None, None).
    """

    s = str(target or "").strip()
    if not s:
        return None, None, None

    try:
        from django.contrib.auth import get_user_model
        from siddes_backend.identity import parse_viewer_user_id, normalize_handle

        User = get_user_model()

        if s.startswith("me_"):
            uid = parse_viewer_user_id(s)
            if uid is None:
                return None, None, None
            u = User.objects.filter(id=uid).first()
            if not u:
                return None, None, None
            handle = "@" + str(getattr(u, "username", "") or "").strip().lower() if getattr(u, "username", None) else None
            return u, f"me_{uid}", handle

        h = normalize_handle(s)
        if h:
            uname = h.lstrip("@")
            u = User.objects.filter(username__iexact=uname).first()
            if not u:
                return None, None, None
            return u, f"me_{getattr(u, 'id', '')}", h

        # plain username-like
        if s and all(ch.isalnum() or ch in "_.-" for ch in s):
            u = User.objects.filter(username__iexact=s).first()
            if not u:
                return None, None, None
            return u, f"me_{getattr(u, 'id', '')}", "@" + str(getattr(u, "username", "") or "").strip().lower()

    except Exception:
        return None, None, None

    return None, None, None


@method_decorator(dev_csrf_exempt, name="dispatch")
class ModerationUserStateView(APIView):
    """Staff-only: set account state.

    POST /api/moderation/users/state
    Body:
      { target: "me_123" | "@username" | "username", state: "active|read_only|suspended|banned", minutes?: number, reason?: string }

    Notes:
    - minutes is optional; if provided, state auto-expires client-side when time passes.
    - We do not auto-write expiry resets here; middleware treats expired states as active.
    """

    throttle_scope = "moderation_user_state"
    permission_classes: list = []

    def post(self, request):
        r = _require_staff(request)
        if r is not None:
            return r

        body: Dict[str, Any] = request.data if isinstance(request.data, dict) else {}
        target = str(body.get("target") or body.get("token") or body.get("user") or "").strip()
        state = str(body.get("state") or "").strip().lower()
        minutes_raw = body.get("minutes")
        reason = str(body.get("reason") or "").strip()[:160]

        if not target:
            return Response({"ok": False, "error": "missing_target"}, status=status.HTTP_400_BAD_REQUEST)
        if state not in _ALLOWED_USER_STATES:
            return Response({"ok": False, "error": "invalid_state"}, status=status.HTTP_400_BAD_REQUEST)

        minutes = 0
        try:
            if minutes_raw is not None and str(minutes_raw).strip() != "":
                minutes = int(float(minutes_raw))
                if minutes < 0:
                    minutes = 0
        except Exception:
            minutes = 0

        user, viewer_token, handle = _resolve_user_for_state(target)
        if not user or not viewer_token:
            return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        from django.utils import timezone
        from datetime import timedelta
        from siddes_auth.models import SiddesProfile  # type: ignore

        prof, _ = SiddesProfile.objects.get_or_create(user=user)

        until = None
        if minutes > 0 and state in ("read_only", "suspended", "banned"):
            until = timezone.now() + timedelta(minutes=minutes)

        prof.account_state = state
        prof.account_state_until = until
        prof.account_state_reason = reason
        prof.account_state_set_by = _actor_id_from_request(request)
        prof.account_state_set_at = timezone.now()
        prof.save(update_fields=[
            "account_state",
            "account_state_until",
            "account_state_reason",
            "account_state_set_by",
            "account_state_set_at",
            "updated_at",
        ])

        _audit(
            request=request,
            actor_id=_actor_id_from_request(request),
            action="user_state",
            target_type="user",
            target_id=str(viewer_token),
            meta={"state": state, "until": until.isoformat() if until else None, "reason": reason, "handle": handle},
        )

        return Response(
            {
                "ok": True,
                "user": {"id": getattr(user, "id", None), "username": getattr(user, "username", "")},
                "viewerId": viewer_token,
                "handle": handle,
                "state": state,
                "until": until.isoformat() if until else None,
                "reason": reason,
            },
            status=status.HTTP_200_OK,
        )

@method_decorator(dev_csrf_exempt, name="dispatch")
class ModerationStatsView(APIView):
    """Staff-only: compact operational stats.

    GET /api/moderation/stats?hours=24

    Note: This is intentionally DB-backed only (no log scraping).
    """

    throttle_scope = "moderation_audit"
    permission_classes: list = []

    def get(self, request):
        r = _require_staff(request)
        if r is not None:
            return r

        from datetime import timedelta
        from django.utils import timezone
        from django.contrib.auth import get_user_model
        from django.db.models import Count

        qp = getattr(request, "query_params", {})
        try:
            hours = int(str(qp.get("hours") or "24").strip())
        except Exception:
            hours = 24
        hours = max(1, min(hours, 168))

        now = timezone.now()
        since_dt = now - timedelta(hours=hours)
        since_ts = float(since_dt.timestamp())

        def safe_int(x):
            try:
                return int(x)
            except Exception:
                return 0

        totals = {}
        lastw = {}

        # Users
        try:
            User = get_user_model()
            totals["users"] = User.objects.count()
            lastw["signups"] = User.objects.filter(date_joined__gte=since_dt).count()
        except Exception:
            totals["users"] = 0
            lastw["signups"] = 0

        # Account states (SiddesProfile)
        account_states = {}
        try:
            from siddes_auth.models import SiddesProfile  # type: ignore

            rows = SiddesProfile.objects.values("account_state").annotate(c=Count("id"))
            for r2 in rows:
                k = str(r2.get("account_state") or "").strip() or "unknown"
                account_states[k] = safe_int(r2.get("c"))
        except Exception:
            account_states = {}

        # Posts / replies
        try:
            from siddes_post.models import Post, Reply  # type: ignore

            totals["posts"] = Post.objects.count()
            totals["replies"] = Reply.objects.count()
            lastw["posts"] = Post.objects.filter(created_at__gte=since_ts).count()
            lastw["replies"] = Reply.objects.filter(created_at__gte=since_ts).count()
        except Exception:
            totals.setdefault("posts", 0)
            totals.setdefault("replies", 0)
            lastw.setdefault("posts", 0)
            lastw.setdefault("replies", 0)

        # Sets
        try:
            from siddes_sets.models import SiddesSet  # type: ignore

            totals["sets"] = SiddesSet.objects.count()
            lastw["sets"] = SiddesSet.objects.filter(created_at__gte=since_dt).count()
        except Exception:
            totals.setdefault("sets", 0)
            lastw.setdefault("sets", 0)

        # Invites
        try:
            from siddes_invites.models import SiddesInvite  # type: ignore

            totals["invites"] = SiddesInvite.objects.count()
            lastw["invites"] = SiddesInvite.objects.filter(created_at__gte=since_dt).count()
        except Exception:
            totals.setdefault("invites", 0)
            lastw.setdefault("invites", 0)

        # Notifications
        try:
            from siddes_notifications.models import Notification  # type: ignore

            totals["notifications"] = Notification.objects.count()
            lastw["notifications"] = Notification.objects.filter(created_at__gte=since_ts).count()
        except Exception:
            totals.setdefault("notifications", 0)
            lastw.setdefault("notifications", 0)

        # Broadcasts
        try:
            from siddes_broadcasts.models import Broadcast, BroadcastMember  # type: ignore

            totals["broadcasts"] = Broadcast.objects.count()
            totals["broadcast_members"] = BroadcastMember.objects.count()
            lastw["broadcasts"] = Broadcast.objects.filter(created_at__gte=since_dt).count()
        except Exception:
            totals.setdefault("broadcasts", 0)
            totals.setdefault("broadcast_members", 0)
            lastw.setdefault("broadcasts", 0)

        # Inbox
        try:
            from siddes_inbox.models import InboxThread, InboxMessage  # type: ignore

            totals["inbox_threads"] = InboxThread.objects.count()
            totals["inbox_messages"] = InboxMessage.objects.count()
            lastw["inbox_threads"] = InboxThread.objects.filter(created_at__gte=since_dt).count()
            lastw["inbox_messages"] = InboxMessage.objects.filter(ts__gte=since_dt).count()
        except Exception:
            totals.setdefault("inbox_threads", 0)
            totals.setdefault("inbox_messages", 0)
            lastw.setdefault("inbox_threads", 0)
            lastw.setdefault("inbox_messages", 0)

        # Safety: blocks + reports
        try:
            totals["blocks"] = UserBlock.objects.count()
            lastw["blocks"] = UserBlock.objects.filter(created_at__gte=since_dt).count()
        except Exception:
            totals.setdefault("blocks", 0)
            lastw.setdefault("blocks", 0)

        reports_by_status = {}
        try:
            totals["reports"] = UserReport.objects.count()
            lastw["reports"] = UserReport.objects.filter(created_at__gte=since_dt).count()
            rrows = UserReport.objects.values("status").annotate(c=Count("id"))
            for rr in rrows:
                k = str(rr.get("status") or "").strip() or "unknown"
                reports_by_status[k] = safe_int(rr.get("c"))
        except Exception:
            totals.setdefault("reports", 0)
            lastw.setdefault("reports", 0)
            reports_by_status = {}

        # Moderation audit actions in window
        audit_actions = {}
        try:
            arows = ModerationAuditEvent.objects.filter(created_at__gte=since_dt).values("action").annotate(c=Count("id"))
            for ar in arows:
                k = str(ar.get("action") or "").strip() or "unknown"
                audit_actions[k] = safe_int(ar.get("c"))
        except Exception:
            audit_actions = {}

        out = {
            "ok": True,
            "serverTime": now.isoformat(),
            "windowHours": hours,
            "totals": totals,
            "lastWindow": lastw,
            "accountStates": account_states,
            "reportsByStatus": reports_by_status,
            "auditActions": audit_actions,
        }
        return Response(out, status=status.HTTP_200_OK)


@method_decorator(dev_csrf_exempt, name="dispatch")
class ModerationStatsExportView(APIView):
    """Staff-only: export moderation stats as CSV or JSON.

    GET /api/moderation/stats/export?format=csv|json&hours=24
    """

    throttle_scope = "moderation_audit"
    permission_classes: list = []

    def get(self, request):
        r = _require_staff(request)
        if r is not None:
            return r

        qp = getattr(request, "query_params", {})
        fmt = str(qp.get("format") or "csv").strip().lower()

        # Reuse the JSON payload
        stats_resp = ModerationStatsView().get(request)
        if getattr(stats_resp, "status_code", 500) != 200:
            return stats_resp

        payload = getattr(stats_resp, "data", None) or {}
        ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")

        if fmt == "json":
            resp = Response(payload, status=status.HTTP_200_OK)
            resp["Cache-Control"] = "no-store"
            resp["Content-Disposition"] = f'attachment; filename="siddes_admin_stats_{ts}.json"'
            return resp

        # CSV default: group,name,value
        rows = []
        def add_group(group: str, d: dict):
            for k, v in (d or {}).items():
                rows.append([group, str(k), v])

        add_group("totals", payload.get("totals") or {})
        add_group("lastWindow", payload.get("lastWindow") or {})
        add_group("accountStates", payload.get("accountStates") or {})
        add_group("reportsByStatus", payload.get("reportsByStatus") or {})
        add_group("auditActions", payload.get("auditActions") or {})

        return _csv_response(f"siddes_admin_stats_{ts}.csv", ["group", "name", "value"], rows)



# ---------------------------------------------------------------------------
# Appeals (sd_398)
# ---------------------------------------------------------------------------

_ALLOWED_APPEAL_STATUSES = {"open", "reviewing", "resolved", "dismissed"}


@method_decorator(dev_csrf_exempt, name="dispatch")
class AppealsView(APIView):
    """GET/POST /api/appeals

    - GET: list current user's appeals
    - POST: create a new appeal

    Notes:
    - Must be callable even when the user's account is restricted for writes (see AccountStateWriteGate allowlist).
    """

    throttle_scope = "safety_appeal"
    permission_classes: list = []

    def get(self, request):
        has_viewer, viewer, role = _viewer_ctx(request)
        if not has_viewer:
            return _restricted(has_viewer, viewer, role, code=status.HTTP_401_UNAUTHORIZED)
        if role != "me":
            return _restricted(has_viewer, viewer, role, code=status.HTTP_403_FORBIDDEN)

        status_q = str(getattr(request, "query_params", {}).get("status") or "").strip().lower()
        try:
            limit = int(str(getattr(request, "query_params", {}).get("limit") or "200"))
        except Exception:
            limit = 200
        limit = max(1, min(limit, 500))

        try:
            from siddes_backend.identity import viewer_aliases
            aliases = list(viewer_aliases(viewer))
        except Exception:
            aliases = [viewer]

        from .models import UserAppeal

        qs = UserAppeal.objects.filter(appellant_id__in=aliases).order_by("-created_at")
        if status_q in _ALLOWED_APPEAL_STATUSES:
            qs = qs.filter(status=status_q)

        rows = list(qs[:limit])

        def _iso(dt):
            try:
                return dt.isoformat() if dt else None
            except Exception:
                return None

        items = []
        for a in rows:
            items.append(
                {
                    "id": getattr(a, "id", None),
                    "createdAt": _iso(getattr(a, "created_at", None)),
                    "appellantId": str(getattr(a, "appellant_id", "") or ""),
                    "targetType": str(getattr(a, "target_type", "") or ""),
                    "targetId": str(getattr(a, "target_id", "") or ""),
                    "reason": str(getattr(a, "reason", "") or ""),
                    "details": str(getattr(a, "details", "") or ""),
                    "status": str(getattr(a, "status", "") or ""),
                    "staffNote": str(getattr(a, "staff_note", "") or ""),
                    "requestId": str(getattr(a, "request_id", "") or ""),
                }
            )

        return Response({"ok": True, "items": items}, status=status.HTTP_200_OK)

    def post(self, request):
        has_viewer, viewer, role = _viewer_ctx(request)
        if not has_viewer:
            return _restricted(has_viewer, viewer, role, code=status.HTTP_401_UNAUTHORIZED)
        if role != "me":
            return _restricted(has_viewer, viewer, role, code=status.HTTP_403_FORBIDDEN)

        body: Dict[str, Any] = request.data if isinstance(request.data, dict) else {}

        target_type = str(body.get("targetType") or body.get("target_type") or "account").strip().lower()[:16] or "account"
        target_id = str(body.get("targetId") or body.get("target_id") or "").strip()[:128]
        reason = str(body.get("reason") or "other").strip().lower()[:32] or "other"
        details = str(body.get("details") or "").strip()[:4000]

        if target_type not in ("account", "post", "user", "reply", "broadcast", "report"):
            return Response({"ok": False, "error": "invalid_target_type"}, status=status.HTTP_400_BAD_REQUEST)

        from .models import UserAppeal

        a = UserAppeal.objects.create(
            appellant_id=viewer,
            target_type=target_type,
            target_id=target_id,
            reason=reason,
            details=details,
            request_id=_request_id(request),
            status="open",
            staff_note="",
        )

        _audit(
            request=request,
            actor_id=_actor_id_from_request(request),
            action="appeal_create",
            target_type="appeal",
            target_id=str(getattr(a, "id", "")),
            meta={"targetType": target_type, "targetId": target_id, "reason": reason},
        )

        return Response({"ok": True, "created": True, "id": getattr(a, "id", None)}, status=status.HTTP_200_OK)


@method_decorator(dev_csrf_exempt, name="dispatch")
class AppealsAdminListView(APIView):
    """Staff-only: list appeals (triage).

    GET /api/appeals/admin?status=open
    """

    permission_classes: list = []

    def get(self, request):
        r = _require_staff(request)
        if r is not None:
            return r

        status_q = str(getattr(request, "query_params", {}).get("status") or "").strip().lower()
        try:
            limit = int(str(getattr(request, "query_params", {}).get("limit") or "500"))
        except Exception:
            limit = 500
        limit = max(1, min(limit, 2000))

        from .models import UserAppeal

        qs = UserAppeal.objects.all().order_by("-created_at")
        if status_q in _ALLOWED_APPEAL_STATUSES:
            qs = qs.filter(status=status_q)

        rows = list(qs[:limit])

        def _iso(dt):
            try:
                return dt.isoformat() if dt else None
            except Exception:
                return None

        items = []
        for a in rows:
            items.append(
                {
                    "id": getattr(a, "id", None),
                    "createdAt": _iso(getattr(a, "created_at", None)),
                    "appellantId": str(getattr(a, "appellant_id", "") or ""),
                    "targetType": str(getattr(a, "target_type", "") or ""),
                    "targetId": str(getattr(a, "target_id", "") or ""),
                    "reason": str(getattr(a, "reason", "") or ""),
                    "details": str(getattr(a, "details", "") or ""),
                    "status": str(getattr(a, "status", "") or ""),
                    "staffNote": str(getattr(a, "staff_note", "") or ""),
                    "requestId": str(getattr(a, "request_id", "") or ""),
                }
            )

        return Response({"ok": True, "items": items}, status=status.HTTP_200_OK)


@method_decorator(dev_csrf_exempt, name="dispatch")
class AppealAdminUpdateView(APIView):
    """Staff-only: update appeal status / staff note.

    PATCH /api/appeals/<id>
    Body: { status, staffNote }
    """

    permission_classes: list = []

    def patch(self, request, pk: int):
        r = _require_staff(request)
        if r is not None:
            return r

        body: Dict[str, Any] = request.data if isinstance(request.data, dict) else {}
        next_status = str(body.get("status") or "").strip().lower()[:16]
        staff_note = str(body.get("staffNote") or body.get("staff_note") or "").strip()[:2000]

        if next_status and next_status not in _ALLOWED_APPEAL_STATUSES:
            return Response({"ok": False, "error": "invalid_status"}, status=status.HTTP_400_BAD_REQUEST)

        from .models import UserAppeal
        rec = UserAppeal.objects.filter(id=pk).first()
        if not rec:
            return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        update_fields = []
        if next_status and str(getattr(rec, "status", "") or "") != next_status:
            rec.status = next_status
            update_fields.append("status")
        if staff_note is not None and str(getattr(rec, "staff_note", "") or "") != staff_note:
            rec.staff_note = staff_note
            update_fields.append("staff_note")

        if update_fields:
            rec.save(update_fields=update_fields)

        _audit(
            request=request,
            actor_id=_actor_id_from_request(request),
            action="appeal_update",
            target_type="appeal",
            target_id=str(pk),
            meta={"status": str(getattr(rec, "status", "") or ""), "staffNote": staff_note[:120]},
        )

        return Response({"ok": True, "id": pk, "status": str(getattr(rec, "status", "") or "")}, status=status.HTTP_200_OK)
