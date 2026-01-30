# Siddes — Project Map (single source of "where things live")
**Updated:** 2026-01-27

[Shell]
- Rail: Side switching / navigation + clarified nav labels/icons + Face banner (“Wearing: X”)
- BottomNav (PWA): primary tabs (Feed, Alerts, Create, Inbox, Me)
- AppShell: layout + safe chrome exclusions

[Content]
- FilterBar: Circle pills / context chips
- FeedEngine: posts-only chronological feed rendering + caching safety
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
- sd_777_feedengine_posts_only_strip_feed_modules_v3: FeedEngine stripped to posts-only (chronological). Removed feed-modules framework + flag.
- sd_775_feedengine_posts_only_strip_feed_modules: FeedEngine stripped to posts-only (chronological). Removed feed-modules framework + flag.
- sd_771_move_push_settings_to_account_notifications: Alerts feed lives in Inbox → Alerts; push settings moved to Profile → Account → Notifications.
- sd_770_pwa_alerts_drawer_tab: BottomNav Alerts toggles NotificationsDrawer (no navigation), drawer close icon uses ChevronDown.

- sd_769_pwa_topbar_wearing_label: AppTopBar shows a small 'Wearing' label so the active Side (Face) is always explicit on mobile.

- sd_768_pwa_bottomnav_nav_clarity: BottomNav renamed Now → Feed and Inbox icon changed to chat bubble (MessageCircle).

- sd_767_close_side_icon_star: Close Side icon switched Heart → Star (avoid confusion with Likes/Notifications).
- sd_769_alerts_copy_cleanup — Standardize Alerts naming (copy + aria).
- sd_766_rail_iconography_clarity: Desktop rail labels/icons clarified (Now→Feed, Inbox icon reads as chats) + PROJECT_MAP rail line deduped.
- sd_765_rail_face_banner: Desktop rail shows an always-visible “Wearing: {Side}” face banner (color-coded) so identity is never ambiguous.
- sd_764_authstub_hide_advanced_auth_ui: Hide OAuth + password reset + magic link UI until real production host (override NEXT_PUBLIC_AUTH_ADVANCED=1).
- sd_759: AppTopBar bell opens NotificationsDrawer on mobile (quick alerts)
- sd_756_fix_actions_sheet_backdrop_ghosttap: PostActionsSheet backdrop touchstart now calls preventDefault to stop iOS ghost taps/clickthrough.
- sd_757_fix_setpicker_member_avatars_no_external_calls: CirclePickerSheet member preview no longer hits Dicebear; uses deterministic initials badges.
- sd_763_compose_mvp: Compose stripped to MVP defaults (identity + audience + text + media; removed drafts UI / suggestions / quick tools / @mentions).


Notes (Notifications)
- API caching: cache-control: no-store (sd_752)
- sd_758_standardize_sheet_backdrops_touchstart: Standardize sheet backdrops (add onTouchStart preventDefault+close across sheets for consistent dismiss + no weird taps).
- sd_766: Alerts drawer — replace close icon X with ChevronDown (avoid confusion with Alerts bell).

Notes (Feed)
- sd_768_clean_alerts_page_hide_push_debug: Alerts page shows Alerts list first; push tools collapsed into an optional details section.