from django.contrib import admin
from django.contrib.admin.sites import AlreadyRegistered, NotRegistered

from .models import Broadcast, BroadcastMember


def _safe_register(model):
    # Defensive: avoid startup crashes if another module already registered the model.
    try:
        admin.site.unregister(model)
    except NotRegistered:
        pass

    try:
        admin.site.register(model)
    except AlreadyRegistered:
        pass


_safe_register(Broadcast)
_safe_register(BroadcastMember)
