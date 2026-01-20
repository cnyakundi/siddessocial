"""Admin registration for siddes_prism.

We make registration idempotent so repeated imports or legacy registrations
won't crash Django with AlreadyRegistered.

This unblocks:
- manage.py migrate
- dev server startup
"""

from django.contrib import admin
from django.contrib.admin.sites import AlreadyRegistered, NotRegistered

from .models import PrismFacet, SideMembership


class PrismFacetAdmin(admin.ModelAdmin):
    list_display = ("user", "side", "display_name", "updated_at")
    list_filter = ("side",)
    search_fields = ("user__username", "display_name")


class SideMembershipAdmin(admin.ModelAdmin):
    list_display = ("owner", "member", "side", "updated_at")
    list_filter = ("side",)
    search_fields = ("owner__username", "member__username")


# Idempotent registration (avoids django.contrib.admin.exceptions.AlreadyRegistered)
for model, admin_cls in (
    (PrismFacet, PrismFacetAdmin),
    (SideMembership, SideMembershipAdmin),
):
    try:
        admin.site.unregister(model)
    except NotRegistered:
        pass

    try:
        admin.site.register(model, admin_cls)
    except AlreadyRegistered:
        # Another module registered it first; keep the existing registration.
        pass
