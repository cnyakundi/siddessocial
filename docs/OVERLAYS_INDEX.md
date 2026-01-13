# Siddes — Overlays Index
**Updated:** 2026-01-13

Rule: Apply overlays with `scripts/apply_overlay.sh`. The script appends a row automatically.

| Applied (UTC) | Overlay Zip | Summary |
|---|---|---|
| 2026-01-09 06:56:22 | sd_000_docs_docker_testing_hardening_v0.1.2.zip | Summary: Replace placeholder docs/docker files with complete versions + add a standard test harness. |
| 2026-01-09 07:06:09 | sd_001_pwa_app_shell_v0.1.0.zip | PWA app shell (manifest + icons + baseline service worker + install/update banners) |
| 2026-01-09 07:22:49 | sd_002_global_side_state_and_badge_v0.1.0.zip | Global Side state (Public/Friends/Close/Work) + always-available SideBadge across the app. |
| 2026-01-09 07:32:26 | sd_004_feed_and_postcard_spine_v0.1.0.zip | Per-Side feed scaffold + PostCard base with Side spine accent. |
| 2026-01-09 07:37:52 | sd_002_side_provider_autodetect_v0.1.1.zip | Fix SideProvider layout detection by auto-discovering Next.js entrypoints (App Router layout.tsx or Pages _app.tsx). |
| 2026-01-09 07:41:59 | sd_002_side_provider_next_root_discovery_v0.1.2.zip | Auto-discover the actual Next.js frontend root (by package.json with `next`) and patch/check the correct entry file. |
| 2026-01-09 07:43:52 | sd_002_side_provider_next_root_discovery_fix_v0.1.3.zip | Fix Python syntax error in `scripts/find_next_root.py` so Next root auto-discovery works. |
| 2026-01-09 07:46:52 | sd_002_find_next_root_fix_v0.1.4.zip | Fix `scripts/find_next_root.py` syntax so Next.js root discovery works (unblocks SideProvider checks). |
| 2026-01-09 07:53:03 | sd_002_entry_discovery_unblock_v0.1.5.zip | Stop relying on `next` dependency detection; auto-discover Next entry file (layout/_app) directly and patch/check it. |
| 2026-01-09 08:03:44 | sd_000_frontend_next_bootstrap_v0.1.0.zip | Bootstrap a minimal Next.js (App Router) frontend under `frontend/` so Siddes overlays can actually run. |
| 2026-01-09 08:09:29 | sd_005_context_chips_priority_overflow_v0.1.0.zip | Add Context Chips to PostCard (Set/Mention/Doc/Urgent) with max-2 display + tappable +N overflow sheet. |
| 2026-01-09 08:26:23 | sd_006_signals_counter_and_sheet_tabs_v0.1.0.zip | Add Signals counter to PostCard + Signals sheet with tabs (Likes / Echoes / Replies) showing faces list. |
| 2026-01-09 10:53:49 | sd_007_echo_sheet_quote_share_v0.1.0.zip | Add EchoSheet (Echo / Quote Echo / Share externally) and wire the Echo button on PostCard. |
| 2026-01-09 10:56:38 | sd_008_sets_chips_filter_counts_v0.1.0.zip | Add Friends Sets chips row (All / Gym Squad / Weekend Crew / + New Set) with counts + feed filtering. |
| 2026-01-09 11:03:22 | sd_009_import_sheet_guided_set_creation_v0.1.0.zip | Add guided Set creation flow (Import → Select → Name) and wire Friends “New Set” to open it. |
| 2026-01-09 11:13:05 | sd_010_contact_matching_hmac_tokens_v0.1.0.zip | Add privacy-first contact hashing (HMAC tokens) module + matching helpers + full docs + test check. |
| 2026-01-09 11:16:07 | sd_010_contact_hash_pythonpath_fix_v0.1.1.zip | Fix contact hashing demo/test imports by using PYTHONPATH=backend and importing `siddes_contacts.*` (no `backend.` package requirement). |
| 2026-01-09 11:23:25 | sd_011_profile_side_strip_access_gate_v0.1.0.zip | Side-aware Profile view with Side strip + access gating (no private leakage) + demo route `/siddes-profile`. |
| 2026-01-09 11:26:24 | sd_012_notifications_glimpses_v0.1.0.zip | Notifications screen with “glimpses” + filters (All / Mentions / Replies) + demo route `/siddes-notifications`. |
| 2026-01-09 11:30:18 | sd_013_side_peek_longpress_v0.1.0.zip | Long-press Side badge opens Peek sheet with real mock items per Side + 1-tap Reply. |
| 2026-01-09 11:34:51 | sd_013_side_switcher_restore_fix_v0.1.1.zip | Restore missing SideSwitcherSheet component (fix build error: Can't resolve '@/src/components/SideSwitcherSheet'). |
| 2026-01-09 11:43:01 | sd_014_workbox_caching_strategies_v0.1.0.zip | Twitter-grade PWA caching baseline (SW strategies + safe updates) + in-app PWA client (install/update prompts) wired via AppProviders. |
| 2026-01-09 11:47:00 | sd_015_push_notifications_v0.1.0.zip | Web Push scaffolding (client subscribe UI + VAPID key wiring placeholders) + backend docs/spec + test checks. |
| 2026-01-09 11:57:58 | sd_015_push_sw_and_lint_fixes_v0.1.1.zip | Fix SW push handler detection + ensure SW contains push/click handlers + clean ESLint errors (ProfileView apostrophe, SideProvider deps). |
| 2026-01-09 12:02:15 | sd_011_profile_lucide_typing_fix_v0.1.1.zip | Fix TypeScript typecheck errors in ProfileView Side icon mapping (use `LucideIcon` type). |
| 2026-01-09 12:06:06 | sd_011_profile_searchparams_suspense_fix_v0.1.2.zip | Fix Next build error by wrapping useSearchParams() in a Suspense boundary on /siddes-profile. |
| 2026-01-09 12:22:31 | sd_016_offline_post_queue_v0.1.0.zip | Offline post queue (localStorage) + retry-on-online + minimal Compose stub page. |
| 2026-01-09 12:22:48 | sd_017_compose_intent_suggestion_bar_v0.1.0.zip | Compose Intelligence v0 — suggestion bar (Side/Set/Urgent) as you type, tap-to-apply only. |
| 2026-01-09 12:28:21 | sd_018_set_suggestions_after_sync_v0.1.0.zip | Suggested Sets immediately after “Sync Contacts” (Accept / Rename / Skip), with user confirmation (no silent labeling). |
| 2026-01-09 12:38:56 | sd_019_push_vapid_api_stubs_v0.1.0.zip | Add Next.js API stubs for Web Push (GET /api/push/vapid, POST /api/push/subscribe, POST /api/push/unsubscribe) and wire PushSettings to them |
| 2026-01-09 12:43:01 | sd_020_backend_push_models_stub_v0.1.0.zip | Add backend-ready push subscription storage/model sketch + service module stubs (framework-agnostic) + docs + tests. |
| 2026-01-09 12:47:12 | sd_020_push_pythonpath_fix_v0.1.1.zip | Fix push backend demo/test imports by using PYTHONPATH=backend and importing `siddes_push.*` (no `backend.` package requirement). |
| 2026-01-09 12:51:34 | sd_021_backend_contacts_match_endpoint_v0.1.0.zip | Add Django-ready contacts match endpoint stub (privacy-first) using siddes_contacts HMAC tokens + docs + tests. |
| 2026-01-09 12:56:18 | sd_022_compose_intent_v1_refinements_v0.1.0.zip | Refine Compose Intelligence rules + add “why” tooltips + confidence gating + reversible actions. |
| 2026-01-09 13:01:32 | sd_023_side_activity_real_last_seen_v0.1.0.zip | Replace placeholder side activity counts with “new since last visit” driven by LastSeen per Side + feed divider + activity pills computed fr |
| 2026-01-09 13:10:07 | sd_024_deeplinks_and_post_detail_stub_v0.1.0.zip | Add Post Detail page + deep-link stubs from Notifications and Peek to post detail. |
| 2026-01-09 13:15:22 | sd_025_reply_composer_stub_v0.1.0.zip | Add ReplyComposer (bottom sheet) to Post Detail + wire Reply buttons (notifications/peek/detail) to open it. |
| 2026-01-09 13:49:59 | sd_026_backend_post_visibility_enforcement_stub_v0.1.0.zip | Server-side Side visibility rules (stub) + policy module + selftest + docs. |
| 2026-01-09 13:54:30 | sd_027_backend_feed_endpoint_stub_v0.1.0.zip | Backend feed endpoint stub that applies visibility policy + demo selftest + docs. |
| 2026-01-09 13:59:56 | sd_028_backend_post_detail_endpoint_stub_v0.1.0.zip | Backend post detail endpoint stub with visibility check + selftest + docs. |
| 2026-01-09 14:07:17 | sd_029_frontend_feed_from_backend_stub_v0.1.0.zip | Add frontend data source abstraction + optional “backend stub” feed provider behind a flag (keeps UI unchanged). |
| 2026-01-09 14:12:37 | sd_030_frontend_post_detail_from_backend_stub_v0.1.0.zip | Add `/api/post/[id]` route + make Post Detail optionally fetch from API when `NEXT_PUBLIC_FEED_PROVIDER=backend_stub`. |
| 2026-01-09 14:17:29 | sd_031_reply_send_queue_offline_v0.1.0.zip | Offline reply queue (localStorage) + auto-flush on online + UI indicator on post detail. |
| 2026-01-09 14:22:37 | sd_032_thread_stub_reply_render_v0.1.0.zip | Render queued replies under Thread stub on post detail (marked “Queued” until flushed). |
| 2026-01-09 14:28:47 | sd_033_backend_reply_endpoint_stub_v0.1.0.zip | Backend reply endpoint stub with **visibility enforcement** + in-memory reply store + selftest + docs. |
| 2026-01-09 14:39:07 | sd_034_frontend_reply_flush_calls_api_stub_v0.1.0.zip | Add Next API stub for replies (`POST /api/post/[id]/reply`) + teach offline queue flush to call API in backend_stub mode. |
| 2026-01-09 14:51:34 | sd_035_replies_api_store_and_queue_events_v0.1.0.zip | Summary: |
| 2026-01-09 15:00:59 | sd_036_backend_reply_django_route_template_v0.1.0.zip | Add Django Ninja + DRF route templates for replies that call `siddes_reply.create_reply` (with visibility enforcement). |
| 2026-01-09 15:07:02 | sd_037_backend_posts_create_endpoint_stub_v0.1.0.zip | Backend “create post” endpoint stub with **visibility enforcement & idempotency** + in-memory post store + selftest + docs. |
| 2026-01-09 15:11:04 | sd_037_posts_create_id_collision_fix_v0.1.1.zip | Fix flaky idempotency selftest by making PostStore IDs collision-safe (millisecond IDs can collide under fast creates). |
| 2026-01-09 15:18:10 | sd_038_next_api_posts_store_and_feed_merge_v0.1.0.zip | Summary: |
| 2026-01-09 15:31:40 | sd_039_backend_stub_visibility_on_api_feed_v0.1.0.zip | Add basic visibility enforcement to Next API stubs (/api/feed, /api/post/[id]) using a stub viewer cookie to prevent Friends/Close/Work leak |
| 2026-01-09 16:34:34 | sd_040_backend_stub_visibility_on_reply_routes_v0.1.0.zip | Apply stub visibility enforcement to Next reply routes: |
| 2026-01-09 16:59:03 | sd_043_notifications_grouping_v0.1.0.zip | Group notifications by recency (Today / Earlier) and add lightweight dedupe (same actor+type) to reduce noise. |
| 2026-01-09 17:08:24 | sd_045_inbox_stub_v0.1.0.zip | Add Inbox page stub + thread placeholder + Side-aware entry links. |
| 2026-01-09 17:13:38 | sd_046_nav_links_in_shell_v0.1.0.zip | Add a lightweight TopNav (Feed / Compose / Notifs / Inbox / Profile) and render it globally via AppProviders. |
| 2026-01-09 17:18:26 | sd_047_inbox_thread_composer_stub_v0.1.0.zip | Add message composer stub to inbox thread view + local-only message list (per thread) + optional offline queue reuse. |
| 2026-01-09 17:26:58 | sd_048_inbox_mentions_and_side_context_v0.1.0.zip | Add Side context strip + @mention suggestions (stub) to inbox thread header and composer. |
| 2026-01-09 17:34:25 | sd_049_inbox_side_lock_rules_v0.1.0.zip | Prevent accidental cross-Side messaging by “locking” a thread to the Side it was opened in, with a clear warning if user switches Side. |
| 2026-01-09 17:39:26 | sd_049_inbox_mentions_check_compat_fix_v0.1.1.zip | Restore the literal "Context:" string in the inbox thread page so the existing test gate |
| 2026-01-09 18:44:18 | sd_050_inbox_thread_list_badges_v0.1.0.zip | Show locked Side badges + unread hints on the inbox thread list (local-only). |
| 2026-01-10 04:10:58 | sd_051_inbox_unread_state_mark_read_v0.1.0.zip | Persist unread state locally and auto-mark threads read on open. |
| 2026-01-10 04:22:22 | sd_052_inbox_thread_list_real_last_message_and_sort_v0.1.0.zip | Inbox thread list uses real last message + sorts by most recently updated (local-only). |
| 2026-01-10 04:26:39 | sd_053_inbox_thread_list_side_filter_chips_v0.1.0.zip | Adds simple filter chips to the inbox thread list (local-only): |
| 2026-01-10 04:34:23 | sd_054_inbox_thread_list_search_bar_v0.1.0.zip | Adds a small local search bar to the inbox thread list (filters by title + last message). |
| 2026-01-10 04:36:55 | sd_055_inbox_thread_list_keyboard_nav_v0.1.0.zip | Adds keyboard navigation to the inbox thread list (local-only): |
| 2026-01-10 04:39:18 | sd_056_inbox_filter_chips_check_compat_fix_v0.1.1.zip | Fixes failing gate `scripts/checks/inbox_thread_list_filter_chips_check.sh`. |
| 2026-01-10 04:41:27 | sd_057_inbox_thread_list_unread_filter_chip_v0.1.0.zip | Adds an **Unread** filter chip to the inbox thread list (local-only). |
| 2026-01-10 04:48:19 | sd_058_inbox_thread_list_pin_thread_local_v0.1.0.zip | Adds **pin / unpin** for inbox threads (local-only). Pinned threads float to the top. |
| 2026-01-10 04:52:15 | sd_059_inbox_thread_list_context_risk_badge_v0.1.0.zip | Adds a tiny **Context Risk** badge on the inbox thread list when the thread's **locked Side is private** (Close/Work). |
| 2026-01-10 04:56:41 | sd_060_inbox_thread_page_context_risk_strip_v0.1.0.zip | Adds a **Context Risk** warning strip on the inbox *thread page* when the thread is locked to a private Side (Close/Work). |
| 2026-01-10 05:00:30 | sd_061_inbox_unread_state_mark_read_restore_v0.1.1.zip | Restores **auto-mark-read on open** for inbox thread pages. |
| 2026-01-10 05:07:39 | sd_062_inbox_thread_move_confirm_on_privacy_downgrade_v0.1.0.zip | When a thread is locked to a private Side (Close/Work) and you try to **move** it to a less-private Side (Friends/Public), |
| 2026-01-10 05:13:05 | sd_063_inbox_thread_move_to_side_picker_sheet_v0.1.0.zip | Replaces “move to this Side” behavior with a small **Side picker sheet** (local-only), while keeping existing confirm logic. |
| 2026-01-10 05:15:29 | sd_064_inbox_thread_move_sheet_recent_sides_and_smart_default_v0.1.0.zip | Improves the **Move thread** side picker sheet with: |
| 2026-01-10 05:16:48 | sd_065_inbox_move_side_picker_sheet_check_compat_fix_v0.1.1.zip | Fixes failing gate `scripts/checks/inbox_thread_move_side_picker_sheet_check.sh`. |
| 2026-01-10 05:19:35 | sd_066_inbox_move_recents_import_fix_v0.1.1.zip | Fixes TypeScript errors in the inbox thread page by importing move-recents helpers. |
| 2026-01-10 05:21:17 | sd_067_lint_warning_cleanup_hooks_v0.1.0.zip | Cleans up two React hooks lint warnings without changing behavior. |
| 2026-01-10 05:22:25 | sd_068_inbox_thread_list_context_risk_badge_restore_v0.1.1.zip | Restores the inbox thread list **Context Risk** badge (required by `inbox_thread_list_context_risk_badge_check.sh`). |
| 2026-01-10 05:27:21 | sd_069_post_detail_hook_fix_and_check_script_repair_v0.1.1.zip | Summary: |
| 2026-01-10 05:34:31 | sd_070_inbox_thread_move_sheet_copy_tweaks_and_labels_v0.1.0.zip | Microcopy polish for the inbox thread **Move Side** UX — makes “move” feel safer and more reversible (local-only). |
| 2026-01-10 05:52:28 | sd_071_inbox_megapack_stabilize_and_gate_harden_v0.2.0.zip | This is a **big** milestone overlay. It consolidates and stabilizes the Inbox experience and hardens the most brittle gates. |
| 2026-01-10 06:02:18 | sd_072_inbox_backend_stub_provider_pack_v0.2.0.zip | Big pack: Adds an Inbox provider abstraction + Next API routes for inbox threads/messages (backend_stub mode), |
| 2026-01-10 08:36:50 | sd_073_inbox_ui_switch_to_provider_v0.2.0.zip | Big pack: Updates Inbox UI pages to use the new `inboxProvider` when running in `backend_stub` mode. |
| 2026-01-10 08:57:42 | sd_074_inbox_backend_stub_side_filter_and_viewer_debug_panel_v0.2.0.zip | Big pack: Adds query-param support for backend_stub inbox calls (**side** + **viewer**) and a small dev-only debug panel. |
| 2026-01-10 08:58:17 | sd_075_inbox_backend_stub_visibility_rules_pack_v0.2.0.zip | Big pack: upgrades inbox backend-stub visibility from the simplistic `viewer === "me"` rule to a small, deterministic **stub visibility poli |
| 2026-01-10 08:58:39 | sd_076_inbox_backend_stub_seed_more_threads_and_edge_cases_v0.2.0.zip | Big pack: seeds **more inbox threads + edge cases** in the backend-stub in-memory inbox store, and adds a small smoke demo script. |
| 2026-01-10 08:58:57 | sd_077_inbox_backend_stub_pagination_and_cursor_v0.2.0.zip | Big pack: adds simple **cursor pagination** to `/api/inbox/threads` in backend stub mode, while preserving: |
| 2026-01-10 09:04:34 | sd_078_inbox_backend_stub_param_support_and_check_fix_v0.2.1.zip | Fix pack: resolves the persistent failing gate: |
| 2026-01-10 09:10:52 | sd_079_inbox_ui_pass_viewer_side_params_v0.2.1.zip | Fix pack: resolves the failing gate: |
| 2026-01-10 09:16:00 | sd_080_inbox_searchparams_suspense_boundary_fix_v0.2.1.zip | Fix pack: resolves Next.js production build error: |
| 2026-01-10 09:23:40 | sd_081_inbox_ui_infinite_scroll_backend_stub_v0.2.0.zip | Big pack: Inbox list uses backend-stub pagination (`nextCursor`) to load more threads, while preserving: |
| 2026-01-10 09:32:03 | sd_082_inbox_thread_messages_pagination_backend_stub_v0.2.0.zip | Big pack: Adds **message pagination** (“Load earlier”) to inbox thread pages in backend_stub mode. |
| 2026-01-10 09:35:14 | sd_083_inbox_thread_provider_cache_and_stale_revalidate_v0.2.0.zip | Big pack: Adds a small client-side cache for inbox thread fetches (backend_stub), with safe stale-while-revalidate behavior. |
| 2026-01-10 09:44:36 | sd_084_inbox_provider_error_states_and_toasts_v0.2.0.zip | Big pack: Improves UX when backend_stub fetches are restricted or fail: |
| 2026-01-10 09:49:39 | sd_085_dev_next_cache_cleaner_and_remove_require_v0.2.1.zip | Fix pack for two real-world issues seen in your logs: |
| 2026-01-10 09:55:38 | sd_086_inbox_backend_stub_server_unread_hints_v0.2.0.zip | Big pack: Adds **server-side unread hints** in backend-stub inbox threads API to simulate real unread counts. |
| 2026-01-10 10:02:24 | sd_087_inbox_toastbus_and_context_risk_strip_dedupe_v0.2.1.zip | Fix pack for the TypeScript errors you hit: |
| 2026-01-10 10:13:14 | sd_088_inbox_backend_stub_unread_increment_on_new_message_v0.2.0.zip | Big pack: Adds **server-side unread counters** in backend stub mode and increments them on new messages. |
| 2026-01-10 10:17:57 | sd_089_inbox_unread_counter_debug_controls_v0.2.0.zip | Big pack: Adds **debug controls** to the Stub Debug panel to help test unread behavior fast. |
| 2026-01-10 10:19:26 | sd_090_inbox_debug_controls_thread_picker_v0.2.0.zip | Big pack: Improves Stub Debug unread controls by adding a **thread picker** for simulation/reset. |
| 2026-01-10 10:21:39 | sd_091_inbox_debug_panel_hook_order_fix_v0.2.1.zip | Fix pack: resolves ESLint error: |
| 2026-01-10 10:25:59 | sd_092_inbox_debug_controls_live_thread_list_fetch_v0.2.0.zip | Big pack: Debug panel thread picker is now populated from the live stub API. |
| 2026-01-10 10:30:33 | sd_093_inbox_debug_controls_thread_list_search_and_sort_v0.2.0.zip | Big pack: Adds a **search input** for the debug thread picker and sorts options by **recency**. |
| 2026-01-10 10:33:06 | sd_094_inbox_debug_controls_live_thread_list_fetch_with_pagination_v0.2.0.zip | Big pack: Debug panel thread picker fetch now uses **pagination** to load more than 50 threads (when available). |
| 2026-01-10 10:34:36 | sd_095_inbox_backend_stub_side_filter_summary_counts_v0.2.0.zip | Big pack: Adds **per-side summary counts** to the Stub Debug panel so you can instantly see what the current viewer can access. |
| 2026-01-10 10:37:29 | sd_096_inbox_backend_stub_threads_updatedAt_and_title_sync_v0.2.0.zip | Big pack: Improves backend_stub thread list metadata by adding: |
| 2026-01-10 10:40:38 | sd_097_inbox_ui_optional_absolute_time_tooltips_v0.2.0.zip | Big pack: Adds subtle **absolute time tooltips** to inbox thread list time labels when backend_stub provides `updatedAt`. |
| 2026-01-10 10:44:58 | sd_098_inbox_backend_stub_thread_title_sync_from_messages_v0.2.0.zip | Big pack: Makes backend_stub thread titles feel more realistic by deriving a fallback title from messages when a thread's title is generic. |
| 2026-01-10 10:52:19 | sd_099_inbox_remove_no_var_requires_directive_v0.2.1.zip | Fix pack: resolves ESLint error: |
| 2026-01-10 10:56:05 | sd_100_inbox_backend_stub_participant_avatar_seed_v0.2.0.zip | Big pack: Adds stub participant identity fields to backend_stub inbox APIs for richer UI: |
| 2026-01-10 11:01:36 | sd_101_inbox_thread_title_sync_restore_v0.2.1.zip | Fix pack: restores backend_stub thread title sync helpers that a later overlay overwrote. |
| 2026-01-10 11:08:13 | sd_102_inbox_avatar_color_tokens_by_side_v0.2.0.zip | Big pack: Colors the initials avatar bubble by the thread’s **lockedSide** theme tokens (Public/Friends/Close/Work). |
| 2026-01-10 11:15:00 | sd_103_inbox_thread_header_participant_displayname_v0.2.0.zip | Small pack: Thread header prefers participant.displayName (backend_stub), fallback to title. |
| 2026-01-10 11:56:18 | sd_104_inbox_avatar_seed_deterministic_variation_v0.2.0.zip | Add subtle deterministic avatar variation in inbox list + thread header using `participant.avatarSeed` (backend_stub), still tinted by locke |
| 2026-01-10 12:20:45 | sd_105_inbox_restricted_thread_banner_actions_v0.2.0.zip | Make “Restricted thread” banner actionable (Retry as me / Clear viewer / Back to Inbox) and safely disable composer when restricted. |
| 2026-01-10 12:37:35 | sd_106_inbox_backend_contract_doc_v0.2.0.zip | Add an authoritative Inbox backend contract doc (provider ↔ endpoints) so we can swap backend_stub → real Django without rewriting UI. |
| 2026-01-10 12:52:53 | sd_107_inbox_django_app_scaffold_v0.2.0.zip | Scaffold a real-backend-ready `backend/siddes_inbox/` module (models + stub-safe endpoint skeleton + Django template) so we can later move I |
| 2026-01-10 13:12:06 | sd_108_django_project_bootstrap_and_inbox_router_v0.3.0.zip | Bootstrap a minimal Django project under `backend/` (manage.py + settings + urls) and wire a real Ninja API router exposing the Inbox contra |
| 2026-01-10 14:05:39 | sd_109_inbox_django_inmemory_store_seed_v0.3.0.zip | Seed a dev-only in-memory InboxStore behind Django routes + beginner-safe backend test harness. |
| 2026-01-10 15:41:18 | sd_110_docker_port_autofix_and_test_permissions_v0.3.1.zip | Two beginner-hostile footguns showed up: |
| 2026-01-10 16:09:12 | sd_111_inbox_frontend_use_django_api_base_v0.3.1.zip | Purpose: |
| 2026-01-10 17:12:08 | sd_112_preflight_drf_migration_ready_v0.4.0.zip | Preflight guardrails — make overlay checks tolerant so we can switch backend from Django Ninja to Django REST Framework (DRF) without breaki |
| 2026-01-10 17:12:28 | sd_113_drf_migration_replace_ninja_v0.4.0.zip | Replace Django Ninja with Django REST Framework (DRF) for backend /api (Inbox endpoints), and harden beginner tooling. |
| 2026-01-10 17:37:39 | sd_114_inbox_debug_panel_support_django_drf_v0.4.1.zip | Make the Inbox debug panel controls target the **Django DRF** backend when `NEXT_PUBLIC_API_BASE` is configured (and add matching DRF debug  |
| 2026-01-10 17:46:01 | sd_115_inbox_drf_smoke_script_v0.4.2.zip | Add a fast DRF backend smoke test script (healthz + threads + thread payload) to catch breaks in under ~5 seconds. |
| 2026-01-10 18:12:58 | sd_116_viewer_header_and_drf_smoke_fix_v0.4.3.zip | Forward viewer via x-sd-viewer header (no viewer in URLs) and fix the DRF smoke script to match the contract (items + lowercase side). |
| 2026-01-10 18:30:53 | sd_117_backend_deprecate_viewer_query_param_v0.4.4.zip | Deprecate `?viewer=` end-to-end: DRF backend ignores it, dev tooling stops sending it, and docs/checks enforce header/cookie viewer only. |
| 2026-01-10 18:52:56 | sd_118a_drf_auth_skeleton_v0.5.0.zip | DRF auth skeleton: DEV viewer auth (x-sd-viewer/sd_viewer) + production safety guardrails. |
| 2026-01-10 19:01:59 | sd_118a_hotfix_verify_and_smoke_bash32_v0.5.1.zip | Fix verify_overlays wrapper + make DRF smoke test compatible with macOS bash 3.2. |
| 2026-01-10 19:27:05 | sd_118b_drf_throttle_skeleton_v0.5.2.zip | Add DRF throttling skeleton (scoped rate limits) + production guardrails (fail fast on insecure config). |
| 2026-01-10 21:09:42 | sd_119a_inbox_visibility_preflight_smoke_v0.6.0.zip | Add inbox visibility fast-fail + normalize stub viewers to deterministic roles. |
| 2026-01-10 21:10:02 | sd_119b_inbox_visibility_policy_enforcement_v0.6.1.zip | Enforce Inbox visibility in the DRF dev in-memory store so **Close/Work never leak** server-side. |
| 2026-01-11 04:14:47 | sd_120_inbox_visibility_apply_to_next_stub_routes_v0.6.2.zip | Next.js inbox fallback API stubs are now default-safe: ignore ?viewer=, require header/cookie viewer in dev, missing viewer returns restrict |
| 2026-01-11 04:24:58 | sd_121a_inbox_models_and_migrations_scaffold_v0.7.0.zip | Scaffold real Django models + migrations for Inbox (Thread/Message) and register `siddes_inbox` as a Django app (no behavior change yet). |
| 2026-01-11 04:41:49 | sd_120b_inbox_provider_check_marker_sd_viewer_v0.6.4.zip | Fix false-failing inbox_provider_check by making it resolveStubViewer-aware and adding sd_viewer marker comments in Next.js stub routes. |
| 2026-01-11 05:22:30 | sd_121b_inbox_db_store_readonly_v0.7.1.zip | Add a DB-backed InboxStore (Django ORM) behind `SD_INBOX_STORE=db`, keep default store as in-memory. |
| 2026-01-11 06:40:02 | sd_121c_inbox_db_seed_and_switch_v0.7.2.zip | Add deterministic Postgres inbox seeding + one-command `--switch` script, and harden DB mode with the same stub visibility policy (no Close/ |
| 2026-01-11 06:50:30 | sd_121c1_inbox_visibility_enforcement_check_fix_v0.7.3.zip | Fix `scripts/checks/inbox_visibility_enforcement_check.sh` failing after sd_121c by restoring the expected `_role_can_view(...)` shim + call |
| 2026-01-11 07:07:55 | sd_121d_inbox_db_debug_ops_and_dualwrite_v0.7.4.zip | Add DB-mode support for inbox dev debug endpoints (incoming + reset unread) and introduce an optional safe dual-write mode (memory reads, DB |
| 2026-01-11 07:22:10 | sd_121e_inbox_db_unread_per_viewer_scaffold_v0.7.5.zip | Add per-viewer unread state for the Django Postgres inbox store (introduce `InboxThreadReadState`) and stop using `InboxThread.unread_count` |
| 2026-01-11 07:34:22 | sd_121f_inbox_db_unread_cleanup_remove_thread_unread_count_v0.7.6.zip | Remove the deprecated `InboxThread.unread_count` field (unread is per-viewer) and clean up DB store + seeding to never touch it. |
| 2026-01-11 07:44:23 | sd_121g_inbox_hydration_stability_fix_v0.7.7.zip | Fix Next.js hydration errors in the Inbox list by removing `Date.now()` from the initial render path (stable SSR + hydration), then enabling |
| 2026-01-11 07:59:09 | sd_121h_inbox_db_unread_derivation_optional_v0.7.8.zip | Unread is inherently per-viewer. We already track `last_read_ts` in `InboxThreadReadState`, but we were still trusting a cached `unread_coun |
| 2026-01-11 08:07:48 | sd_121i_inbox_db_unread_count_stop_writing_optional_v0.7.9.zip | Add an optional DB-mode flag to **stop writing** `InboxThreadReadState.unread_count`, forcing unread to be derived from `last_read_ts` + mes |
| 2026-01-11 08:30:07 | sd_121j_inbox_db_remove_unread_count_from_read_state_v0.8.0.zip | Remove `InboxThreadReadState.unread_count` from the DB model and rely entirely on **derived unread** from `last_read_ts` + message history. |
| 2026-01-11 08:40:53 | sd_122_inbox_db_cutover_cleanup_v0.8.1.zip |  |
| 2026-01-11 08:55:29 | sd_123_inbox_store_auto_mode_v0.8.2.zip |  |
| 2026-01-11 09:04:09 | sd_124_inbox_db_default_env_example_v0.8.3.zip |  |
| 2026-01-11 09:16:12 | sd_125_inbox_store_quickstart_doc_v0.8.4.zip |  |
| 2026-01-11 09:22:52 | sd_126_migration_pack_link_inbox_db_doc_v0.8.5.zip |  |
| 2026-01-11 09:28:05 | sd_126a_state_doc_include_sd_121i_v0.8.6.zip |  |
| 2026-01-11 09:31:42 | sd_126b_state_doc_include_sd_121h_v0.8.7.zip |  |
| 2026-01-11 09:50:34 | sd_127_api_stub_viewer_gating_v0.8.8.zip | Harden Next API stubs (no ?viewer=; default-safe gating). |
| 2026-01-11 10:30:59 | sd_128_public_channels_foundation_v0.8.9.zip | Public Side channels foundation (tagging + feed filter row + PostCard chip), fully opt-in behind flags. |
| 2026-01-11 10:35:00 | sd_128a_public_channels_typecheck_fix_v0.8.10.zip |  |
| 2026-01-11 11:26:35 | sd_129_public_granular_siding_prefs_v0.9.0.zip | Public Side “Granular Siding” — per-person channel tuning (mute lanes per author), fully opt-in behind Public flags. |
| 2026-01-11 11:47:30 | sd_130_public_trust_dial_mvp_v0.9.1.zip | Public Side “Trust Dial” MVP (Calm / Standard / Arena) — user-controlled feed temperature without an algorithm. Fully opt-in behind Public f |
| 2026-01-11 11:52:46 | sd_130a_public_trust_dial_typecheck_and_lint_fix_v0.9.2.zip |  |
| 2026-01-11 12:12:10 | sd_131_public_slate_pinned_stack_v0.9.3.zip | Public profiles become a *homepage*, not a feed dump. |
| 2026-01-11 12:34:14 | sd_132_public_calm_ui_v0.9.4.zip | Public Visual Calm — hide engagement numbers by default; reveal on hover/tap. Fully opt-in behind `NEXT_PUBLIC_SD_PUBLIC_CALM_UI=1`. |
| 2026-01-11 12:51:39 | sd_133_public_trust_gates_v0.9.5.zip | Adds **Public Trust Gates**: minimal, server-enforced capabilities for Public writes (posts + replies) in the Next.js API stubs. |
| 2026-01-11 12:57:03 | sd_133a_reply_visibility_sd_viewer_gate_fix_v0.9.6.zip | The gate `scripts/checks/reply_visibility_stub_check.sh` asserts that both reply routes contain the literal string `sd_viewer`. |
| 2026-01-11 13:32:01 | sd_134_sets_backend_scaffold_v0.9.7.zip | ```bash |
| 2026-01-11 15:18:27 | sd_135a_sets_provider_interface_v0.9.8.zip | Sets provider interface + hydration-safe loads (still local). |
| 2026-01-11 15:31:22 | sd_135b_sets_api_stubs_v0.9.9.zip | Add Next.js `/api/sets/*` stub endpoints + in-memory server store for Sets (preps server enforcement + history). |
| 2026-01-11 15:47:49 | sd_135c_sets_backend_stub_provider_v0.9.10.zip | Wire Sets `backend_stub` provider to the Next.js `/api/sets/*` stubs. |
| 2026-01-11 16:35:30 | sd_136a_sets_provider_update_and_events_v0.9.11.zip | Extend Sets provider with get/update/events + add a local Sets event log so we can build the history UI next. |
| 2026-01-11 18:10:09 | sd_137a_sets_django_server_enforcement_wiring_v0.9.13.zip | Sets Django server enforcement wiring (DRF router + app install + PATCH CORS). |
| 2026-01-11 18:30:47 | sd_137b_sets_backendstub_use_django_base_fallback_v0.9.14.zip | Frontend Sets backend_stub provider uses NEXT_PUBLIC_API_BASE (Django) with fallback to Next stubs. |
| 2026-01-12 04:33:19 | sd_138a_sets_invites_and_suggestions_base_v0.9.15.zip | Sets Invites scaffold (Django DRF + Next.js stubs) with invite link UI and accept flow. |
| 2026-01-12 04:37:26 | sd_136c_sets_members_parse_regex_fix_v0.9.12a.zip | Fixes an ESLint/TS parser error in Sets pages caused by a multiline regex literal. |
| 2026-01-12 04:55:12 | sd_138b_sets_detail_regex_fix_v0.9.15a.zip | Fixes unterminated regex literal in the Sets detail page member parsing so `next lint` passes. |
| 2026-01-12 05:26:57 | sd_138c_invites_inbox_ui_and_suggestion_prefill_v0.9.16.zip | Adds /siddes-invites page (incoming/outgoing actions), TopNav Invites entry, suggestion prefill in Set invites, and invite accept banners. |
| 2026-01-12 07:49:18 | sd_139a_a_sets_membership_store_db_v0.9.17.zip | Sets DB store now lists/reads Sets for owner OR explicit member; seed only for canonical owner. |
| 2026-01-12 07:49:18 | sd_139a_b_sets_membership_views_check_state_v0.9.17.zip | Sets GET routes are membership-based; adds sd_139a harness check and records milestone in STATE. |
| 2026-01-12 08:13:10 | sd_139b_a_sets_readonly_list_ui_v0.9.18.zip | Adds stubViewerClient helper and makes /siddes-sets hide Create/Import when sd_viewer != me in backend_stub mode. |
| 2026-01-12 08:13:10 | sd_139b_b_sets_readonly_detail_ui_check_state_v0.9.18.zip | Makes /siddes-sets/[id] read-only for non-owners in backend_stub and adds a harness check + STATE update. |
| 2026-01-12 09:06:31 | sd_140a_a_sets_joined_banner_v0.9.19.zip |  |
| 2026-01-12 09:06:31 | sd_140a_b_sets_member_count_invite_text_v0.9.19.zip |  |
| 2026-01-12 09:06:31 | sd_140a_c_sets_joined_ui_check_state_v0.9.19.zip |  |
| 2026-01-12 09:16:41 | sd_139b_c_sets_detail_joined_as_token_fix_v0.9.19a.zip | Fixes scripts/checks/sets_readonly_ui_check.sh which expects the literal string: |
| 2026-01-12 09:42:11 | sd_140b_a_sets_changed_signal_emitters_v0.9.20.zip |  |
| 2026-01-12 09:42:11 | sd_140b_b_sets_listen_auto_refresh_v0.9.20.zip |  |
| 2026-01-12 09:42:11 | sd_140b_c_sets_membership_propagation_check_state_v0.9.20.zip |  |
| 2026-01-12 09:56:23 | sd_140b_d_invites_typecheck_and_lint_fix_v0.9.20a.zip |  |
| 2026-01-12 10:15:54 | sd_141a_a_invites_list_open_set_cta_v0.9.21.zip |  |
| 2026-01-12 10:15:54 | sd_141a_b_invite_accept_open_set_cta_v0.9.21.zip |  |
| 2026-01-12 10:15:54 | sd_141a_c_invites_open_set_check_state_v0.9.21.zip |  |
| 2026-01-12 10:23:32 | sd_140b_e_state_doc_sd_140b_token_fix_v0.9.20b.zip | Patch helper to add missing `sd_140b` mention into docs/STATE.md (fixes sets_membership_propagation_check). |
| 2026-01-12 10:41:09 | sd_141b_a_invites_set_label_resolution_ui_v0.9.22.zip |  |
| 2026-01-12 10:41:09 | sd_141b_b_invites_set_label_check_state_v0.9.22.zip |  |
| 2026-01-12 14:20:34 | sd_141c_a_invites_setlabel_snapshot_backend_v0.9.23.zip | Adds invite set_label field + migration; store outputs setLabel and snapshots Set label on create; views accept direction filter. |
| 2026-01-12 14:20:34 | sd_141c_b_invites_setlabel_snapshot_frontend_core_v0.9.23.zip | Adds SetInvite.setLabel; providers parse/return it; Next stub store snapshots Set label at create-time. |
| 2026-01-12 14:20:34 | sd_141c_c_invites_setlabel_snapshot_ui_check_state_v0.9.23.zip | UI prefers inv.setLabel while keeping hydrateSetLabels/sets.get; adds sd_141c check + updates STATE. |
| 2026-01-12 19:56:49 | sd_tooling_overlay_builder_v0.1.1.zip | Add a local overlay builder script + time-limit playbook so you can package micro-overlays instantly without ChatGPT zip limits. |
| 2026-01-13 06:30:00 | sd_142_feed_drf_api_base_v0.9.24.zip | Feed DRF endpoint + frontend API base fallback. |
| 2026-01-13 05:39:20 | sd_143a_state_readme_manifest_v0.9.25.zip | Posts+Replies DRF endpoints + Next API proxy to Django base; DRF feed returns FeedPost shape + merges runtime posts. |
| 2026-01-13 05:45:14 | sd_143b_state_mentions_sd_142_v0.9.25.zip |  |
| 2026-01-13 06:06:08 | sd_143c_import_cycles_fix_v0.9.25.zip |  |
| 2026-01-13 09:00:36 | sd_144a_posts_django_next_proxy_v0.9.26.zip | Posts+Replies: proxy Next /api/post* to Django when NEXT_PUBLIC_API_BASE is set; move siddes_post under /api; add check; bump STATE to sd_14 |
| 2026-01-13 09:51:33 | sd_144b_docker_compose_warn_cleanup_v0.9.26.zip | Remove obsolete docker-compose version key; add check; document zsh [id] quoting |
| 2026-01-13 10:15:56 | sd_144c_posts_drf_smoke_v0.9.26.zip | Add posts/replies DRF smoke script + workflow docs |
| 2026-01-13 10:56:01 | sd_145a_internal_api_base_v0.9.27.zip | SD_INTERNAL_API_BASE for Docker-safe Next server proxies |
| 2026-01-13 11:19:03 | sd_145b_env_example_restore_v0.9.28.zip | Restore ops/docker/.env.example; ignore .env; align posts smoke base/docs |
| 2026-01-13 12:25:56 | sd_146b_posts_db_wiring_v0.9.30.zip | Wire posts/replies endpoints to SD_POST_STORE; handle post_not_found safely |
| 2026-01-13 12:39:03 | sd_146c_posts_db_persistence_smoke_v0.9.31.zip | Add posts DB persistence smoke test |
