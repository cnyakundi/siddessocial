# Composer Studio (Dev-only) — sd_388

## Why
You want to iterate fast on the **Web Composer** UI (desktop-first modal / chameleon / toolbar layouts)
without shipping mock tools into production user paths.

This adds a dev-only route:

- `/launchpad/composer-studio` (404 in production)

## What it contains
- Side switcher (Public/Friends/Close/Work)
- Status switcher (Idle/Busy/Error)
- Web Composer shell mock that respects chameleon colors & character limits (800/5000)

## What it does NOT do
- It does not post to the server.
- It does not expose mock tools in production routes.

## Files
- frontend/src/app/launchpad/composer-studio/page.tsx
- frontend/src/app/launchpad/composer-studio/studioClient.tsx
- frontend/src/app/launchpad/page.tsx (adds link button)

## QA
- Visit `/launchpad`
- Click **Composer Studio**
- Confirm page 404s in production builds.
