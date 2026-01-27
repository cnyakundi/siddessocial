# Siddes — Project Map (single source of "where things live")
**Updated:** 2026-01-27

[Shell]
- Rail: Side switching / navigation + Face banner (“Wearing: X”)
- BottomNav (PWA): primary tabs
- AppShell: layout + safe chrome exclusions

[Content]
- FilterBar: Set pills / context chips
- FeedEngine: feed rendering + caching safety
- PostCard: feed card + actions sheets / overflow
- PostDetail: /siddes-post/[id]

[Creation]
- ComposeModal: MVP composer (identity + audience + text + media) + side mismatch guard
- MediaPicker: local photo/video selection + uploads

[Social/Comms]
- Inbox/DMs: threads list + thread view + send/receive + unread
- Notifications: list + mark read

[Identity]
- AuthBootstrap: session bootstrap + me()
- AuthStub (sd_742): localhost stub viewer cookie + MVP hides advanced auth UI (OAuth/reset/magic) until production
- Profile: user pages + actions

## Recent windows
- sd_765_rail_face_banner: Desktop rail shows an always-visible “Wearing: {Side}” face banner (color-coded) so identity is never ambiguous.
- sd_764_authstub_hide_advanced_auth_ui: Hide OAuth + password reset + magic link UI until real production host (override NEXT_PUBLIC_AUTH_ADVANCED=1).
- sd_759: AppTopBar bell opens NotificationsDrawer on mobile (quick alerts)
- sd_756_fix_actions_sheet_backdrop_ghosttap: PostActionsSheet backdrop touchstart now calls preventDefault to stop iOS ghost taps/clickthrough.
- sd_757_fix_setpicker_member_avatars_no_external_calls: SetPickerSheet member preview no longer hits Dicebear; uses deterministic initials badges.
- sd_763_compose_mvp: Compose stripped to MVP defaults (identity + audience + text + media; removed drafts UI / suggestions / quick tools / @mentions).


Notes (Notifications)
- API caching: cache-control: no-store (sd_752)
- sd_758_standardize_sheet_backdrops_touchstart: Standardize sheet backdrops (add onTouchStart preventDefault+close across sheets for consistent dismiss + no weird taps).
- sd_766: Alerts drawer — replace close icon X with ChevronDown (avoid confusion with Alerts bell).

Notes (Feed)
- Flags: frontend/src/lib/flags.ts includes feedModules (NEXT_PUBLIC_SD_FEED_MODULES) (sd_769)
- Flags: frontend/src/lib/flags.ts includes feedModules (NEXT_PUBLIC_SD_FEED_MODULES) (sd_770)
