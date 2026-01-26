# sd_741_dm_bootstrap_userid_stability

## Goal
Make “Message”/DM threads stable even if a user changes their @handle, while keeping 1‑tap messaging.

## Changes
- Backend: POST /api/inbox/threads now accepts `targetUserId` and passes it into `ParticipantRecord`.
- DB inbox store: `ensure_thread()` now prefers `participant_user_id` for idempotency (falls back to handle), and auto-migrates older handle-based threads by backfilling `participant_user_id` when possible.
- Memory inbox store: DM idempotency now prefers `participant.user_id` when provided.
- Frontend: Profile “Message” now includes `targetUserId` in the DM bootstrap call.

## Files
- backend/siddes_inbox/views.py
- backend/siddes_inbox/store_db.py
- backend/siddes_inbox/store_memory.py
- frontend/src/app/u/[username]/page.tsx
