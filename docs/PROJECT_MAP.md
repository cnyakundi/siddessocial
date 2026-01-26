# Siddes — Project Map (single source of "where things live")
**Updated:** 2026-01-26

[Shell]
- Rail: Side switching / navigation
- BottomNav (PWA): primary tabs
- AppShell: layout + safe chrome exclusions

[Content]
- FilterBar: MVP membership-only Set pills (no Search/Trending)
- FeedEngine: feed rendering + caching safety
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
- sd_761_filterbar_pills_mvp: Replace SetFilterBar dropdown/sheet with a horizontal pills row (membership-only).
- sd_759: AppTopBar bell opens NotificationsDrawer on mobile (quick alerts)
- sd_756_fix_actions_sheet_backdrop_ghosttap: PostActionsSheet backdrop touchstart now calls preventDefault to stop iOS ghost taps/clickthrough.
- sd_757_fix_setpicker_member_avatars_no_external_calls: SetPickerSheet member preview no longer hits Dicebear; uses deterministic initials badges.


Notes (Notifications)
- API caching: cache-control: no-store (sd_752)
- sd_758_standardize_sheet_backdrops_touchstart: Standardize sheet backdrops (add onTouchStart preventDefault+close across sheets for consistent dismiss + no weird taps).
