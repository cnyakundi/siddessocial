# Phase 2 — App Shell + Navigation + Route Guardrails (Spider Pack)

**Scope (Phase 2):** structural wiring only — entry points, routes, chrome rules, navigation link map, and guardrail locations.  
**Non-goals:** no logic critique, no fixes, no refactors.

---

## 1) Runtime Entry Topology

### Frontend
- **Root Layout** — Next.js root layout; loads global CSS and wraps the app in global providers.  
  **Path:** `frontend/src/app/layout.tsx`
- **AppProviders** — composes always-on providers + app chrome layers.  
  **Path:** `frontend/src/components/AppProviders.tsx`
- **AppShell** — route-aware chrome wrapper (mobile top/bottom nav; desktop rails).  
  **Path:** `frontend/src/components/AppShell.tsx`
- **AuthBootstrap** — client bootstrapping for CSRF + auth/onboarding redirect guardrails.  
  **Path:** `frontend/src/components/AuthBootstrap.tsx`

---

## 2) Chrome Rules (what renders “full app” vs “auth shell”)

### AppShell chrome suppression
**Chrome hidden on:**
- `/login*`
- `/signup*`
- `/onboarding*`
- `/about*`

Everything else renders full chrome (Top bar / Bottom nav / Desktop rails depending on viewport).  
**Source:** `frontend/src/components/AppShell.tsx`

---

## 3) Route Taxonomy (Next App Router pages)

### 3.1 Public routes (not guarded by AuthBootstrap)
- `/` — Landing page.  
  **Path:** `frontend/src/app/page.tsx`
- `/about` — About page.  
  **Path:** `frontend/src/app/about/page.tsx`
- `/account-deletion` — Policy / account lifecycle page.  
  **Path:** `frontend/src/app/account-deletion/page.tsx`
- `/community-guidelines` — Policy / account lifecycle page.  
  **Path:** `frontend/src/app/community-guidelines/page.tsx`
- `/confirm-delete` — Account deletion confirmation UI.  
  **Path:** `frontend/src/app/confirm-delete/page.tsx`
- `/confirm-email-change` — Email change confirmation UI.  
  **Path:** `frontend/src/app/confirm-email-change/page.tsx`
- `/forgot-password` — Password reset request UI.  
  **Path:** `frontend/src/app/forgot-password/page.tsx`
- `/legal` — Legal/Policy page.  
  **Path:** `frontend/src/app/legal/page.tsx`
- `/legal/account-deletion` — Legal/Policy page.  
  **Path:** `frontend/src/app/legal/account-deletion/page.tsx`
- `/legal/community-guidelines` — Legal/Policy page.  
  **Path:** `frontend/src/app/legal/community-guidelines/page.tsx`
- `/legal/privacy` — Legal/Policy page.  
  **Path:** `frontend/src/app/legal/privacy/page.tsx`
- `/legal/terms` — Legal/Policy page.  
  **Path:** `frontend/src/app/legal/terms/page.tsx`
- `/privacy` — Policy / account lifecycle page.  
  **Path:** `frontend/src/app/privacy/page.tsx`
- `/reset-password` — Password reset completion UI.  
  **Path:** `frontend/src/app/reset-password/page.tsx`
- `/siddes-broadcasts` — Broadcasts (Public desks) surfaces.  
  **Path:** `frontend/src/app/siddes-broadcasts/page.tsx`
- `/siddes-broadcasts/[id]` — Broadcasts (Public desks) surfaces.  
  **Path:** `frontend/src/app/siddes-broadcasts/[id]/page.tsx`
- `/siddes-broadcasts/[id]/compose` — Broadcasts (Public desks) surfaces.  
  **Path:** `frontend/src/app/siddes-broadcasts/[id]/compose/page.tsx`
- `/siddes-broadcasts/create` — Broadcasts (Public desks) surfaces.  
  **Path:** `frontend/src/app/siddes-broadcasts/create/page.tsx`
- `/siddes-moderation` — Moderation/admin surfaces.  
  **Path:** `frontend/src/app/siddes-moderation/page.tsx`
- `/siddes-moderation/appeals` — Moderation/admin surfaces.  
  **Path:** `frontend/src/app/siddes-moderation/appeals/page.tsx`
- `/siddes-moderation/audit` — Moderation/admin surfaces.  
  **Path:** `frontend/src/app/siddes-moderation/audit/page.tsx`
- `/siddes-moderation/stats` — Moderation/admin surfaces.  
  **Path:** `frontend/src/app/siddes-moderation/stats/page.tsx`
- `/siddes-notifications` — Notifications (alerts) surface.  
  **Path:** `frontend/src/app/siddes-notifications/page.tsx`
- `/terms` — Policy / account lifecycle page.  
  **Path:** `frontend/src/app/terms/page.tsx`
- `/u/[username]` — Public user profile surface.  
  **Path:** `frontend/src/app/u/[username]/page.tsx`
- `/verify-email` — Email verification UI.  
  **Path:** `frontend/src/app/verify-email/page.tsx`

### 3.2 Auth routes (special chrome + no redirects in AuthBootstrap)
- `/login` — Login UI.  
  **Path:** `frontend/src/app/login/page.tsx`
- `/onboarding` — First-run onboarding.  
  **Path:** `frontend/src/app/onboarding/page.tsx`
- `/signup` — Signup UI.  
  **Path:** `frontend/src/app/signup/page.tsx`

### 3.3 Protected routes (guarded by AuthBootstrap prefix list)
AuthBootstrap protects these **prefixes**:

`/siddes-feed, /siddes-post, /siddes-circles, /siddes-inbox, /siddes-invites, /siddes-compose, /invite, /siddes-profile, /siddes-settings`

Pages currently covered by that prefix list:
- `/invite/[id]` — Invite acceptance flow.  
  **Path:** `frontend/src/app/invite/[id]/page.tsx`
- `/siddes-compose` — Composer surface.  
  **Path:** `frontend/src/app/siddes-compose/page.tsx`
- `/siddes-feed` — Primary feed surface.  
  **Path:** `frontend/src/app/siddes-feed/page.tsx`
- `/siddes-inbox` — Inbox surfaces.  
  **Path:** `frontend/src/app/siddes-inbox/page.tsx`
- `/siddes-inbox/[id]` — Inbox surfaces.  
  **Path:** `frontend/src/app/siddes-inbox/[id]/page.tsx`
- `/siddes-invites` — Invites management surface.  
  **Path:** `frontend/src/app/siddes-invites/page.tsx`
- `/siddes-post/[id]` — Post detail surface.  
  **Path:** `frontend/src/app/siddes-post/[id]/page.tsx`
- `/siddes-profile` — Profile + account surfaces.  
  **Path:** `frontend/src/app/siddes-profile/page.tsx`
- `/siddes-profile/account` — Profile + account surfaces.  
  **Path:** `frontend/src/app/siddes-profile/account/page.tsx`
- `/siddes-profile/account/danger` — Profile + account surfaces.  
  **Path:** `frontend/src/app/siddes-profile/account/danger/page.tsx`
- `/siddes-profile/account/email` — Profile + account surfaces.  
  **Path:** `frontend/src/app/siddes-profile/account/email/page.tsx`
- `/siddes-profile/account/export` — Profile + account surfaces.  
  **Path:** `frontend/src/app/siddes-profile/account/export/page.tsx`
- `/siddes-profile/account/password` — Profile + account surfaces.  
  **Path:** `frontend/src/app/siddes-profile/account/password/page.tsx`
- `/siddes-profile/account/sessions` — Profile + account surfaces.  
  **Path:** `frontend/src/app/siddes-profile/account/sessions/page.tsx`
- `/siddes-circles` — Circles hub / set detail surfaces.  
  **Path:** `frontend/src/app/siddes-circles/page.tsx`
- `/siddes-circles/[id]` — Circles hub / set detail surfaces.  
  **Path:** `frontend/src/app/siddes-circles/[id]/page.tsx`
- `/siddes-settings` — Settings surfaces.  
  **Path:** `frontend/src/app/siddes-settings/page.tsx`
- `/siddes-settings/appeals` — Settings surfaces.  
  **Path:** `frontend/src/app/siddes-settings/appeals/page.tsx`
- `/siddes-settings/blocked` — Settings surfaces.  
  **Path:** `frontend/src/app/siddes-settings/blocked/page.tsx`
- `/siddes-settings/locality` — Settings surfaces.  
  **Path:** `frontend/src/app/siddes-settings/locality/page.tsx`
- `/siddes-settings/muted` — Settings surfaces.  
  **Path:** `frontend/src/app/siddes-settings/muted/page.tsx`

### 3.4 Semi-internal routes (not auth-protected by AuthBootstrap, but “system surfaces”)
- `/developer` — Developer utilities surface.  
  **Path:** `frontend/src/app/developer/page.tsx`
- `/developer/telemetry` — Developer utilities surface.  
  **Path:** `frontend/src/app/developer/telemetry/page.tsx`
- `/launchpad` — Internal launchpad / studio utilities.  
  **Path:** `frontend/src/app/launchpad/page.tsx`
- `/launchpad/composer-studio` — Internal launchpad / studio utilities.  
  **Path:** `frontend/src/app/launchpad/composer-studio/page.tsx`
- `/search` — Universal search surface.  
  **Path:** `frontend/src/app/search/page.tsx`

> Note: This taxonomy is **purely structural** (based on the current prefix list in `AuthBootstrap.tsx` and the app route tree).

---

## 4) Navigation Building Blocks (link map + ownership)

### 4.1 Components (primary nav/chrome)
- **AppShell** — Route-aware chrome wrapper; hides chrome on auth/about pages.  
  **Path:** `frontend/src/components/AppShell.tsx`
- **AppTopBar** — Mobile top bar (Side badge + Alerts entry).  
  **Path:** `frontend/src/components/AppTopBar.tsx`
- **BottomNav** — Mobile bottom navigation + compose entry + Public doorway hooks.  
  **Path:** `frontend/src/components/BottomNav.tsx`
- **TopNav** — Lightweight top nav used on some non-app pages.  
  **Path:** `frontend/src/components/TopNav.tsx`
- **DesktopSideRail** — Desktop left rail: primary nav + Public doorway confirm + side badge.  
  **Path:** `frontend/src/components/DesktopSideRail.tsx`
- **DesktopTopBar** — Desktop top bar: page title + search entry + quick links.  
  **Path:** `frontend/src/components/DesktopTopBar.tsx`
- **DesktopSearchOverlay** — Desktop search overlay (type-ahead, keyboard close).  
  **Path:** `frontend/src/components/DesktopSearchOverlay.tsx`
- **DesktopUserMenu** — Desktop user dropdown menu.  
  **Path:** `frontend/src/components/DesktopUserMenu.tsx`
- **SideBadge** — Side badge UI; opens switcher.  
  **Path:** `frontend/src/components/SideBadge.tsx`
- **SideSwitcherSheet** — Side switcher sheet (includes Public confirm path).  
  **Path:** `frontend/src/components/SideSwitcherSheet.tsx`
- **PublicEnterConfirmSheet** — Explicit confirmation gate before entering Public.  
  **Path:** `frontend/src/components/PublicEnterConfirmSheet.tsx`
- **FirstRunSidePicker** — First-run side chooser (FTUE) if no stored active side.  
  **Path:** `frontend/src/components/FirstRunSidePicker.tsx`
- **AuthBootstrap** — Client boot: CSRF patch + auth/onboarding redirects for protected routes.  
  **Path:** `frontend/src/components/AuthBootstrap.tsx`

### 4.2 Mobile link map
- **BottomNav** links: /siddes-compose?side=${side}, /siddes-feed, /siddes-inbox, /siddes-profile  
  **Path:** `frontend/src/components/BottomNav.tsx`
- **AppTopBar** links: /siddes-feed, /siddes-notifications  
  **Path:** `frontend/src/components/AppTopBar.tsx`

### 4.3 Desktop link map
- **DesktopSideRail** links: /siddes-compose, /siddes-profile, /siddes-settings  
  **Path:** `frontend/src/components/DesktopSideRail.tsx`
- **DesktopTopBar** links: /siddes-inbox  
  **Path:** `frontend/src/components/DesktopTopBar.tsx`

### 4.4 Lightweight top nav (used outside the main shell)
- **TopNav** links: (none detected)  
  **Path:** `frontend/src/components/TopNav.tsx`

---

## 5) Guardrails (structural enforcement points)

### 5.1 Auth & onboarding redirect guard
- **AuthBootstrap** owns:
  - CSRF patching (`patchFetchForCsrf`)
  - `/api/auth/me` bootstrap (`fetchMe`)
  - Protected-route redirects to `/login`
  - Authed-but-not-onboarded redirect to `/onboarding`
  **Path:** `frontend/src/components/AuthBootstrap.tsx`

### 5.2 Public doorway confirmation
- **PublicEnterConfirmSheet** is the explicit “enter Public” gate used by:
  - `BottomNav.tsx`
  - `DesktopSideRail.tsx`
  - `SideSwitcherSheet.tsx`
  - Broadcasts route pages (`/siddes-broadcasts*`)
  **Path:** `frontend/src/components/PublicEnterConfirmSheet.tsx`

### 5.3 Side mismatch UX
- Post detail route includes a **SideMismatch** banner/flow when post side differs from active side.  
  **Path:** `frontend/src/app/siddes-post/[id]/page.tsx`

### 5.4 Restricted/blocked shapes normalization
- Shared “restricted payload” helpers live here (frontend structural contract handling).  
  **Path:** `frontend/src/lib/restricted.ts`

---

## 6) Interaction Pathways (routing graph snapshots)

- **Home feed → Post detail**  
  **From:** `frontend/src/components/PostCard.tsx` (pushes to `/siddes-post/[id]`)  
  **To:** `frontend/src/app/siddes-post/[id]/page.tsx`

- **Feed → Compose (side-targeted)**  
  **From:** `frontend/src/components/BottomNav.tsx` and `frontend/src/components/SideFeed.tsx`  
  **To:** `frontend/src/app/siddes-compose/page.tsx` (reads `?side=`)

- **Desktop Search**  
  **Entry:** `frontend/src/components/DesktopTopBar.tsx` (opens search affordance)  
  **Surface:** `frontend/src/app/search/page.tsx` + `frontend/src/components/DesktopSearchOverlay.tsx`

---

## 7) Third-party tissue (routing + chrome)

- **Next.js App Router** — `useRouter`, `usePathname`, route segments in `frontend/src/app/**`  
- **TailwindCSS** — all chrome/layout styling is class-based (no runtime theme engine)  
- **lucide-react** — icon system used across nav/chrome components

---

## Appendix — Files touched by this pack

- `frontend/src/app/layout.tsx`
- `frontend/src/components/AppProviders.tsx`
- `frontend/src/components/AppShell.tsx`
- `frontend/src/components/AuthBootstrap.tsx`
- `frontend/src/components/AppTopBar.tsx`
- `frontend/src/components/BottomNav.tsx`
- `frontend/src/components/TopNav.tsx`
- `frontend/src/components/DesktopSideRail.tsx`
- `frontend/src/components/DesktopTopBar.tsx`
- `frontend/src/components/DesktopSearchOverlay.tsx`
- `frontend/src/components/DesktopUserMenu.tsx`
- `frontend/src/components/SideBadge.tsx`
- `frontend/src/components/SideSwitcherSheet.tsx`
- `frontend/src/components/PublicEnterConfirmSheet.tsx`
- `frontend/src/components/FirstRunSidePicker.tsx`
