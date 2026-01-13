# Siddes — STATE (single source of “where we are”)
**Updated:** 2026-01-13

## Current milestone
- **sd_143:** Posts+Replies DRF endpoints + Next proxy; DRF feed returns FeedPost shape + merges runtime posts

## Inbox (endgame status)
Inbox is now “migration-safe” and ready for broader feature work:
- Store can run in `memory`, `db`, or `auto`
- DB is seeded deterministically for dev
- Per-viewer read state is stored via `last_read_ts`
- Unread is derived from `last_read_ts` (truth-first; no cached counters)
- Debug ops work in DB mode (incoming simulation, reset unread)
- Dual-write is available for safe cutover (`SD_INBOX_DUALWRITE_DB=1`)

## Milestone ladder (Inbox DB cutover series)
This list exists mainly to satisfy gates that assert milestones are recorded.

- **sd_121b:** Inbox DB store behind a flag (default remains memory)
- **sd_121c:** Deterministic DB seed + one-command switch
- **sd_121c1:** Memory-store visibility enforcement check shim (`_role_can_view`)
- **sd_121d:** DB debug ops + optional dual-write
- **sd_121e:** Per-viewer unread scaffolding (read state)
- **sd_121f:** Remove `InboxThread.unread_count` (legacy)
- **sd_121g:** Inbox hydration stability (avoid SSR/CSR mismatch)
- **sd_121h:** Optional DB unread derivation path (prep for removal)
- **sd_121i:** Optional stop-writing unread counters (prep for removal)
- **sd_121j:** Remove unread counters from read state (derive-only)
- **sd_122:** Cleanup: remove legacy unread env toggles (keep `memory|db|auto` + dual-write)
- **sd_123:** `SD_INBOX_STORE=auto` (prefer DB when available, fallback to memory)
- **sd_124:** `.env.example` + helper script for auto mode (`scripts/dev/inbox_store_auto.sh`)
- **sd_125:** Inbox DB quickstart doc (`docs/INBOX_DB.md`)
- **sd_126:** Migration pack links Inbox DB doc + recommends auto mode

## Public Side ladder (tuning series)
- **sd_128:** Public Channels foundation (tag + feed filter row)
- **sd_128a:** Public Channels typecheck hotfix
- **sd_129:** Granular Siding prefs (per-person channel tuning)
- **sd_130:** Trust Dial MVP (Calm / Standard / Arena)
- **sd_131:** Public Slate + Pinned Stack (Public profile becomes a homepage)
- **sd_132:** Public Visual Calm (hide counts by default; reveal on hover/tap)
- **sd_133:** Public Trust Gates (server-enforced capabilities)

## Sets/Subsides ladder (server-side series)
- **sd_134:** Sets backend scaffold (records + history + endpoint stubs)
- **sd_135a:** Sets provider interface + hydration-safe loads (still local)
- **sd_135b:** Sets API stubs (`/api/sets/*`) + in-memory server store
- **sd_135c:** Sets `backend_stub` provider wired (frontend uses `/api/sets/*`)
- **sd_136a:** Sets provider `get/update/events` + local history events
- **sd_136b:** Sets management UI + history viewer
- **sd_137a:** Sets Django DRF router + ORM store (server enforcement wiring)
- **sd_137b:** Sets frontend `backend_stub` provider uses Django API base with fallback
- **sd_138a:** Sets Invites scaffold (create + accept/reject + invite link UI)
- **sd_138b:** Sets detail members parse regex hotfix (lint stability)
- **sd_138c:** Invites inbox UI (incoming/outgoing) + suggestions prefill
- **sd_139a:** Sets membership read access (non-owner access after invite acceptance)
- **sd_139b:** Sets UI read-only for non-owner viewers
- **sd_140a:** Sets membership UX polish (Joined badges + clearer copy)
- **sd_140b:** Sets membership propagation (invite acceptance emits sets-changed; Sets pages auto-refresh)
- **sd_141a:** Invites → Open Set CTA + joined-member onboarding polish
- **sd_141b:** Invites list resolves Set labels + Open Set primary action
- **sd_141c:** Invites snapshot Set label at create-time (pending recipients see Set name pre-acceptance)

## Feed ladder (DRF cutover series)
- **sd_142:** Feed DRF endpoint + API base-aware provider (backend_stub uses Django API base with fallback)

## NEXT overlay
- Next: TBD
