"""Smoke test: DB inbox DM mirror delivery (two-party messaging).

Purpose (sd_786):
- Assert that when viewer A sends a message to viewer B, the recipient gets:
  1) a mirrored per-owner thread
  2) a mirrored inbound message (from_id="them")
- This is a DB-only test (DbInboxStore). It does NOT hit HTTP.

Run:
  python manage.py inbox_dm_smoke

Tip (Docker dev):
  bash scripts/dev/inbox_dm_smoke.sh
"""

from __future__ import annotations

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

from siddes_inbox.store_db import DbInboxStore
from siddes_inbox.models_stub import ParticipantRecord
from siddes_inbox.models import InboxThread, InboxMessage, InboxThreadReadState


class Command(BaseCommand):
    help = "Smoke test: DB inbox DM mirror delivery (two-party messaging)"

    def handle(self, *args, **options):
        User = get_user_model()

        # Deterministic, low-risk test users.
        # If they already exist, we reuse them.
        a, _ = User.objects.get_or_create(username="dm_smoke_a", defaults={"first_name": "DM", "last_name": "SmokeA"})
        b, _ = User.objects.get_or_create(username="dm_smoke_b", defaults={"first_name": "DM", "last_name": "SmokeB"})

        viewer_a = f"me_{a.id}"
        viewer_b = f"me_{b.id}"

        a_handle = "@" + str(a.username or "").strip().lower()
        b_handle = "@" + str(b.username or "").strip().lower()

        store = DbInboxStore()

        # Clean prior smoke artifacts for these test users (safe + scoped).
        try:
            thread_ids = list(
                InboxThread.objects.filter(owner_viewer_id__in=[viewer_a, viewer_b])
                .filter(participant_user_id__in=[str(a.id), str(b.id)])
                .values_list("id", flat=True)
            )
            if thread_ids:
                InboxThreadReadState.objects.filter(thread_id__in=thread_ids).delete()
                InboxMessage.objects.filter(thread_id__in=thread_ids).delete()
                InboxThread.objects.filter(id__in=thread_ids).delete()
        except Exception:
            # If migrations aren't applied, this will fail—let the test below raise clearly.
            pass

        msg_text = "hello from dm_smoke"
        client_key = "sd_786_smoke"

        # Ensure A's thread -> B (stable idempotency prefers user_id).
        p_b = ParticipantRecord(
            display_name=b.get_full_name() or b.username or "UserB",
            initials=("".join([x[0].upper() for x in (b.get_full_name() or b.username or "B").split() if x])[:2] or "B"),
            avatar_seed=str(b.id),
            user_id=str(b.id),
            handle=b_handle,
        )

        try:
            t_a, _ = store.ensure_thread(
                viewer_id=viewer_a,
                other_token=b_handle,
                locked_side="friends",
                title=p_b.display_name,
                participant=p_b,
            )
        except Exception as e:
            raise SystemExit(f"❌ ensure_thread(A->B) failed: {e}")

        # Send message from A
        try:
            store.send_message(viewer_id=viewer_a, thread_id=str(t_a.id), text=msg_text, client_key=client_key)
        except Exception as e:
            raise SystemExit(f"❌ send_message(A) failed: {e}")

        # Recipient thread should exist after mirror-delivery. We resolve it via ensure_thread(B->A).
        p_a = ParticipantRecord(
            display_name=a.get_full_name() or a.username or "UserA",
            initials=("".join([x[0].upper() for x in (a.get_full_name() or a.username or "A").split() if x])[:2] or "A"),
            avatar_seed=str(a.id),
            user_id=str(a.id),
            handle=a_handle,
        )

        try:
            t_b, _ = store.ensure_thread(
                viewer_id=viewer_b,
                other_token=a_handle,
                locked_side="friends",
                title=p_a.display_name,
                participant=p_a,
            )
        except Exception as e:
            raise SystemExit(f"❌ ensure_thread(B->A) failed: {e}")

        # Fetch recipient messages and assert inbound mirror exists.
        try:
            _, _, msgs_b, _, _ = store.get_thread(viewer_id=viewer_b, thread_id=str(t_b.id), limit=50, cursor=None)
        except Exception as e:
            raise SystemExit(f"❌ get_thread(B) failed: {e}")

        got_inbound = any((m.from_id == "them" and str(m.text or "") == msg_text) for m in msgs_b)
        if not got_inbound:
            diag = []
            for m in msgs_b[-10:]:
                diag.append(f"{m.from_id}:{m.text}")
            raise SystemExit("❌ Mirror delivery missing on recipient. Last messages: " + " | ".join(diag))

        self.stdout.write(self.style.SUCCESS("✅ DM mirror delivery OK (DB store)"))
        self.stdout.write(f"   A thread: {t_a.id} (viewer {viewer_a} -> {b_handle})")
        self.stdout.write(f"   B thread: {t_b.id} (viewer {viewer_b} -> {a_handle})")
