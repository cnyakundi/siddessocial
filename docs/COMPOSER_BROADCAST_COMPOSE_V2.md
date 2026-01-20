# Siddes Broadcast Compose (Web Shell v2) — sd_386

## Goal
Bring `/siddes-broadcasts/[id]/compose` up to the same safety bar as the main Web Composer:

- Modal overlay (desktop) / sheet feel (mobile)
- Always-visible Public + Broadcast context header
- Client-side limit enforcement: Public max **800**
- Never destroy text on failure; save draft locally
- Offline → queue + undo + close

## Drafts
Local drafts are stored per broadcast:
- Key: `sd.compose.broadcast.drafts.v1`
- Value: `{ [broadcastId]: { text, updatedAt } }`
- Auto-restore on open; saved on close/failure; cleared on success.

## Error semantics
- 400: validation (empty/too_long)
- 401: login required (redirect)
- 403: writers-only / trust gates / rate limit
- 503: broadcasts unavailable
- >=500: server error
All failures keep text and save draft.

## Files
- frontend/src/app/siddes-broadcasts/[id]/compose/page.tsx
