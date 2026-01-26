# FIX: PWA — Bottom Nav Alerts (swap out Sets) + Unread Badge + Close icon clarity

**Overlay:** sd_749_pwa_notifs_nav
**Date:** 2026-01-26

## Goal
Make **Notifications** (Alerts) visible on PWA/mobile by promoting them to the **BottomNav**, while keeping icon language unambiguous:
- Replace the **Sets** tab in the bottom nav with **Alerts**.
- Show a deterministic **unread badge** on the Alerts bell.
- Change the **Close Side icon** to a **Heart** (Inner Circle) so it can’t be mistaken for any “notifications/lock/system” meaning.

## What changed
### 1) BottomNav: Sets → Alerts
- Mobile/PWA bottom nav order is now:
  - **Now · Alerts · Create · Inbox · Me**
- Alerts tab links to `/siddes-notifications`.
- Added an unread badge driven by `useNotificationsActivity()`:
  - **1–9**: dot badge
  - **10+**: numeric badge (caps at `99+`)

### 2) Close Side icon: Lock → Heart
- The **Close** Side is “Inner Circle”, so the icon is now consistently a **Heart** across mobile + onboarding.

## Files changed
- `frontend/src/components/BottomNav.tsx`
- `frontend/src/components/MobileSideTabsRow.tsx`
- `frontend/src/components/onboarding/steps/WelcomeStep.tsx`
- `frontend/src/components/onboarding/steps/SidesExplainerStep.tsx`
- `frontend/src/components/onboarding/steps/FirstPostStep.tsx`

## Notes
- Sets are still available on mobile via **Account** (`/siddes-profile/account`) and by direct route (`/siddes-sets`).
- Notifications page already exists at `/siddes-notifications` and includes:
  - Push preferences + push subscription debug
  - DB-backed Alerts list (`NotificationsView`) with “Mark all read”

## Smoke test
1) **PWA/mobile:** confirm bottom nav shows **Alerts** (bell) instead of Sets.
2) Generate an unread alert (mention/reply), then confirm:
   - Alerts tab shows a dot (1–9) or a number (10+).
3) Open `/siddes-notifications`:
   - “Mark all read” clears the badge.
4) Open the Side tabs row (where visible):
   - **Close** uses a **Heart** icon (not a lock).
