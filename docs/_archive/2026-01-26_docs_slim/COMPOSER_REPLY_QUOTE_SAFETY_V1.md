# Siddes Composer Parity: Reply + Quote Echo (sd_385)

## Goal
Bring Reply and Quote Echo flows up to the same safety bar as `/siddes-compose`:

- Never destroy user text on failure.
- Queue only when offline.
- Enforce client-side limits that match backend.
- Inline error on failure (no silent close, no fake success).

## Behavior Contract

### Reply
- Max length: **2000**.
- Offline: queue reply + undo + close is OK.
- Online failure: keep composer open, keep text, show inline error.
- Trust gates (Public): show inline restricted message (Trust Lx / rate limit).

### Quote Echo
- Max length: **800 (Public target)** / **5000 (private target)**.
- Never close before backend success.
- Inline error; preserve text.
- UI only shows Quote Echo action for **Public posts** (matches current backend launch-safe rule).

## Backend alignment
`PostQuoteEchoView` now enforces:
- max length (same as PostCreate: 800/5000)
- Public trust gates (same policy path as PostCreate)

## Files touched
- frontend/src/components/ReplyComposer.tsx
- frontend/src/app/siddes-post/[id]/page.tsx
- frontend/src/components/QuoteEchoComposer.tsx
- frontend/src/components/PostCard.tsx
- frontend/src/components/EchoSheet.tsx
- backend/siddes_post/views.py

## Manual QA
1) Open a post detail, click **Add reply**
   - type > 2000 chars → send disabled + red counter
   - simulate backend error → composer stays open, text remains
2) Go offline → send reply → queued + undo, composer closes
3) Public post → Echo sheet shows **Quote Echo**
   - type too long → inline error, stays open
   - backend error → inline error, stays open
4) Non-public post → Echo sheet does **not** show Quote Echo
