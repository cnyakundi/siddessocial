"""Example Django view for POST /api/contacts/match.

This file is NOT auto-registered. Copy into your Django app and wire it up.

Assumes:
- authenticated request.user
- identity tokens stored in DB (query by token IN (...))

For now, we simulate known token mapping (replace with DB query).

"""

from __future__ import annotations

import json
from django.http import JsonResponse
from django.views.decorators.http import require_POST

from .endpoint_stub import contacts_match

# Replace this with a DB query:
KNOWN = {}  # token -> {user_id, handle, display_name}


@require_POST
def contacts_match_view(request):
    body = json.loads(request.body or b"{}")
    identifiers = body.get("identifiers") or []
    if not isinstance(identifiers, list):
        return JsonResponse({"error": "identifiers must be a list"}, status=400)

    out = contacts_match(identifiers, KNOWN, default_region="KE")
    return JsonResponse(out)
