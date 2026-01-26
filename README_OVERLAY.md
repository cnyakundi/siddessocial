# sd_743_inbox_proxy_real_auth_fix

Summary: Fix inbox Next.js proxy routes incorrectly treating authenticated users as anonymous (causing `restricted:true` even when logged in). Stub-only visibility gates now run ONLY when a dev stub viewer is present.

## What this fixes
- "Login required" when tapping **Message** (POST /api/inbox/threads) even though you are logged in.
- Inbox list / thread open returning restricted in production builds due to stub visibility shims.

## Changes
- Removed dev-only early returns that required a stub viewer even when real session auth is present.
- Guarded stub visibility filtering/gating behind: `!isProd && viewerId` (dev stub only).

## Files
- frontend/src/app/api/inbox/threads/route.ts
- frontend/src/app/api/inbox/thread/[id]/route.ts

## Verify
- Open `/u/<username>` → tap **Message** → should open `/siddes-inbox/<threadId>` without `Login required`.
- Open Inbox list and a thread: no unexpected `restricted:true` when logged in.
