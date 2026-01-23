"""Media endpoints (R2).

Endpoints (via /api root):
- POST /api/media/sign-upload
- POST /api/media/commit
- GET  /api/media/url?key=<r2_key>

Dev convenience:
- If DEBUG=True, dev viewer via x-sd-viewer / sd_viewer is accepted.

Production rule:
- Session auth is the truth (dev viewer is ignored when DEBUG=False).

Same-origin serving strategy:
- In production you should route https://<domain>/m/* to a Cloudflare Worker bound to R2.
- For local dev, we provide a backend redirect view that returns a short-lived signed GET URL.
"""

from __future__ import annotations

import os
import time
import uuid
from typing import Any, Dict, Optional, Tuple

from django.conf import settings
from django.http import HttpResponse, HttpResponseRedirect
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from siddes_inbox.visibility_stub import resolve_viewer_role

from .models import MediaObject
from .signing import presign_s3_url
from .token_urls import build_media_url


def _truthy(v: str | None) -> bool:
    return str(v or '').strip().lower() in ('1', 'true', 'yes', 'y', 'on')


def _r2_endpoint() -> str | None:
    ep = str(os.environ.get('SIDDES_R2_ENDPOINT', '') or '').strip()
    if ep:
        return ep
    acct = str(os.environ.get('SIDDES_R2_ACCOUNT_ID', '') or '').strip()
    if acct:
        return f'https://{acct}.r2.cloudflarestorage.com'
    return None


def _r2_cfg() -> Tuple[bool, Dict[str, str]]:
    endpoint = _r2_endpoint()
    bucket = str(os.environ.get('SIDDES_R2_BUCKET', '') or '').strip()
    ak = str(os.environ.get('SIDDES_R2_ACCESS_KEY_ID', '') or '').strip()
    sk = str(os.environ.get('SIDDES_R2_SECRET_ACCESS_KEY', '') or '').strip()
    if not endpoint or not bucket or not ak or not sk:
        return False, {}
    return True, {'endpoint': endpoint, 'bucket': bucket, 'ak': ak, 'sk': sk}


def _raw_viewer_from_request(request) -> Optional[str]:
    """Resolve a viewer string (safe).

    Nuance:
    - In dev, DRF may authenticate a SiddesViewer where user.id is already a viewer string (e.g. "me" or "me_1").
    - For real Django users, user.id is numeric; we convert to viewer id "me_<id>".
    """

    user = getattr(request, 'user', None)
    if user is not None and getattr(user, 'is_authenticated', False):
        uid = str(getattr(user, 'id', '') or '').strip()
        if not uid:
            return None
        # If uid already looks like a Siddes viewer id, do NOT prefix again.
        if uid == 'me' or uid.startswith(('me_', 'fr_', 'cl_', 'wk_')) or uid in ('friends', 'close', 'work'):
            return uid
        return f'me_{uid}'

    if not getattr(settings, 'DEBUG', False):
        return None

    raw = request.headers.get('x-sd-viewer') or getattr(request, 'COOKIES', {}).get('sd_viewer')
    raw = str(raw or '').strip()
    return raw or None


def _viewer_ctx(request) -> Tuple[bool, str, str]:
    raw = _raw_viewer_from_request(request)
    has_viewer = bool(raw)
    viewer = (raw or 'anon').strip() or 'anon'
    role = resolve_viewer_role(viewer) or 'anon'
    return has_viewer, viewer, role



# sd_384_media: allow viewers who can view the attached post to fetch private media

def _parse_me_id(raw: str) -> Optional[int]:
    s = str(raw or "").strip().lower()
    if not s:
        return None
    if s.startswith("me_"):
        s = s[3:]
    try:
        return int(s)
    except Exception:
        return None


def _viewer_can_view_prism_avatar(viewer_id: str, owner_viewer_id: str, side: str) -> bool:
    """Allow access to private avatar media for viewers who can see the owner's facet."""
    v_uid = _parse_me_id(viewer_id)
    o_uid = _parse_me_id(owner_viewer_id)
    s = str(side or "").strip().lower()
    if not v_uid or not o_uid or not s:
        return False
    if v_uid == o_uid:
        return True
    if s == "public":
        return True
    try:
        from django.contrib.auth import get_user_model
        from siddes_prism.models import SideMembership

        User = get_user_model()
        owner = User.objects.filter(id=o_uid).first()
        viewer = User.objects.filter(id=v_uid).first()
        if not owner or not viewer:
            return False
        return SideMembership.objects.filter(owner=owner, member=viewer, side=s).exists()
    except Exception:
        return False


def _viewer_can_view_post(viewer_id: str, post_id: str) -> bool:
    vid = str(viewer_id or "").strip()
    pid = str(post_id or "").strip()
    if not vid or not pid:
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


def _restricted_payload(has_viewer: bool, viewer: str, role: str, *, extra: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    out: Dict[str, Any] = {'ok': True, 'restricted': True, 'viewer': viewer if has_viewer else None, 'role': role}
    if extra:
        out.update(extra)
    return out


def _ext_for_content_type(ct: str) -> str:
    ct = (ct or '').split(';')[0].strip().lower()
    mapping = {
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/gif': 'gif',
        'video/mp4': 'mp4',
        'video/webm': 'webm',
        'video/quicktime': 'mov',
    }
    return mapping.get(ct, 'bin')


class MediaSignUploadView(APIView):
    """Create a MediaObject row and return a presigned PUT URL for direct upload to R2."""

    def post(self, request):
        has_viewer, viewer, role = _viewer_ctx(request)
        if not has_viewer:
            return Response(_restricted_payload(has_viewer, viewer, role), status=status.HTTP_200_OK)
        if role != 'me':
            return Response({'ok': False, 'error': 'forbidden', 'viewer': viewer, 'role': role}, status=status.HTTP_403_FORBIDDEN)

        ok, cfg = _r2_cfg()
        if not ok:
            return Response(
                {
                    'ok': False,
                    'error': 'r2_not_configured',
                    'hint': 'Set SIDDES_R2_ACCOUNT_ID (or SIDDES_R2_ENDPOINT), SIDDES_R2_BUCKET, SIDDES_R2_ACCESS_KEY_ID, SIDDES_R2_SECRET_ACCESS_KEY',
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        body: Dict[str, Any] = getattr(request, 'data', None) or {}
        kind = str(body.get('kind') or '').strip().lower()
        if kind not in ('image', 'video'):
            return Response({'ok': False, 'error': 'invalid_kind'}, status=status.HTTP_400_BAD_REQUEST)

        content_type = str(body.get('contentType') or body.get('content_type') or '').strip().lower()
        if not content_type:
            content_type = 'application/octet-stream'

        ext = str(body.get('ext') or '').strip().lower()
        if not ext:
            ext = _ext_for_content_type(content_type)

        uid = uuid.uuid4().hex
        media_id = f'm_{uid[:24]}'
        r2_key = f'u/{viewer}/{uid}.{ext}'

        now = float(time.time())
        MediaObject.objects.create(
            id=media_id,
            owner_id=viewer,
            r2_key=r2_key,
            kind=kind,
            content_type=content_type,
            bytes=int(body.get('bytes')) if str(body.get('bytes') or '').isdigit() else None,
            created_at=now,
            status='pending',
            is_public=False,
        )

        put_url = presign_s3_url(
            method='PUT',
            endpoint=cfg['endpoint'],
            bucket=cfg['bucket'],
            key=r2_key,
            access_key_id=cfg['ak'],
            secret_access_key=cfg['sk'],
            expires=300,
        )

        return Response(
            {
                'ok': True,
                'restricted': False,
                'viewer': viewer,
                'role': role,
                'media': {
                    'id': media_id,
                    'r2Key': r2_key,
                    'kind': kind,
                    'contentType': content_type,
                    'status': 'pending',
                },
                'upload': {
                    'method': 'PUT',
                    'url': put_url,
                    'headers': {'content-type': content_type},
                    'expiresIn': 300,
                },
                'serve': {'url': build_media_url(r2_key, is_public=False)},
            },
            status=status.HTTP_200_OK,
        )


class MediaCommitView(APIView):
    """Mark an upload as committed and optionally public.

    NOTE: In later patches, this should be called by Post creation after server-side visibility checks.
    """

    def post(self, request):
        has_viewer, viewer, role = _viewer_ctx(request)
        if not has_viewer:
            return Response(_restricted_payload(has_viewer, viewer, role), status=status.HTTP_200_OK)
        if role != 'me':
            return Response({'ok': False, 'error': 'forbidden', 'viewer': viewer, 'role': role}, status=status.HTTP_403_FORBIDDEN)

        body: Dict[str, Any] = getattr(request, 'data', None) or {}
        r2_key = str(body.get('r2Key') or body.get('key') or '').strip()
        if not r2_key:
            return Response({'ok': False, 'error': 'missing_key'}, status=status.HTTP_400_BAD_REQUEST)

        obj = MediaObject.objects.filter(r2_key=r2_key, owner_id=viewer).first()
        if not obj:
            return Response({'ok': False, 'error': 'not_found'}, status=status.HTTP_404_NOT_FOUND)

        make_public = _truthy(str(body.get('isPublic') or body.get('public') or '0'))
        post_id = str(body.get('postId') or body.get('post_id') or '').strip() or None

        obj.status = 'committed'
        obj.is_public = bool(make_public)
        obj.post_id = post_id
        obj.save(update_fields=['status', 'is_public', 'post_id'])

        return Response(
            {
                'ok': True,
                'restricted': False,
                'media': {
                    'id': obj.id,
                    'r2Key': obj.r2_key,
                    'status': obj.status,
                    'isPublic': obj.is_public,
                    'postId': obj.post_id,
                },
            },
            status=status.HTTP_200_OK,
        )


class MediaSignedUrlView(APIView):
    """Return a short-lived signed GET URL for a key.

    Public objects: allowed for any viewer.
    Private objects: owner-only in this phase.
    """

    def get(self, request):
        has_viewer, viewer, role = _viewer_ctx(request)

        key = str(getattr(request, 'query_params', {}).get('key') or '').strip()
        if not key:
            return Response({'ok': False, 'error': 'missing_key'}, status=status.HTTP_400_BAD_REQUEST)

        obj = MediaObject.objects.filter(r2_key=key).first()
        if not obj:
            return Response({'ok': False, 'error': 'not_found'}, status=status.HTTP_404_NOT_FOUND)

        if not obj.is_public:
            if not has_viewer:
                return Response(_restricted_payload(has_viewer, viewer, role), status=status.HTTP_200_OK)

            if obj.owner_id != viewer:
                pid = str(getattr(obj, "post_id", "") or "").strip()
                if pid.startswith("prism_avatar:"):
                    side = pid.split(":", 1)[1].strip().lower() if ":" in pid else ""
                    if not _viewer_can_view_prism_avatar(viewer, obj.owner_id, side):
                        return Response({'ok': False, 'error': 'forbidden'}, status=status.HTTP_403_FORBIDDEN)
                else:
                    if not pid or not _viewer_can_view_post(viewer, pid):
                        return Response({'ok': False, 'error': 'forbidden'}, status=status.HTTP_403_FORBIDDEN)

        ok, cfg = _r2_cfg()
        if not ok:
            return Response(
                {
                    'ok': False,
                    'error': 'r2_not_configured',
                    'hint': 'Set SIDDES_R2_ACCOUNT_ID (or SIDDES_R2_ENDPOINT), SIDDES_R2_BUCKET, SIDDES_R2_ACCESS_KEY_ID, SIDDES_R2_SECRET_ACCESS_KEY',
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        get_url = presign_s3_url(
            method='GET',
            endpoint=cfg['endpoint'],
            bucket=cfg['bucket'],
            key=obj.r2_key,
            access_key_id=cfg['ak'],
            secret_access_key=cfg['sk'],
            expires=60,
        )

        return Response(
            {
                'ok': True,
                'restricted': False,
                'url': get_url,
                'expiresIn': 60,
                'media': {'r2Key': obj.r2_key, 'kind': obj.kind, 'contentType': obj.content_type, 'isPublic': obj.is_public},
            },
            status=status.HTTP_200_OK,
        )


class MediaRedirectView(APIView):
    """DEV fallback: /m/<key> -> 302 to a signed GET URL.

    In production, route /m/* to a Cloudflare Worker bound to R2.
    """

    authentication_classes: list = []
    permission_classes: list = []

    def get(self, request, key: str):
        key = str(key or '').lstrip('/')
        if not key:
            return HttpResponse('bad_request', status=400)

        obj = MediaObject.objects.filter(r2_key=key).first()
        if not obj:
            return HttpResponse('not_found', status=404)

        has_viewer, viewer, role = _viewer_ctx(request)

        if not obj.is_public:
            if not has_viewer:
                return HttpResponse('restricted', status=401)

            if obj.owner_id != viewer:
                pid = str(getattr(obj, "post_id", "") or "").strip()
                if not pid or not _viewer_can_view_post(viewer, pid):
                    return HttpResponse('forbidden', status=403)

        ok, cfg = _r2_cfg()
        if not ok:
            return HttpResponse('r2_not_configured', status=503)

        get_url = presign_s3_url(
            method='GET',
            endpoint=cfg['endpoint'],
            bucket=cfg['bucket'],
            key=obj.r2_key,
            access_key_id=cfg['ak'],
            secret_access_key=cfg['sk'],
            expires=60,
        )
        return HttpResponseRedirect(get_url)
