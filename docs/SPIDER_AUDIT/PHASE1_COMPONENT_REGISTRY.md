# Siddes Component Registry (Phase 1: Structural Mapping)

This is a **searchable Table of Contents** for the repo. No logic review, no fixes—just the system’s building blocks and where they live.

Repo root: `/mnt/data/sidesroot/sidesroot`

## Frontend

### Runtime & Global Providers
- **Root layout** — Global Next.js layout for the app shell + providers.  
  _Path:_ `frontend/src/app/layout.tsx`
- **Middleware** — Edge middleware for request handling (e.g., headers/correlation).  
  _Path:_ `frontend/src/middleware.ts`
- **AppProviders** — Global context provider + hook for shared app state.  
  _Path:_ `frontend/src/components/AppProviders.tsx`
- **SideProvider** — Global context provider + hook for shared app state.  
  _Path:_ `frontend/src/components/SideProvider.tsx`
- **AuthBootstrap** — Client bootstrap that handles auth gating + CSRF fetch setup.  
  _Path:_ `frontend/src/components/AuthBootstrap.tsx`
- **AppShell** — Global shell wrapper (top/bottom/rails) around route content.  
  _Path:_ `frontend/src/components/AppShell.tsx`
- **ToastHost** — Toast notification renderer/host.  
  _Path:_ `frontend/src/components/ToastHost.tsx`
- **PwaClient** — PWA service-worker/client integration helper.  
  _Path:_ `frontend/src/components/PwaClient.tsx`
- **QueueIndicator** — UI indicator for offline queue / background actions.  
  _Path:_ `frontend/src/components/QueueIndicator.tsx`
- **StubViewerCookie** — UI component.  
  _Path:_ `frontend/src/components/StubViewerCookie.tsx`
- **FirstRunSidePicker** — UI component.  
  _Path:_ `frontend/src/components/FirstRunSidePicker.tsx`

### Chameleon Plumbing (Side Tokens + Switching)
- **SIDE_THEMES / SIDES** — Canonical Side definitions + Tailwind token map used across UI.  
  _Path:_ `frontend/src/lib/sides.ts`
- **sideStore** — Persistence + cross-tab sync for active Side selection.  
  _Path:_ `frontend/src/lib/sideStore.ts`
- **useSide (SideProvider)** — Global Side Context hook; UI reads active Side from here.  
  _Path:_ `frontend/src/components/SideProvider.tsx`
- **Set theme tokens (SET_THEMES)** — Set color tokens for Set chips/badges.  
  _Path:_ `frontend/src/lib/setThemes.ts`

**How switching works (structural):** Components either (a) call `useSide()` to get the active Side, then (b) look up Tailwind classes via `SIDE_THEMES[side]`, or they receive `side` via props from their parent (e.g., feed → post card).

### Atomic UI Components (Reusable)
All exported UI components under `frontend/src/components/**` with state dependencies (hooks).

- **AppProviders** — Global context provider + hook for shared app state.  
  _State deps:_ —  
  _Path:_ `frontend/src/components/AppProviders.tsx`
- **AppShell** — Global shell wrapper (top/bottom/rails) around route content.  
  _State deps:_ usePathname  
  _Path:_ `frontend/src/components/AppShell.tsx`
- **AppTopBar** — UI component.  
  _State deps:_ useEffect, useSide, useState  
  _Path:_ `frontend/src/components/AppTopBar.tsx`
- **AuthBootstrap** — Client bootstrap that handles auth gating + CSRF fetch setup.  
  _State deps:_ useEffect, usePathname  
  _Path:_ `frontend/src/components/AuthBootstrap.tsx`
- **BottomNav** — Primary navigation/chrome component.  
  _State deps:_ usePathname, useRouter, useSide, useState  
  _Path:_ `frontend/src/components/BottomNav.tsx`
- **ChipOverflowSheet** — Modal/sheet UI surface for user actions and focused workflows.  
  _State deps:_ useEffect  
  _Path:_ `frontend/src/components/ChipOverflowSheet.tsx`
- **ComposeSuggestionBar** — UI component.  
  _State deps:_ useMemo  
  _Path:_ `frontend/src/components/ComposeSuggestionBar.tsx`
- **ContentColumn** — UI component.  
  _State deps:_ —  
  _Path:_ `frontend/src/components/ContentColumn.tsx`
- **CreateSetSheet** — Modal/sheet UI surface for user actions and focused workflows.  
  _State deps:_ useEffect, useMemo, useState  
  _Path:_ `frontend/src/components/CreateSetSheet.tsx`
- **DesktopButlerTray** — UI component.  
  _State deps:_ useEffect, useMemo, useSide, useState  
  _Path:_ `frontend/src/components/DesktopButlerTray.tsx`
- **DesktopRightRail** — Desktop chrome component (rails/top bar).  
  _State deps:_ useEffect, useMemo, useSide, useState  
  _Path:_ `frontend/src/components/DesktopRightRail.tsx`
- **DesktopSearchOverlay** — Desktop search overlay UI.  
  _State deps:_ useEffect, useRef, useRouter, useState  
  _Path:_ `frontend/src/components/DesktopSearchOverlay.tsx`
- **DesktopSideRail** — Desktop chrome component (rails/top bar).  
  _State deps:_ useEffect, usePathname, useSide, useState  
  _Path:_ `frontend/src/components/DesktopSideRail.tsx`
- **DesktopTopBar** — Desktop chrome component (rails/top bar).  
  _State deps:_ useEffect, useMemo, usePathname, useSide, useState  
  _Path:_ `frontend/src/components/DesktopTopBar.tsx`
- **DesktopUserMenu** — Desktop user menu/dropdown.  
  _State deps:_ useEffect  
  _Path:_ `frontend/src/components/DesktopUserMenu.tsx`
- **EchoSheet** — Modal/sheet UI surface for user actions and focused workflows.  
  _State deps:_ useEffect  
  _Path:_ `frontend/src/components/EchoSheet.tsx`
- **EditPostSheet** — Modal/sheet UI surface for user actions and focused workflows.  
  _State deps:_ useEffect, useMemo, useRef, useState  
  _Path:_ `frontend/src/components/EditPostSheet.tsx`
- **FirstRunSidePicker** — UI component.  
  _State deps:_ useCallback, useEffect, useMemo, useSide, useState  
  _Path:_ `frontend/src/components/FirstRunSidePicker.tsx`
- **ImportSetSheet** — Modal/sheet UI surface for user actions and focused workflows.  
  _State deps:_ useMemo, useSide, useState  
  _Path:_ `frontend/src/components/ImportSetSheet.tsx`
- **InboxBanner** — UI component.  
  _State deps:_ —  
  _Path:_ `frontend/src/components/InboxBanner.tsx`
- **InviteActionSheet** — Modal/sheet UI surface for user actions and focused workflows.  
  _State deps:_ useEffect, useMemo, useState  
  _Path:_ `frontend/src/components/Invites/InviteActionSheet.tsx`
- **InviteList** — UI component.  
  _State deps:_ —  
  _Path:_ `frontend/src/components/Invites/InviteList.tsx`
- **MentionPicker** — Mention suggestion picker.  
  _State deps:_ useMemo  
  _Path:_ `frontend/src/components/MentionPicker.tsx`
- **NotificationsView** — Notifications list/panel renderer.  
  _State deps:_ useEffect, useMemo, useRouter, useSide, useState  
  _Path:_ `frontend/src/components/NotificationsView.tsx`
- **PanicBanner** — UI component.  
  _State deps:_ —  
  _Path:_ `frontend/src/components/PanicBanner.tsx`
- **PeekSheet** — Modal/sheet UI surface for user actions and focused workflows.  
  _State deps:_ useEffect, useMemo, useRouter, useState  
  _Path:_ `frontend/src/components/PeekSheet.tsx`
- **PostActionsSheet** — Modal/sheet UI surface for user actions and focused workflows.  
  _State deps:_ useEffect  
  _Path:_ `frontend/src/components/PostActionsSheet.tsx`
- **PostCard** — Feed card renderer for a single post (tap targets, stamps, actions).  
  _State deps:_ useMemo, useRouter, useState  
  _Path:_ `frontend/src/components/PostCard.tsx`
- **CopyLinkButton** — UI component.  
  _State deps:_ useEffect, useMemo, useState  
  _Path:_ `frontend/src/components/PrismProfile.tsx`
- **PublicChannelPrefsSheet** — Modal/sheet UI surface for user actions and focused workflows.  
  _State deps:_ useEffect, useMemo, useState  
  _Path:_ `frontend/src/components/PublicChannelPrefsSheet.tsx`
- **PublicEnterConfirmSheet** — Modal/sheet UI surface for user actions and focused workflows.  
  _State deps:_ useEffect  
  _Path:_ `frontend/src/components/PublicEnterConfirmSheet.tsx`
- **PublicSlate** — UI component.  
  _State deps:_ useEffect, useMemo, useState  
  _Path:_ `frontend/src/components/PublicSlate.tsx`
- **PublicTuneSheet** — Modal/sheet UI surface for user actions and focused workflows.  
  _State deps:_ useEffect  
  _Path:_ `frontend/src/components/PublicTuneSheet.tsx`
- **PwaClient** — PWA service-worker/client integration helper.  
  _State deps:_ useEffect, useMemo, useState  
  _Path:_ `frontend/src/components/PwaClient.tsx`
- **QueueIndicator** — UI indicator for offline queue / background actions.  
  _State deps:_ useEffect, useState  
  _Path:_ `frontend/src/components/QueueIndicator.tsx`
- **QuoteEchoComposer** — Echo/Quote-echo UI flow.  
  _State deps:_ useEffect, useMemo, useState  
  _Path:_ `frontend/src/components/QuoteEchoComposer.tsx`
- **ReplyComposer** — Reply composer UI.  
  _State deps:_ useEffect, useMemo, useState  
  _Path:_ `frontend/src/components/ReplyComposer.tsx`
- **RitualCreateSheet** — Modal/sheet UI surface for user actions and focused workflows.  
  _State deps:_ useEffect, useMemo, useState  
  _Path:_ `frontend/src/components/RitualCreateSheet.tsx`
- **RitualDock** — Ritual UI surface (habit/prompt/ritual workflows).  
  _State deps:_ useEffect, useMemo, useState  
  _Path:_ `frontend/src/components/RitualDock.tsx`
- **RitualSheet** — Modal/sheet UI surface for user actions and focused workflows.  
  _State deps:_ useEffect, useMemo, useState  
  _Path:_ `frontend/src/components/RitualSheet.tsx`
- **SetFilterBar** — Filter bar for selecting Sets / audience contexts.  
  _State deps:_ useMemo, useState  
  _Path:_ `frontend/src/components/SetFilterBar.tsx`
- **SetPickerSheet** — Modal/sheet UI surface for user actions and focused workflows.  
  _State deps:_ useEffect  
  _Path:_ `frontend/src/components/SetPickerSheet.tsx`
- **SetsChipsRow** — UI component.  
  _State deps:_ —  
  _Path:_ `frontend/src/components/SetsChipsRow.tsx`
- **SetsJoinedBanner** — UI component.  
  _State deps:_ —  
  _Path:_ `frontend/src/components/SetsJoinedBanner.tsx`
- **SideBadge** — Compact Side identity badge using chameleon tokens.  
  _State deps:_ useRef, useSide  
  _Path:_ `frontend/src/components/SideBadge.tsx`
- **SideChrome** — Side-aware chrome wrapper (badges, tokens, highlights).  
  _State deps:_ useEffect, useSide, useState  
  _Path:_ `frontend/src/components/SideChrome.tsx`
- **SideFeed** — Feed surface: lists posts/modules and handles scrolling/virtualization.  
  _State deps:_ useCallback, useEffect, useMemo, useRef, useRouter, useSide, useState, useWindowVirtualizer  
  _Path:_ `frontend/src/components/SideFeed.tsx`
- **SideProvider** — Global context provider + hook for shared app state.  
  _State deps:_ useContext, useEffect, useSide, useState  
  _Path:_ `frontend/src/components/SideProvider.tsx`
- **SideSwitcherSheet** — Modal/sheet UI surface for user actions and focused workflows.  
  _State deps:_ useEffect, useState  
  _Path:_ `frontend/src/components/SideSwitcherSheet.tsx`
- **StubViewerCookie** — UI component.  
  _State deps:_ useEffect  
  _Path:_ `frontend/src/components/StubViewerCookie.tsx`
- **SuggestedSetsSheet** — Modal/sheet UI surface for user actions and focused workflows.  
  _State deps:_ useEffect, useMemo, useState  
  _Path:_ `frontend/src/components/SuggestedSetsSheet.tsx`
- **SuggestedSetsTray** — UI component.  
  _State deps:_ useEffect, useMemo, useRef, useState  
  _Path:_ `frontend/src/components/SuggestedSetsTray.tsx`
- **ToastHost** — Toast notification renderer/host.  
  _State deps:_ useEffect, useMemo, useState  
  _Path:_ `frontend/src/components/ToastHost.tsx`
- **TopNav** — Primary navigation/chrome component.  
  _State deps:_ usePathname  
  _Path:_ `frontend/src/components/TopNav.tsx`
- **FeedModuleCard** — Feed surface: lists posts/modules and handles scrolling/virtualization.  
  _State deps:_ —  
  _Path:_ `frontend/src/components/feedModules/FeedModuleCard.tsx`

### Route-Level UI Modules (App Directory, non-page)
- **TelemetryClient** — Route-level UI module used by a page route.  
  _State deps:_ useEffect, useMemo, useState  
  _Path:_ `frontend/src/app/developer/telemetry/telemetryClient.tsx`
- **ComposerStudioClient** — Route-level UI module used by a page route.  
  _State deps:_ useMemo, useState  
  _Path:_ `frontend/src/app/launchpad/composer-studio/studioClient.tsx`
- **SearchPage** — Route-level UI module used by a page route.  
  _State deps:_ useEffect, useMemo, useRouter, useSearchParams, useState  
  _Path:_ `frontend/src/app/search/client.tsx`
- **SiddesComposePage** — Route-level UI module used by a page route.  
  _State deps:_ useEffect, useMemo, useRef, useRouter, useSearchParams, useSide, useState  
  _Path:_ `frontend/src/app/siddes-compose/client.tsx`

### Routes (Pages)
All Next.js App Router pages (`page.tsx`).

- **/** — Route page entrypoint.  
  _Path:_ `frontend/src/app/page.tsx`
- **/about** — Route page entrypoint.  
  _Path:_ `frontend/src/app/about/page.tsx`
- **/account-deletion** — Route page entrypoint.  
  _Path:_ `frontend/src/app/account-deletion/page.tsx`
- **/community-guidelines** — Route page entrypoint.  
  _Path:_ `frontend/src/app/community-guidelines/page.tsx`
- **/confirm-delete** — Route page entrypoint.  
  _Path:_ `frontend/src/app/confirm-delete/page.tsx`
- **/confirm-email-change** — Route page entrypoint.  
  _Path:_ `frontend/src/app/confirm-email-change/page.tsx`
- **/developer** — Route page entrypoint.  
  _Path:_ `frontend/src/app/developer/page.tsx`
- **/developer/telemetry** — Route page entrypoint.  
  _Path:_ `frontend/src/app/developer/telemetry/page.tsx`
- **/forgot-password** — Route page entrypoint.  
  _Path:_ `frontend/src/app/forgot-password/page.tsx`
- **/invite/[id]** — Route page entrypoint.  
  _Path:_ `frontend/src/app/invite/[id]/page.tsx`
- **/launchpad** — Route page entrypoint.  
  _Path:_ `frontend/src/app/launchpad/page.tsx`
- **/launchpad/composer-studio** — Route page entrypoint.  
  _Path:_ `frontend/src/app/launchpad/composer-studio/page.tsx`
- **/legal** — Route page entrypoint.  
  _Path:_ `frontend/src/app/legal/page.tsx`
- **/legal/account-deletion** — Route page entrypoint.  
  _Path:_ `frontend/src/app/legal/account-deletion/page.tsx`
- **/legal/community-guidelines** — Route page entrypoint.  
  _Path:_ `frontend/src/app/legal/community-guidelines/page.tsx`
- **/legal/privacy** — Route page entrypoint.  
  _Path:_ `frontend/src/app/legal/privacy/page.tsx`
- **/legal/terms** — Route page entrypoint.  
  _Path:_ `frontend/src/app/legal/terms/page.tsx`
- **/login** — Route page entrypoint.  
  _Path:_ `frontend/src/app/login/page.tsx`
- **/onboarding** — Route page entrypoint.  
  _Path:_ `frontend/src/app/onboarding/page.tsx`
- **/privacy** — Route page entrypoint.  
  _Path:_ `frontend/src/app/privacy/page.tsx`
- **/reset-password** — Route page entrypoint.  
  _Path:_ `frontend/src/app/reset-password/page.tsx`
- **/search** — Route page entrypoint.  
  _Path:_ `frontend/src/app/search/page.tsx`
- **/siddes-broadcasts** — Route page entrypoint.  
  _Path:_ `frontend/src/app/siddes-broadcasts/page.tsx`
- **/siddes-broadcasts/[id]** — Route page entrypoint.  
  _Path:_ `frontend/src/app/siddes-broadcasts/[id]/page.tsx`
- **/siddes-broadcasts/[id]/compose** — Route page entrypoint.  
  _Path:_ `frontend/src/app/siddes-broadcasts/[id]/compose/page.tsx`
- **/siddes-broadcasts/create** — Route page entrypoint.  
  _Path:_ `frontend/src/app/siddes-broadcasts/create/page.tsx`
- **/siddes-compose** — Route page entrypoint.  
  _Path:_ `frontend/src/app/siddes-compose/page.tsx`
- **/siddes-feed** — Route page entrypoint.  
  _Path:_ `frontend/src/app/siddes-feed/page.tsx`
- **/siddes-inbox** — Route page entrypoint.  
  _Path:_ `frontend/src/app/siddes-inbox/page.tsx`
- **/siddes-inbox/[id]** — Route page entrypoint.  
  _Path:_ `frontend/src/app/siddes-inbox/[id]/page.tsx`
- **/siddes-invites** — Route page entrypoint.  
  _Path:_ `frontend/src/app/siddes-invites/page.tsx`
- **/siddes-moderation** — Route page entrypoint.  
  _Path:_ `frontend/src/app/siddes-moderation/page.tsx`
- **/siddes-moderation/appeals** — Route page entrypoint.  
  _Path:_ `frontend/src/app/siddes-moderation/appeals/page.tsx`
- **/siddes-moderation/audit** — Route page entrypoint.  
  _Path:_ `frontend/src/app/siddes-moderation/audit/page.tsx`
- **/siddes-moderation/stats** — Route page entrypoint.  
  _Path:_ `frontend/src/app/siddes-moderation/stats/page.tsx`
- **/siddes-notifications** — Route page entrypoint.  
  _Path:_ `frontend/src/app/siddes-notifications/page.tsx`
- **/siddes-post/[id]** — Route page entrypoint.  
  _Path:_ `frontend/src/app/siddes-post/[id]/page.tsx`
- **/siddes-profile** — Route page entrypoint.  
  _Path:_ `frontend/src/app/siddes-profile/page.tsx`
- **/siddes-profile/account** — Route page entrypoint.  
  _Path:_ `frontend/src/app/siddes-profile/account/page.tsx`
- **/siddes-profile/account/danger** — Route page entrypoint.  
  _Path:_ `frontend/src/app/siddes-profile/account/danger/page.tsx`
- **/siddes-profile/account/email** — Route page entrypoint.  
  _Path:_ `frontend/src/app/siddes-profile/account/email/page.tsx`
- **/siddes-profile/account/export** — Route page entrypoint.  
  _Path:_ `frontend/src/app/siddes-profile/account/export/page.tsx`
- **/siddes-profile/account/password** — Route page entrypoint.  
  _Path:_ `frontend/src/app/siddes-profile/account/password/page.tsx`
- **/siddes-profile/account/sessions** — Route page entrypoint.  
  _Path:_ `frontend/src/app/siddes-profile/account/sessions/page.tsx`
- **/siddes-sets** — Route page entrypoint.  
  _Path:_ `frontend/src/app/siddes-sets/page.tsx`
- **/siddes-sets/[id]** — Route page entrypoint.  
  _Path:_ `frontend/src/app/siddes-sets/[id]/page.tsx`
- **/siddes-settings** — Route page entrypoint.  
  _Path:_ `frontend/src/app/siddes-settings/page.tsx`
- **/siddes-settings/appeals** — Route page entrypoint.  
  _Path:_ `frontend/src/app/siddes-settings/appeals/page.tsx`
- **/siddes-settings/blocked** — Route page entrypoint.  
  _Path:_ `frontend/src/app/siddes-settings/blocked/page.tsx`
- **/siddes-settings/locality** — Route page entrypoint.  
  _Path:_ `frontend/src/app/siddes-settings/locality/page.tsx`
- **/siddes-settings/muted** — Route page entrypoint.  
  _Path:_ `frontend/src/app/siddes-settings/muted/page.tsx`
- **/signup** — Route page entrypoint.  
  _Path:_ `frontend/src/app/signup/page.tsx`
- **/terms** — Route page entrypoint.  
  _Path:_ `frontend/src/app/terms/page.tsx`
- **/u/[username]** — Route page entrypoint.  
  _Path:_ `frontend/src/app/u/[username]/page.tsx`
- **/verify-email** — Route page entrypoint.  
  _Path:_ `frontend/src/app/verify-email/page.tsx`

### Route Error Boundaries

- **/ (error boundary)** — Route-level error UI.  
  _Path:_ `frontend/src/app/error.tsx`
- **/invite/[id] (error boundary)** — Route-level error UI.  
  _Path:_ `frontend/src/app/invite/[id]/error.tsx`
- **/siddes-feed (error boundary)** — Route-level error UI.  
  _Path:_ `frontend/src/app/siddes-feed/error.tsx`
- **/siddes-inbox (error boundary)** — Route-level error UI.  
  _Path:_ `frontend/src/app/siddes-inbox/error.tsx`
- **/siddes-inbox/[id] (error boundary)** — Route-level error UI.  
  _Path:_ `frontend/src/app/siddes-inbox/[id]/error.tsx`
- **/siddes-invites (error boundary)** — Route-level error UI.  
  _Path:_ `frontend/src/app/siddes-invites/error.tsx`
- **/siddes-post/[id] (error boundary)** — Route-level error UI.  
  _Path:_ `frontend/src/app/siddes-post/[id]/error.tsx`
- **/siddes-sets (error boundary)** — Route-level error UI.  
  _Path:_ `frontend/src/app/siddes-sets/error.tsx`
- **/siddes-sets/[id] (error boundary)** — Route-level error UI.  
  _Path:_ `frontend/src/app/siddes-sets/[id]/error.tsx`

### Next API Layer (Route Handlers)
All Next route handlers (`route.ts`) including `/api/*` and other handler routes.

- **/api/appeals** — Next route handler.  
  _Methods:_ GET, POST  
  _Path:_ `frontend/src/app/api/appeals/route.ts`
- **/api/appeals/[id]** — Next route handler.  
  _Methods:_ PATCH  
  _Path:_ `frontend/src/app/api/appeals/[id]/route.ts`
- **/api/appeals/admin** — Next route handler.  
  _Methods:_ GET  
  _Path:_ `frontend/src/app/api/appeals/admin/route.ts`
- **/api/auth/account/deactivate** — Next route handler.  
  _Methods:_ POST  
  _Path:_ `frontend/src/app/api/auth/account/deactivate/route.ts`
- **/api/auth/account/delete/confirm** — Next route handler.  
  _Methods:_ POST  
  _Path:_ `frontend/src/app/api/auth/account/delete/confirm/route.ts`
- **/api/auth/account/delete/request** — Next route handler.  
  _Methods:_ POST  
  _Path:_ `frontend/src/app/api/auth/account/delete/request/route.ts`
- **/api/auth/age/confirm** — Next route handler.  
  _Methods:_ POST  
  _Path:_ `frontend/src/app/api/auth/age/confirm/route.ts`
- **/api/auth/csrf** — Next route handler.  
  _Methods:_ GET  
  _Path:_ `frontend/src/app/api/auth/csrf/route.ts`
- **/api/auth/email/change/confirm** — Next route handler.  
  _Methods:_ POST  
  _Path:_ `frontend/src/app/api/auth/email/change/confirm/route.ts`
- **/api/auth/email/change/request** — Next route handler.  
  _Methods:_ POST  
  _Path:_ `frontend/src/app/api/auth/email/change/request/route.ts`
- **/api/auth/export** — Next route handler.  
  _Methods:_ GET  
  _Path:_ `frontend/src/app/api/auth/export/route.ts`
- **/api/auth/google** — Next route handler.  
  _Methods:_ POST  
  _Path:_ `frontend/src/app/api/auth/google/route.ts`
- **/api/auth/login** — Next route handler.  
  _Methods:_ POST  
  _Path:_ `frontend/src/app/api/auth/login/route.ts`
- **/api/auth/logout** — Next route handler.  
  _Methods:_ POST  
  _Path:_ `frontend/src/app/api/auth/logout/route.ts`
- **/api/auth/me** — Next route handler.  
  _Methods:_ GET  
  _Path:_ `frontend/src/app/api/auth/me/route.ts`
- **/api/auth/onboarding/complete** — Next route handler.  
  _Methods:_ POST  
  _Path:_ `frontend/src/app/api/auth/onboarding/complete/route.ts`
- **/api/auth/password/change** — Next route handler.  
  _Methods:_ POST  
  _Path:_ `frontend/src/app/api/auth/password/change/route.ts`
- **/api/auth/password/reset/confirm** — Next route handler.  
  _Methods:_ POST  
  _Path:_ `frontend/src/app/api/auth/password/reset/confirm/route.ts`
- **/api/auth/password/reset/request** — Next route handler.  
  _Methods:_ POST  
  _Path:_ `frontend/src/app/api/auth/password/reset/request/route.ts`
- **/api/auth/region** — Next route handler.  
  _Methods:_ GET, POST  
  _Path:_ `frontend/src/app/api/auth/region/route.ts`
- **/api/auth/sessions** — Next route handler.  
  _Methods:_ GET  
  _Path:_ `frontend/src/app/api/auth/sessions/route.ts`
- **/api/auth/sessions/logout_all** — Next route handler.  
  _Methods:_ POST  
  _Path:_ `frontend/src/app/api/auth/sessions/logout_all/route.ts`
- **/api/auth/sessions/revoke** — Next route handler.  
  _Methods:_ POST  
  _Path:_ `frontend/src/app/api/auth/sessions/revoke/route.ts`
- **/api/auth/signup** — Next route handler.  
  _Methods:_ POST  
  _Path:_ `frontend/src/app/api/auth/signup/route.ts`
- **/api/auth/verify/confirm** — Next route handler.  
  _Methods:_ POST  
  _Path:_ `frontend/src/app/api/auth/verify/confirm/route.ts`
- **/api/auth/verify/resend** — Next route handler.  
  _Methods:_ POST  
  _Path:_ `frontend/src/app/api/auth/verify/resend/route.ts`
- **/api/blocks** — Next route handler.  
  _Methods:_ GET, POST  
  _Path:_ `frontend/src/app/api/blocks/route.ts`
- **/api/blocks/[token]** — Next route handler.  
  _Methods:_ DELETE  
  _Path:_ `frontend/src/app/api/blocks/[token]/route.ts`
- **/api/broadcasts** — Next route handler.  
  _Methods:_ GET, POST  
  _Path:_ `frontend/src/app/api/broadcasts/route.ts`
- **/api/broadcasts/[id]** — Next route handler.  
  _Methods:_ GET  
  _Path:_ `frontend/src/app/api/broadcasts/[id]/route.ts`
- **/api/broadcasts/[id]/follow** — Next route handler.  
  _Methods:_ POST  
  _Path:_ `frontend/src/app/api/broadcasts/[id]/follow/route.ts`
- **/api/broadcasts/[id]/notify** — Next route handler.  
  _Methods:_ POST  
  _Path:_ `frontend/src/app/api/broadcasts/[id]/notify/route.ts`
- **/api/broadcasts/[id]/posts** — Next route handler.  
  _Methods:_ GET  
  _Path:_ `frontend/src/app/api/broadcasts/[id]/posts/route.ts`
- **/api/broadcasts/[id]/seen** — Next route handler.  
  _Methods:_ POST  
  _Path:_ `frontend/src/app/api/broadcasts/[id]/seen/route.ts`
- **/api/broadcasts/[id]/unfollow** — Next route handler.  
  _Methods:_ POST  
  _Path:_ `frontend/src/app/api/broadcasts/[id]/unfollow/route.ts`
- **/api/broadcasts/[id]/writers** — Next route handler.  
  _Methods:_ DELETE, GET, POST  
  _Path:_ `frontend/src/app/api/broadcasts/[id]/writers/route.ts`
- **/api/broadcasts/feed** — Next route handler.  
  _Methods:_ GET  
  _Path:_ `frontend/src/app/api/broadcasts/feed/route.ts`
- **/api/broadcasts/unread** — Next route handler.  
  _Methods:_ GET  
  _Path:_ `frontend/src/app/api/broadcasts/unread/route.ts`
- **/api/contacts/match** — Next route handler.  
  _Methods:_ POST  
  _Path:_ `frontend/src/app/api/contacts/match/route.ts`
- **/api/contacts/suggestions** — Next route handler.  
  _Methods:_ GET  
  _Path:_ `frontend/src/app/api/contacts/suggestions/route.ts`
- **/api/feed** — Next route handler.  
  _Methods:_ GET  
  _Path:_ `frontend/src/app/api/feed/route.ts`
- **/api/health** — Next route handler.  
  _Methods:_ GET  
  _Path:_ `frontend/src/app/api/health/route.ts`
- **/api/inbox/debug/incoming** — Next route handler.  
  _Methods:_ POST  
  _Path:_ `frontend/src/app/api/inbox/debug/incoming/route.ts`
- **/api/inbox/debug/unread/reset** — Next route handler.  
  _Methods:_ POST  
  _Path:_ `frontend/src/app/api/inbox/debug/unread/reset/route.ts`
- **/api/inbox/thread/[id]** — Next route handler.  
  _Methods:_ GET, POST  
  _Path:_ `frontend/src/app/api/inbox/thread/[id]/route.ts`
- **/api/inbox/threads** — Next route handler.  
  _Methods:_ GET  
  _Path:_ `frontend/src/app/api/inbox/threads/route.ts`
- **/api/invites** — Next route handler.  
  _Methods:_ GET, POST  
  _Path:_ `frontend/src/app/api/invites/route.ts`
- **/api/invites/[id]** — Next route handler.  
  _Methods:_ GET, PATCH  
  _Path:_ `frontend/src/app/api/invites/[id]/route.ts`
- **/api/ml/suggestions** — Next route handler.  
  _Methods:_ GET  
  _Path:_ `frontend/src/app/api/ml/suggestions/route.ts`
- **/api/ml/suggestions/[id]/[action]** — Next route handler.  
  _Methods:_ POST  
  _Path:_ `frontend/src/app/api/ml/suggestions/[id]/[action]/route.ts`
- **/api/moderation/audit** — Next route handler.  
  _Methods:_ GET  
  _Path:_ `frontend/src/app/api/moderation/audit/route.ts`
- **/api/moderation/audit/export** — Next route handler.  
  _Methods:_ GET  
  _Path:_ `frontend/src/app/api/moderation/audit/export/route.ts`
- **/api/moderation/posts/[id]** — Next route handler.  
  _Methods:_ PATCH  
  _Path:_ `frontend/src/app/api/moderation/posts/[id]/route.ts`
- **/api/moderation/stats** — Next route handler.  
  _Methods:_ GET  
  _Path:_ `frontend/src/app/api/moderation/stats/route.ts`
- **/api/moderation/stats/export** — Next route handler.  
  _Methods:_ GET  
  _Path:_ `frontend/src/app/api/moderation/stats/export/route.ts`
- **/api/moderation/users/state** — Next route handler.  
  _Methods:_ POST  
  _Path:_ `frontend/src/app/api/moderation/users/state/route.ts`
- **/api/mutes** — Next route handler.  
  _Methods:_ GET, POST  
  _Path:_ `frontend/src/app/api/mutes/route.ts`
- **/api/mutes/[token]** — Next route handler.  
  _Methods:_ DELETE  
  _Path:_ `frontend/src/app/api/mutes/[token]/route.ts`
- **/api/notifications** — Next route handler.  
  _Methods:_ GET  
  _Path:_ `frontend/src/app/api/notifications/route.ts`
- **/api/notifications/mark-all-read** — Next route handler.  
  _Methods:_ POST  
  _Path:_ `frontend/src/app/api/notifications/mark-all-read/route.ts`
- **/api/post** — Next route handler.  
  _Methods:_ POST  
  _Path:_ `frontend/src/app/api/post/route.ts`
- **/api/post/[id]** — Next route handler.  
  _Methods:_ DELETE, GET, PATCH  
  _Path:_ `frontend/src/app/api/post/[id]/route.ts`
- **/api/post/[id]/echo** — Next route handler.  
  _Methods:_ DELETE, POST  
  _Path:_ `frontend/src/app/api/post/[id]/echo/route.ts`
- **/api/post/[id]/like** — Next route handler.  
  _Methods:_ DELETE, POST  
  _Path:_ `frontend/src/app/api/post/[id]/like/route.ts`
- **/api/post/[id]/quote** — Next route handler.  
  _Methods:_ POST  
  _Path:_ `frontend/src/app/api/post/[id]/quote/route.ts`
- **/api/post/[id]/replies** — Next route handler.  
  _Methods:_ GET  
  _Path:_ `frontend/src/app/api/post/[id]/replies/route.ts`
- **/api/post/[id]/reply** — Next route handler.  
  _Methods:_ POST  
  _Path:_ `frontend/src/app/api/post/[id]/reply/route.ts`
- **/api/prism** — Next route handler.  
  _Methods:_ GET, PATCH  
  _Path:_ `frontend/src/app/api/prism/route.ts`
- **/api/profile/[username]** — Next route handler.  
  _Methods:_ GET  
  _Path:_ `frontend/src/app/api/profile/[username]/route.ts`
- **/api/reports** — Next route handler.  
  _Methods:_ POST  
  _Path:_ `frontend/src/app/api/reports/route.ts`
- **/api/reports/[id]** — Next route handler.  
  _Methods:_ PATCH  
  _Path:_ `frontend/src/app/api/reports/[id]/route.ts`
- **/api/reports/admin** — Next route handler.  
  _Methods:_ GET  
  _Path:_ `frontend/src/app/api/reports/admin/route.ts`
- **/api/reports/admin/export** — Next route handler.  
  _Methods:_ GET  
  _Path:_ `frontend/src/app/api/reports/admin/export/route.ts`
- **/api/rituals** — Next route handler.  
  _Methods:_ GET, POST  
  _Path:_ `frontend/src/app/api/rituals/route.ts`
- **/api/rituals/[id]** — Next route handler.  
  _Methods:_ GET  
  _Path:_ `frontend/src/app/api/rituals/[id]/route.ts`
- **/api/rituals/[id]/ignite** — Next route handler.  
  _Methods:_ POST  
  _Path:_ `frontend/src/app/api/rituals/[id]/ignite/route.ts`
- **/api/rituals/[id]/respond** — Next route handler.  
  _Methods:_ POST  
  _Path:_ `frontend/src/app/api/rituals/[id]/respond/route.ts`
- **/api/rituals/[id]/responses** — Next route handler.  
  _Methods:_ GET  
  _Path:_ `frontend/src/app/api/rituals/[id]/responses/route.ts`
- **/api/search/posts** — Next route handler.  
  _Methods:_ GET  
  _Path:_ `frontend/src/app/api/search/posts/route.ts`
- **/api/search/users** — Next route handler.  
  _Methods:_ GET  
  _Path:_ `frontend/src/app/api/search/users/route.ts`
- **/api/sets** — Next route handler.  
  _Methods:_ GET, POST  
  _Path:_ `frontend/src/app/api/sets/route.ts`
- **/api/sets/[id]** — Next route handler.  
  _Methods:_ DELETE, GET, PATCH  
  _Path:_ `frontend/src/app/api/sets/[id]/route.ts`
- **/api/sets/[id]/events** — Next route handler.  
  _Methods:_ GET  
  _Path:_ `frontend/src/app/api/sets/[id]/events/route.ts`
- **/api/side** — Next route handler.  
  _Methods:_ POST  
  _Path:_ `frontend/src/app/api/side/route.ts`
- **/api/slate** — Next route handler.  
  _Methods:_ GET  
  _Path:_ `frontend/src/app/api/slate/route.ts`
- **/api/telemetry** — Next route handler.  
  _Methods:_ GET, POST  
  _Path:_ `frontend/src/app/api/telemetry/route.ts`
- **/api/users/[username]** — Next route handler.  
  _Methods:_ GET  
  _Path:_ `frontend/src/app/api/users/[username]/route.ts`
- **/api/users/[username]/posts** — Next route handler.  
  _Methods:_ GET  
  _Path:_ `frontend/src/app/api/users/[username]/posts/route.ts`
- **/m/[...key]** — Next route handler.  
  _Methods:_ GET  
  _Path:_ `frontend/src/app/m/[...key]/route.ts`

### Client Service Files (Frontend /lib)
Service modules that call `/api/*` (and related request helpers).

- **authMe.ts** — Client request/service module.  
  _Path:_ `frontend/src/lib/authMe.ts`
- **csrf.ts** — Client request/service module.  
  _Path:_ `frontend/src/lib/csrf.ts`
- **backendStub.ts** — Client request/service module.  
  _Path:_ `frontend/src/lib/feedProviders/backendStub.ts`
- **backendStub.ts** — Client request/service module.  
  _Path:_ `frontend/src/lib/inboxProviders/backendStub.ts`
- **backendStub.ts** — Client request/service module.  
  _Path:_ `frontend/src/lib/inviteProviders/backendStub.ts`
- **inviteSuggestions.ts** — Client request/service module.  
  _Path:_ `frontend/src/lib/inviteSuggestions.ts`
- **mediaClient.ts** — Client request/service module.  
  _Path:_ `frontend/src/lib/mediaClient.ts`
- **offlineQueue.ts** — Client request/service module.  
  _Path:_ `frontend/src/lib/offlineQueue.ts`
- **backendStub.ts** — Client request/service module.  
  _Path:_ `frontend/src/lib/ritualsProviders/backendStub.ts`
- **backendStub.ts** — Client request/service module.  
  _Path:_ `frontend/src/lib/setsProviders/backendStub.ts`
- **sideActivity.ts** — Client request/service module.  
  _Path:_ `frontend/src/lib/sideActivity.ts`
- **sdTelemetry.ts** — Client request/service module.  
  _Path:_ `frontend/src/lib/telemetry/sdTelemetry.ts`

### Interaction Map (Routing + Guardrails)
- **Feed → PostDetail navigation** — `PostCard` and `NotificationsView` push to `/siddes-post/[id]`.  
  _Paths:_ `frontend/src/components/PostCard.tsx`, `frontend/src/components/NotificationsView.tsx`
- **PostDetail route** — Dynamic route page for viewing post + replies.  
  _Path:_ `frontend/src/app/siddes-post/[id]/page.tsx`
- **Auth guardrails** — Protected-route gating logic for `/siddes-*` routes.  
  _Path:_ `frontend/src/components/AuthBootstrap.tsx`
- **Cross-side guardrails (UI)** — PostDetail and other pages use Side tokens and side checks to present side-mismatch UX.  
  _Path:_ `frontend/src/app/siddes-post/[id]/page.tsx`

### Third-Party Tissue (Frontend)
External dependencies and where they hook into the system.

- **lucide-react** — Dependency.  
  _Hook points:_ 62 file(s) import it (see registry JSON for full list).  

- **@tanstack/react-virtual** — Dependency.  
  _Hook points:_ 1 file(s) import it (see registry JSON for full list).  

- **tailwindcss / postcss / autoprefixer** — Styling pipeline.  
  _Hook points:_ `frontend/tailwind.config.ts`, `frontend/postcss.config.js`, `frontend/src/app/globals.css`

- **next/navigation, next/link** — Routing primitives used throughout pages/components.  
  _Hook points:_ imported across `frontend/src/app/**` and `frontend/src/components/**`


## Backend

### Core Runtime
- **Django project settings** — global configuration, installed apps, DB/cache.  
  _Path:_ `backend/siddes_backend/settings.py`
- **Root URL router** — mounts `/api/` and other top-level routes.  
  _Path:_ `backend/siddes_backend/urls.py`
- **API root** — includes all app URLConfs under `/api/*`.  
  _Path:_ `backend/siddes_backend/api.py`
- **WSGI server config** — production server configuration.  
  _Path:_ `backend/gunicorn.conf.py`

### Django Apps (Domain Modules)
- **siddes_auth** — Backend domain module.  
  _Key files:_ `backend/siddes_auth/urls.py`, `backend/siddes_auth/views.py`, `backend/siddes_auth/models.py`
- **siddes_backend** — Backend domain module.  
  _Key files:_ `backend/siddes_backend/urls.py`, `backend/siddes_backend/views.py`
- **siddes_broadcasts** — Backend domain module.  
  _Key files:_ `backend/siddes_broadcasts/urls.py`, `backend/siddes_broadcasts/views.py`, `backend/siddes_broadcasts/models.py`, `backend/siddes_broadcasts/admin.py`
- **siddes_contacts** — Backend domain module.  
  _Key files:_ `backend/siddes_contacts/urls.py`, `backend/siddes_contacts/views.py`, `backend/siddes_contacts/models.py`
- **siddes_feed** — Backend domain module.  
  _Key files:_ `backend/siddes_feed/urls.py`, `backend/siddes_feed/views.py`
- **siddes_inbox** — Backend domain module.  
  _Key files:_ `backend/siddes_inbox/urls.py`, `backend/siddes_inbox/views.py`, `backend/siddes_inbox/models.py`
- **siddes_invites** — Backend domain module.  
  _Key files:_ `backend/siddes_invites/urls.py`, `backend/siddes_invites/views.py`, `backend/siddes_invites/models.py`
- **siddes_media** — Backend domain module.  
  _Key files:_ `backend/siddes_media/urls.py`, `backend/siddes_media/views.py`, `backend/siddes_media/models.py`
- **siddes_ml** — Backend domain module.  
  _Key files:_ `backend/siddes_ml/urls.py`, `backend/siddes_ml/views.py`, `backend/siddes_ml/models.py`
- **siddes_notifications** — Backend domain module.  
  _Key files:_ `backend/siddes_notifications/urls.py`, `backend/siddes_notifications/views.py`, `backend/siddes_notifications/models.py`
- **siddes_post** — Backend domain module.  
  _Key files:_ `backend/siddes_post/urls.py`, `backend/siddes_post/views.py`, `backend/siddes_post/models.py`, `backend/siddes_post/admin.py`
- **siddes_posts** — Backend domain module.  
  _Path:_ `backend/siddes_posts/`
- **siddes_prism** — Backend domain module.  
  _Key files:_ `backend/siddes_prism/urls.py`, `backend/siddes_prism/views.py`, `backend/siddes_prism/models.py`, `backend/siddes_prism/admin.py`
- **siddes_push** — Backend domain module.  
  _Path:_ `backend/siddes_push/`
- **siddes_reply** — Backend domain module.  
  _Path:_ `backend/siddes_reply/`
- **siddes_rituals** — Backend domain module.  
  _Key files:_ `backend/siddes_rituals/urls.py`, `backend/siddes_rituals/views.py`, `backend/siddes_rituals/models.py`
- **siddes_safety** — Backend domain module.  
  _Key files:_ `backend/siddes_safety/urls.py`, `backend/siddes_safety/views.py`, `backend/siddes_safety/models.py`
- **siddes_search** — Backend domain module.  
  _Key files:_ `backend/siddes_search/urls.py`, `backend/siddes_search/views.py`
- **siddes_sets** — Backend domain module.  
  _Key files:_ `backend/siddes_sets/urls.py`, `backend/siddes_sets/views.py`, `backend/siddes_sets/models.py`
- **siddes_slate** — Backend domain module.  
  _Key files:_ `backend/siddes_slate/urls.py`, `backend/siddes_slate/views.py`, `backend/siddes_slate/models.py`
- **siddes_telemetry** — Backend domain module.  
  _Key files:_ `backend/siddes_telemetry/urls.py`, `backend/siddes_telemetry/views.py`, `backend/siddes_telemetry/models.py`
- **siddes_visibility** — Backend domain module.  
  _Path:_ `backend/siddes_visibility/`

### Backend API Endpoint Registry (DRF)
All URL patterns included under `/api/` (pattern + view class/function + urls file).

- **/api/inbox/threads** — InboxThreadsView.as_view(  
  _Path:_ `backend/siddes_inbox/urls.py`
- **/api/inbox/thread/<str:thread_id>** — InboxThreadView.as_view(  
  _Path:_ `backend/siddes_inbox/urls.py`
- **/api/inbox/debug/unread/reset** — InboxDebugResetUnreadView.as_view(  
  _Path:_ `backend/siddes_inbox/urls.py`
- **/api/inbox/debug/incoming** — InboxDebugIncomingView.as_view(  
  _Path:_ `backend/siddes_inbox/urls.py`
- **/api/auth/signup** — SignupView.as_view(  
  _Path:_ `backend/siddes_auth/urls.py`
- **/api/auth/login** — LoginView.as_view(  
  _Path:_ `backend/siddes_auth/urls.py`
- **/api/auth/logout** — LogoutView.as_view(  
  _Path:_ `backend/siddes_auth/urls.py`
- **/api/auth/me** — MeView.as_view(  
  _Path:_ `backend/siddes_auth/urls.py`
- **/api/auth/region** — RegionView.as_view(  
  _Path:_ `backend/siddes_auth/urls.py`
- **/api/auth/age/confirm** — AgeGateConfirmView.as_view(  
  _Path:_ `backend/siddes_auth/urls.py`
- **/api/auth/verify/confirm** — VerifyConfirmView.as_view(  
  _Path:_ `backend/siddes_auth/urls.py`
- **/api/auth/verify/resend** — VerifyResendView.as_view(  
  _Path:_ `backend/siddes_auth/urls.py`
- **/api/auth/google** — GoogleAuthView.as_view(  
  _Path:_ `backend/siddes_auth/urls.py`
- **/api/auth/onboarding/complete** — OnboardingCompleteView.as_view(  
  _Path:_ `backend/siddes_auth/urls.py`
- **/api/auth/password/reset/request** — PasswordResetRequestView.as_view(  
  _Path:_ `backend/siddes_auth/urls.py`
- **/api/auth/password/reset/confirm** — PasswordResetConfirmView.as_view(  
  _Path:_ `backend/siddes_auth/urls.py`
- **/api/auth/password/change** — PasswordChangeView.as_view(  
  _Path:_ `backend/siddes_auth/urls.py`
- **/api/auth/sessions** — SessionsListView.as_view(  
  _Path:_ `backend/siddes_auth/urls.py`
- **/api/auth/sessions/revoke** — SessionsRevokeView.as_view(  
  _Path:_ `backend/siddes_auth/urls.py`
- **/api/auth/sessions/logout_all** — SessionsLogoutAllView.as_view(  
  _Path:_ `backend/siddes_auth/urls.py`
- **/api/auth/email/change/request** — EmailChangeRequestView.as_view(  
  _Path:_ `backend/siddes_auth/urls.py`
- **/api/auth/email/change/confirm** — EmailChangeConfirmView.as_view(  
  _Path:_ `backend/siddes_auth/urls.py`
- **/api/auth/account/deactivate** — AccountDeactivateView.as_view(  
  _Path:_ `backend/siddes_auth/urls.py`
- **/api/auth/account/delete/request** — AccountDeleteRequestView.as_view(  
  _Path:_ `backend/siddes_auth/urls.py`
- **/api/auth/account/delete/confirm** — AccountDeleteConfirmView.as_view(  
  _Path:_ `backend/siddes_auth/urls.py`
- **/api/auth/export** — ExportDataView.as_view(  
  _Path:_ `backend/siddes_auth/urls.py`
- **/api/contacts/match** — ContactsMatchView.as_view(  
  _Path:_ `backend/siddes_contacts/urls.py`
- **/api/contacts/suggestions** — ContactsSuggestionsView.as_view(  
  _Path:_ `backend/siddes_contacts/urls.py`
- **/api/broadcasts** — BroadcastsView.as_view(  
  _Path:_ `backend/siddes_broadcasts/urls.py`
- **/api/broadcasts/feed** — BroadcastFeedView.as_view(  
  _Path:_ `backend/siddes_broadcasts/urls.py`
- **/api/broadcasts/unread** — BroadcastUnreadView.as_view(  
  _Path:_ `backend/siddes_broadcasts/urls.py`
- **/api/broadcasts/<str:broadcast_id>** — BroadcastDetailView.as_view(  
  _Path:_ `backend/siddes_broadcasts/urls.py`
- **/api/broadcasts/<str:broadcast_id>/follow** — BroadcastFollowView.as_view(  
  _Path:_ `backend/siddes_broadcasts/urls.py`
- **/api/broadcasts/<str:broadcast_id>/unfollow** — BroadcastUnfollowView.as_view(  
  _Path:_ `backend/siddes_broadcasts/urls.py`
- **/api/broadcasts/<str:broadcast_id>/notify** — BroadcastNotifyView.as_view(  
  _Path:_ `backend/siddes_broadcasts/urls.py`
- **/api/broadcasts/<str:broadcast_id>/seen** — BroadcastSeenView.as_view(  
  _Path:_ `backend/siddes_broadcasts/urls.py`
- **/api/broadcasts/<str:broadcast_id>/writers** — BroadcastWritersView.as_view(  
  _Path:_ `backend/siddes_broadcasts/urls.py`
- **/api/broadcasts/<str:broadcast_id>/posts** — BroadcastPostsView.as_view(  
  _Path:_ `backend/siddes_broadcasts/urls.py`
- **/api/sets** — SetsView.as_view(  
  _Path:_ `backend/siddes_sets/urls.py`
- **/api/sets/<str:set_id>** — SetDetailView.as_view(  
  _Path:_ `backend/siddes_sets/urls.py`
- **/api/sets/<str:set_id>/events** — SetEventsView.as_view(  
  _Path:_ `backend/siddes_sets/urls.py`
- **/api/invites** — InvitesView.as_view(  
  _Path:_ `backend/siddes_invites/urls.py`
- **/api/invites/<str:invite_id>** — InviteDetailView.as_view(  
  _Path:_ `backend/siddes_invites/urls.py`
- **/api/blocks** — BlocksView.as_view(  
  _Path:_ `backend/siddes_safety/urls.py`
- **/api/blocks/<path:token>** — BlockDeleteView.as_view(  
  _Path:_ `backend/siddes_safety/urls.py`
- **/api/mutes** — MutesView.as_view(  
  _Path:_ `backend/siddes_safety/urls.py`
- **/api/mutes/<path:token>** — MuteDeleteView.as_view(  
  _Path:_ `backend/siddes_safety/urls.py`
- **/api/reports** — ReportsCreateView.as_view(  
  _Path:_ `backend/siddes_safety/urls.py`
- **/api/appeals** — AppealsView.as_view(  
  _Path:_ `backend/siddes_safety/urls.py`
- **/api/reports/admin** — ReportsAdminListView.as_view(  
  _Path:_ `backend/siddes_safety/urls.py`
- **/api/reports/admin/export** — ReportsAdminExportView.as_view(  
  _Path:_ `backend/siddes_safety/urls.py`
- **/api/reports/<int:pk>** — ReportAdminUpdateView.as_view(  
  _Path:_ `backend/siddes_safety/urls.py`
- **/api/appeals/admin** — AppealsAdminListView.as_view(  
  _Path:_ `backend/siddes_safety/urls.py`
- **/api/appeals/<int:pk>** — AppealAdminUpdateView.as_view(  
  _Path:_ `backend/siddes_safety/urls.py`
- **/api/moderation/posts/<str:post_id>** — ModerationPostUpdateView.as_view(  
  _Path:_ `backend/siddes_safety/urls.py`
- **/api/moderation/users/state** — ModerationUserStateView.as_view(  
  _Path:_ `backend/siddes_safety/urls.py`
- **/api/moderation/stats** — ModerationStatsView.as_view(  
  _Path:_ `backend/siddes_safety/urls.py`
- **/api/moderation/stats/export** — ModerationStatsExportView.as_view(  
  _Path:_ `backend/siddes_safety/urls.py`
- **/api/moderation/audit** — ModerationAuditListView.as_view(  
  _Path:_ `backend/siddes_safety/urls.py`
- **/api/moderation/audit/export** — ModerationAuditExportView.as_view(  
  _Path:_ `backend/siddes_safety/urls.py`
- **/api/feed** — FeedView.as_view(  
  _Path:_ `backend/siddes_feed/urls.py`
- **/api/slate** — PublicSlateListView.as_view(  
  _Path:_ `backend/siddes_slate/urls.py`
- **/api/notifications** — NotificationsListView.as_view(  
  _Path:_ `backend/siddes_notifications/urls.py`
- **/api/notifications/mark-all-read** — NotificationsMarkAllReadView.as_view(  
  _Path:_ `backend/siddes_notifications/urls.py`
- **/api/rituals** — RitualsView.as_view(  
  _Path:_ `backend/siddes_rituals/urls.py`
- **/api/rituals/<str:ritual_id>** — RitualDetailView.as_view(  
  _Path:_ `backend/siddes_rituals/urls.py`
- **/api/rituals/<str:ritual_id>/ignite** — RitualIgniteView.as_view(  
  _Path:_ `backend/siddes_rituals/urls.py`
- **/api/rituals/<str:ritual_id>/respond** — RitualRespondView.as_view(  
  _Path:_ `backend/siddes_rituals/urls.py`
- **/api/rituals/<str:ritual_id>/responses** — RitualResponsesView.as_view(  
  _Path:_ `backend/siddes_rituals/urls.py`
- **/api/post** — PostCreateView.as_view(  
  _Path:_ `backend/siddes_post/urls.py`
- **/api/post/<str:post_id>** — PostDetailView.as_view(  
  _Path:_ `backend/siddes_post/urls.py`
- **/api/post/<str:post_id>/replies** — PostRepliesView.as_view(  
  _Path:_ `backend/siddes_post/urls.py`
- **/api/post/<str:post_id>/reply** — PostReplyCreateView.as_view(  
  _Path:_ `backend/siddes_post/urls.py`
- **/api/post/<str:post_id>/like** — PostLikeView.as_view(  
  _Path:_ `backend/siddes_post/urls.py`
- **/api/post/<str:post_id>/echo** — PostEchoView.as_view(  
  _Path:_ `backend/siddes_post/urls.py`
- **/api/post/<str:post_id>/quote** — PostQuoteEchoView.as_view(  
  _Path:_ `backend/siddes_post/urls.py`
- **/api/ml/suggestions** — MlSuggestionsView.as_view(  
  _Path:_ `backend/siddes_ml/urls.py`
- **/api/ml/suggestions/<str:suggestion_id>/<str:action>** — MlSuggestionActionView.as_view(  
  _Path:_ `backend/siddes_ml/urls.py`
- **/api/search/users** — SearchUsersView.as_view(  
  _Path:_ `backend/siddes_search/urls.py`
- **/api/search/posts** — SearchPostsView.as_view(  
  _Path:_ `backend/siddes_search/urls.py`
- **/api/users/<str:username>** — UserProfileView.as_view(  
  _Path:_ `backend/siddes_search/urls.py`
- **/api/users/<str:username>/posts** — UserPublicPostsView.as_view(  
  _Path:_ `backend/siddes_search/urls.py`
- **/api/prism** — PrismView.as_view(  
  _Path:_ `backend/siddes_prism/urls.py`
- **/api/profile/<str:username>** — ProfileView.as_view(  
  _Path:_ `backend/siddes_prism/urls.py`
- **/api/side** — SideActionView.as_view(  
  _Path:_ `backend/siddes_prism/urls.py`
- **/api/media/sign-upload** — MediaSignUploadView.as_view(  
  _Path:_ `backend/siddes_media/urls.py`
- **/api/media/commit** — MediaCommitView.as_view(  
  _Path:_ `backend/siddes_media/urls.py`
- **/api/media/url** — MediaSignedUrlView.as_view(  
  _Path:_ `backend/siddes_media/urls.py`
- **/api/telemetry/ingest** — TelemetryIngestView.as_view(  
  _Path:_ `backend/siddes_telemetry/urls.py`
- **/api/telemetry/summary** — TelemetrySummaryView.as_view(  
  _Path:_ `backend/siddes_telemetry/urls.py`

### Data Contracts (Backend Truth)
- **Model: Post** — Canonical persisted post record.  
  _Path:_ `backend/siddes_post/models.py`
  _Fields (required):_ id:CharField, author_id:CharField, side:CharField, text:TextField, created_at:FloatField
  _Fields (optional):_ set_id:CharField, public_channel:CharField, urgent:BooleanField, is_hidden:BooleanField, edited_at:FloatField, client_key:CharField, echo_of_post_id:CharField
  _Work vs Public structural difference:_ `side` field selects Side (`work` vs `public`); Public-only attributes are stored via optional fields like `public_channel`/`set_id` (if used by the view contract).

- **Other core models (index)** — mapped by app; field-level extraction is available in the JSON registry for Phase 2 deep dives.  
  _Paths:_ `backend/**/models.py`
  - **siddes_auth.AccountDeleteToken** — Django model. _Path:_ `backend/siddes_auth/models.py`
  - **siddes_auth.EmailChangeToken** — Django model. _Path:_ `backend/siddes_auth/models.py`
  - **siddes_auth.EmailVerificationToken** — Django model. _Path:_ `backend/siddes_auth/models.py`
  - **siddes_auth.PasswordResetToken** — Django model. _Path:_ `backend/siddes_auth/models.py`
  - **siddes_auth.SiddesProfile** — Django model. _Path:_ `backend/siddes_auth/models.py`
  - **siddes_auth.UserSession** — Django model. _Path:_ `backend/siddes_auth/models.py`
  - **siddes_broadcasts.Broadcast** — Django model. _Path:_ `backend/siddes_broadcasts/models.py`
  - **siddes_broadcasts.BroadcastMember** — Django model. _Path:_ `backend/siddes_broadcasts/models.py`
  - **siddes_contacts.ContactIdentityToken** — Django model. _Path:_ `backend/siddes_contacts/models.py`
  - **siddes_inbox.InboxMessage** — Django model. _Path:_ `backend/siddes_inbox/models.py`
  - **siddes_inbox.InboxThread** — Django model. _Path:_ `backend/siddes_inbox/models.py`
  - **siddes_inbox.InboxThreadReadState** — Django model. _Path:_ `backend/siddes_inbox/models.py`
  - **siddes_invites.SiddesInvite** — Django model. _Path:_ `backend/siddes_invites/models.py`
  - **siddes_media.MediaObject** — Django model. _Path:_ `backend/siddes_media/models.py`
  - **siddes_ml.MlFeedback** — Django model. _Path:_ `backend/siddes_ml/models.py`
  - **siddes_ml.MlSuggestion** — Django model. _Path:_ `backend/siddes_ml/models.py`
  - **siddes_notifications.Notification** — Django model. _Path:_ `backend/siddes_notifications/models.py`
  - **siddes_post.Post** — Django model. _Path:_ `backend/siddes_post/models.py`
  - **siddes_post.PostLike** — Django model. _Path:_ `backend/siddes_post/models.py`
  - **siddes_post.Reply** — Django model. _Path:_ `backend/siddes_post/models.py`
  - **siddes_prism.PrismFacet** — Django model. _Path:_ `backend/siddes_prism/models.py`
  - **siddes_prism.SideMembership** — Django model. _Path:_ `backend/siddes_prism/models.py`
  - **siddes_rituals.Ritual** — Django model. _Path:_ `backend/siddes_rituals/models.py`
  - **siddes_rituals.RitualIgnite** — Django model. _Path:_ `backend/siddes_rituals/models.py`
  - **siddes_rituals.RitualResponse** — Django model. _Path:_ `backend/siddes_rituals/models.py`
  - **siddes_safety.ModerationAuditEvent** — Django model. _Path:_ `backend/siddes_safety/models.py`
  - **siddes_safety.UserAppeal** — Django model. _Path:_ `backend/siddes_safety/models.py`
  - **siddes_safety.UserBlock** — Django model. _Path:_ `backend/siddes_safety/models.py`
  - **siddes_safety.UserMute** — Django model. _Path:_ `backend/siddes_safety/models.py`
  - **siddes_safety.UserReport** — Django model. _Path:_ `backend/siddes_safety/models.py`
  - **siddes_sets.SiddesSet** — Django model. _Path:_ `backend/siddes_sets/models.py`
  - **siddes_sets.SiddesSetEvent** — Django model. _Path:_ `backend/siddes_sets/models.py`
  - **siddes_sets.SiddesSetMember** — Django model. _Path:_ `backend/siddes_sets/models.py`
  - **siddes_slate.SlateEntry** — Django model. _Path:_ `backend/siddes_slate/models.py`
  - **siddes_telemetry.TelemetryEvent** — Django model. _Path:_ `backend/siddes_telemetry/models.py`

### Visibility / Guardrail Plumbing (Backend)
- **Visibility policy** — Server-side rules for what a viewer can see by Side/context.  
  _Path:_ `backend/siddes_visibility/policy.py`

### Third-Party Tissue (Backend)
External dependencies (from `backend/requirements.txt`) and integration hook points.

- **Django** — Dependency.  
  _Hook points:_ `backend/siddes_backend/settings.py`, `backend/siddes_backend/api.py`, app `views.py` + `urls.py`
- **djangorestframework** — Dependency.  
  _Hook points:_ `backend/siddes_backend/settings.py`, `backend/siddes_backend/api.py`, app `views.py` + `urls.py`
- **dj-database-url** — Dependency.  
- **psycopg[binary]** — Dependency.  
- **google-auth** — Dependency.  
  _Hook points:_ Google sign-in verification in `backend/siddes_auth/views.py`
- **requests** — Dependency.  
- **redis** — Dependency.  
  _Hook points:_ cache backend configured in `backend/siddes_backend/settings.py`
- **gunicorn** — Dependency.  
  _Hook points:_ `backend/gunicorn.conf.py`, `backend/start_prod.sh`
- **whitenoise** — Dependency.  
  _Hook points:_ static file serving config in `backend/siddes_backend/settings.py`

## Assets / Ops / Docs

### Frontend Public Assets
- **Static assets + PWA files** — icons, manifest, and static public files.  
  _Path:_ `frontend/public/`

### Ops / Infrastructure
- **Docker + dev/prod scaffolding** — local orchestration and deploy scripts.  
  _Path:_ `ops/`
- **Cloudflare worker(s)** — edge integration (e.g., media).  
  _Path:_ `ops/cloudflare/`

### Documentation
- **Docs corpus** — architecture/spec/contract docs.  
  _Path:_ `docs/`

