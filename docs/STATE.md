# Siddes — STATE (single source of “where we are”)
**Updated:** 2026-01-26

## Baseline (active truth)
- Branch:
- Commit:
- Zip/Overlay ID:
- Environment: local | prod
- Last overlay applied:


## Current milestone
- **sd_770:** Feed: add FLAGS.feedModules + NEXT_PUBLIC_SD_FEED_MODULES env flag (unblocks feed modules framework check)
- **sd_769:** Feed: add FLAGS.feedModules + NEXT_PUBLIC_SD_FEED_MODULES (fix feed modules framework check + SideFeed TS errors)
- **sd_767:** Feed: restore feed modules framework files (feedModules.ts + SideFeed.tsx) to fix harness check + TS parse errors
- **sd_766:** Inbox: fix DB store compile blockers in `store_db.py` (ensure_thread early-return; send_message idempotency block)
- **sd_752:** Notifications: set `cache-control: no-store` on Next /api/notifications + mark-all-read to prevent stale/cross-user caching
- **sd_750:** Notifications: fix alerts list endpoint (filter before LIMIT; avoids Django sliced-query crash)
- **sd_146:** Posts+Replies DB scaffold (models+migrations+SD_POST_STORE=memory|db|auto)
- **sd_753:** Stabilization manual + docs slimming (canonical docs + archive) + root `verify_overlays.sh` wrapper.
- **sd_754:** Repo hygiene (TypeScript tsBuildInfoFile path) + dedupe stub viewer (inboxViewer re-export).



## Clerkless Context Engine (Jan 2026)
- On-device Suggested Sets after contacts match (review-first; never auto-apply)
- Guardrails: contact-derived Sets cannot be Public
- Privacy-safe telemetry (counts-only) for suggestion quality
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
- **sd_128:** Public Topics foundation (tag + feed filter row)
- **sd_128a:** Public Topics typecheck hotfix
- **sd_129:** Granular Siding prefs (per-person topic tuning)
- **sd_130:** Trust Dial MVP (Calm / Standard / Arena)
- **sd_131:** Public Slate + Pinned Stack (Public profile becomes a homepage)
- **sd_181i:** Public Slate DB-backed (no frontend mockPublicSlate; adds /api/slate + seed)
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
- **sd_142:** Feed DRF endpoint + API-base-aware Next proxy (client calls same-origin /api/feed; Next proxies to Django via SD_INTERNAL_API_BASE / NEXT_PUBLIC_API_BASE)

## NEXT overlay
- **sd_777_reply_counts_labels_and_reply_profile_links:** UI: label reply/like counts + make reply authors clickable in post detail.
- **sd_772:** Groups mode (copy): Sets → Groups in UI; All → Side label; SideFeed clears stale stored setId
- Next: TBD
- **sd_769_alerts_copy_cleanup:** Standardize Alerts naming (remove Notifs/Notifications drift + aria-labels).
- **sd_768_clean_alerts_page_hide_push_debug:** UI: /siddes-notifications shows Alerts first; push settings/debug tools collapsed (optional).
- **sd_774_fix_build_hooks_and_deps:** Frontend build: fix rules-of-hooks errors + clean hook deps (router/activeTag/load).
- **sd_766_alerts_drawer_close_icon_chevron:** Alerts drawer: change dismiss icon from X → ChevronDown (reduce icon confusion).
- **sd_765_desktop_rail_alerts_tab:** Desktop rail: swap Sets → Alerts (alerts are first-class on desktop)
- **sd_764_fix_icon_tap_targets_44px:** UI: Make key icon-only controls easier to tap (AppTopBar icons → 44×44; Toast dismiss → 44×44; SuggestedSets member remove → bigger hit area without pill blowup).
- **sd_763_standardize_alerts_label:** UI: Standardize label to “Alerts” across nav + NotificationsDrawer title + a11y strings (removes Notifs/Notifications inconsistency).
- **sd_762_compact_other_sheets_max_height:** UI: Reduce max height of common sheets (ChipOverflow/SetPicker/ProfileActions) to 70dvh so they feel less full-screen on mobile.
- **sd_761_compact_post_actions_sheet:** UI: Make PostActionsSheet ("…") compact on mobile (max height 70dvh + smaller paddings) so it doesn't feel full-screen.
- **sd_760_post_detail_safe_back_to_list:** UI: Post detail back always returns to the exact list route (uses saved return path; avoids router.back out-of-app in PWA).
- **sd_759_topbar_alerts_drawer_button:** Mobile AppTopBar bell opens Notifications Drawer (PWA quick alerts)
- **sd_758_standardize_sheet_backdrops_touchstart:** UI: standardize all sheet backdrops to close on touchstart with preventDefault (consistent, anti-jank).
- **sd_756_fix_actions_sheet_backdrop_ghosttap:** UI: prevent PostActionsSheet backdrop ghost taps/clickthrough on iOS PWA (touchstart now preventDefault).
- **sd_757_fix_setpicker_member_avatars_no_external_calls:** UI: SetPickerSheet member preview avatars are now offline-safe initials badges (removed external Dicebear calls).
- **sd_749_media_picker_local_media_fix:** Media picker reliability (iOS/Safari-safe file inputs + extension-based kind detection)
- **sd_757_postcard_media_single_image_contain:** PostCard MediaGrid: single-image preview uses object-contain + aspect-aware height (reduced cropping / bad image UI).
- **sd_758_media_ui_mobile_carousel_aspect:** MediaGrid (PostCard): mobile multi-media carousel uses aspect-ratio containers (no fixed `h-64`) for more stable previews.
- **sd_759_compose_media_preview_no_crop:** Compose: selected media previews use object-contain (no crop) + black letterbox background.
- **sd_780_threads_style_media_grid:** MediaGrid (PostCard): Threads-style square tiles for multi-media across breakpoints (no mobile carousel).
- **sd_763_fix_compose_ts2322_sd759_insertion:** Fix Compose TS2322 by repairing sd_759 insertion bug (restore sd_384 JSX comment brace + remove extra '}' on sd_759 comment line).

- **sd_740_sets_v1_dead_simple:** Sets v1 UX simplification (Sets-as-audience: SetFilterBar on Feed; Set hub = Feed+People with More sheet; read-only banners; scannable set cards)
- **sd_743_sets_v1_1_inline_create_fast_add:** Sets v1.1 (Inline create in picker + Add People sheet: type/paste + voice stub + invite-link fallback)

- **sd_741_fix_sd740_sets_v1_syntax:** Hotfix: repair sd_740 JSX syntax in Sets page + SideFeed; add MIGRATION_PACK if missing

- **sd_736_fix_postcard_nav_share_restore:** Restore PostCard navigation/share helpers after syntax corruption (openPost/openProfile/doShare)

- **sd_734_fix_postcard_share_block_syntax:** Fix PostCard share block syntax (restore text: field)

- **sd_733_fix_postcard_saveReturnScroll_call:** Fix PostCard saveReturnScroll() call signature (no more (path, y) args)

- **sd_731_fix_sets_page_syntax:** Fix Sets detail page JSX syntax (nested conditional rendering)

- **sd_717_profile_v2_shell_header_tabs:** Profile V2 hero header + content tabs shell (Posts tab unchanged; Media/Sets placeholders)

- **sd_144c:** Posts+Replies DRF smoke test script (fast full-stack proof via Docker)

- **sd_145a:** SD_INTERNAL_API_BASE for Docker-safe Next server proxies (internal: http://backend:8000)

- **sd_146b:** Posts+Replies views handle DB-mode reply errors safely (no crashes; default-safe 404)

- **sd_146c:** Posts DB persistence smoke (create+restart+verify post/replies survive)

- **sd_148a:** Ban 'Rooms' terminology globally; use Sets wording

- **sd_148b:** Guided Set creator sheet (Name→Side→Theme→Members→Create)\n\n- **sd_148e:** Add minimal Django API tests (posts+sets) so manage.py test finds tests\n\n\n- **sd_148f:** Fix Django tests by forcing DEBUG=True (enable x-sd-viewer header in Docker tests)\n
## Launch hardening
- **sd_318:** Secure cookies in production (Next-set session cookies include Secure when NODE_ENV=production)
- Launch Part 0 plan: `docs/LAUNCH_PART_0.md`

## Launch hardening (Part 0)
See `docs/LAUNCH_PART_0.md` for the closure plan.

- **sd_313:** Email infrastructure foundation (EmailService + `python manage.py send_test_email`)

- **sd_314:** Email verification + resend (tokens + endpoints + minimal UI)
- **sd_317:** Username policy (reserved + lowercase + anti-impersonation; case-insensitive uniqueness)

## Launch hardening (Part 0)
- **sd_316:** Password reset + change password (fix for sd_315)
- **sd_319:** Account state enforcement (read-only/suspended/banned) + staff endpoint + middleware
- **sd_320:** Staff admin stats cockpit (moderation/stats + export + UI)
- **sd_321:** Legal/policy pages (Terms, Privacy, Community Guidelines) + login/signup links
- **sd_324:** Account lifecycle (email change + deactivate/delete + export)
- **sd_325:** Post edit + delete (edit window + server-truth affordances)
- **sd_326:** Search v0 (People + Public Posts) + /search + /u/<username>
- **sd_322:** Device/session management (session list + revoke + logout other devices)

## Recent applied overlays (Jan 19, 2026)

These are the overlays applied/created during the current session (evidence: terminal logs):

- sd_376_password_reset_revoke_other_sessions - security: revoke other sessions on password reset
- sd_377_on_device_token_clustering_v2 - on-device group suggestions (token clustering) + ML_PART_2 doc
- sd_378_fix_proxy_import_paths - fixed proxyJson relative paths (introduced double-quote typo)
- sd_379_fix_proxy_double_quote - fixed the broken proxyJson import lines
- sd_381_remove_mock_suggestions_use_ondevice_engine - removed mock "Gym Squad" suggestions; use on-device engine in Import Set
- sd_382_fix_desktop_siderail_search_icon - missing lucide Search import (typecheck)
- sd_383_cce_v12_bulk_accept_undo_delete_sets_telemetry_knob - bulk accept + Undo + delete + telemetry knob (pending apply)
- sd_384_docs_refresh_status_pack - added status refresh doc + ML part docs

- **sd_566:** Fix SetPickerSheet backdrop handler corruption + add default-safe restricted branch to /api/inbox/threads when stub viewer is missing.

## Known gotchas

- Some helper scripts assume `python` exists; on macOS you often have `python3` only.
- If your shell prompt shows you are inside `frontend/`, then `cd frontend` will fail; run `npm ...` directly.
- When Django asks for a one-off default during migrations, it expects valid Python: use `'legacy'` not `legacy`.

## Server safety (Sets)
- Set members are normalized to @handles, deduped, and capped server-side.

## PWA (mobile app feel)
- **sd_741_push_backend_db:** Push subscriptions stored in backend DB + endpoints + UI wiring
- **sd_742_push_auto_dispatch_on_notifications:** push is automatically dispatched when notifications are created (reply/like/mention/echo)


## World launch readiness (Jan 2026)
- **sd_751:** Launch P0 gatepack + World Launch docs
  - Run: `bash scripts/checks/launch_world_p0_gatepack_check.sh`
  - Tracker: `docs/LAUNCH_WORLD_P0_TRACKER.md`

- **sd_755_fix_inboxviewer_node_env_marker:** Restore explicit NODE_ENV/production marker in inboxViewer shim (keeps Next inbox stub safety check green).

## Project Map (keep updated, small)
[Shell]
- Rail: Side switching / navigation
- BottomNav (PWA): primary tabs
- AppShell: layout + safe chrome exclusions

[Content]
- FilterBar: Set pills / context chips
- FeedEngine: feed rendering + caching safety
- PostCard: actions sheets / overflow
- PostDetail: /siddes-post/[id]

[Creation]
- ComposeModal: posting + identity gating
- MediaPicker: local photo/video selection + uploads (sd_757/sd_758) (sd_759)

[Social/Comms]
- Inbox/DMs: threads list + thread view + send/receive + unread
- Notifications: list + mark read

[Identity]
- AuthBootstrap: session bootstrap + me()
- Profile: user pages + actions


- sd_748_inbox_dm_delivery: Inbox DM mirror delivery (two-party messaging)

- **sd_771:** Fix SetPickerSheet `currentSide` wiring for remaining call sites (compose/etc.)

- **sd_773:** Fix auth pages ESLint rules-of-hooks (forgot-password + magic-request) so `next build` succeeds.

- **sd_757_fix_inbox_unread_missing_readstate:** Inbox unread derives inbound-only; missing read-state no longer hides new DMs.

- **sd_776:** Public share post (/p/[id]) — add an escape header (Home/Search/Open in app) + make author profile clickable.
