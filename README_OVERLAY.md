# sd_736 — Profile Message Bootstrap (Ensure DM Thread)

Summary: Profile V2 now supports **1-tap messaging**. The “Message” button ensures a DM thread exists via `POST /api/inbox/threads` and navigates straight to `/siddes-inbox/<threadId>`.

## What changed
- **Profile page** wires a real Message action (create/ensure thread → route to inbox thread).
- **ProfileV2Header (clean variant)** now supports `onMessage` the same way the hero variant does.
- Removed an accidental `/* ... */` text node that could render on the profile page.

## Files
- `frontend/src/app/u/[username]/page.tsx`
- `frontend/src/components/ProfileV2Header.tsx`

## Apply (VS Code terminal)
```bash
chmod +x scripts/apply_overlay.sh
./scripts/apply_overlay.sh ~/Downloads/sd_736_profile_message_bootstrap_overlay.zip
./verify_overlays.sh

cd frontend && npm run typecheck && npm run build
```

## Smoke test
1) Open a user profile that is **not** your own: `/u/<username>`
2) Tap the **Message** icon
3) Expect: you land on `/siddes-inbox/<threadId>`
4) Send a message → it appears in the thread
