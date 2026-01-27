# Siddes — Project Map (single source of "where things live")
**Updated:** 2026-01-26

[Shell]
- Rail: Side switching / navigation
- BottomNav (PWA): primary tabs
- AppShell: layout + safe chrome exclusions

[Content]
- FilterBar: Set pills / context chips
- FeedEngine: pure chronological posts (no suggested modules) + caching safety
- PostCard: feed card + actions sheets / overflow
- PostDetail: /siddes-post/[id]

[Creation]
- ComposeModal: posting + identity gating
- MediaPicker: local photo/video selection + uploads

[Social/Comms]
- Inbox/DMs: threads list + thread view + send/receive + unread
- Notifications: list + mark read

[Identity]
- AuthBootstrap: session bootstrap + me()
- Profile: user pages + actions

## Recent windows
- sd_765: Desktop rail — swap Sets → Alerts (make alerts first-class on desktop; Inbox no longer owns notifications)

- sd_764_fix_icon_tap_targets_44px: Improve tap targets for key icon-only controls (TopBar icons, Toast dismiss, tiny remove-X buttons).
- sd_762_feedengine_chrono_strip_modules: Remove injected feed modules so SideFeed is only chronological posts.
- sd_759: AppTopBar bell opens NotificationsDrawer on mobile (quick alerts)
- sd_756_fix_actions_sheet_backdrop_ghosttap: PostActionsSheet backdrop touchstart now calls preventDefault to stop iOS ghost taps/clickthrough.
- sd_757_fix_setpicker_member_avatars_no_external_calls: SetPickerSheet member preview no longer hits Dicebear; uses deterministic initials badges.


Notes (Notifications)
- API caching: cache-control: no-store (sd_752)
- sd_758_standardize_sheet_backdrops_touchstart: Standardize sheet backdrops (add onTouchStart preventDefault+close across sheets for consistent dismiss + no weird taps).

Notes (Inbox/DMs)
- DB store: backend/siddes_inbox/store_db.py (DbInboxStore: ensure_thread + send_message) (sd_766)

Notes (Feed)
- Feed modules framework: frontend/src/lib/feedModules.ts + frontend/src/components/SideFeed.tsx + FeedModuleCard (sd_767)
- Flags: frontend/src/lib/flags.ts includes feedModules (NEXT_PUBLIC_SD_FEED_MODULES) (sd_769)
