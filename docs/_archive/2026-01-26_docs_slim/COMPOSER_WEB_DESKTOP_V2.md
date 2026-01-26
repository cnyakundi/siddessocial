# Siddes Web Composer (Desktop v2)

**Owner:** Siddes UI
**Status:** Implemented (Phase 1)

## 1) What this is
A desktop-first compose shell that:
- feels like a modal on desktop (center card + blur backdrop)
- behaves like a bottom-sheet on mobile
- always shows Side + Audience context (“who will see this”)

## 2) Safety contract (must never regress)
1) **Never clear user text on failure.**
2) **Offline** → queue + undo + close is OK.
3) **Online failure** (4xx/5xx/network) → keep text, save draft, show inline error.
4) **Limits are enforced client-side**
   - Public: 800
   - Private sides: 5000
5) **Public confirm** still applies when enabled.

## 3) Drafts
Stored locally:
- Key: `sd.compose.drafts.v1`
- One draft per Side (Public/Friends/Close/Work)
- Drafts sheet supports restore + delete

## 4) Deep links
- `?prompt=...` prefills composer text
- `?side=work` does not auto-switch (unsafe)
  - instead shows “Enter Work” banner

## 5) Implementation mapping
- Page: `frontend/src/app/siddes-compose/page.tsx`

## 6) Manual QA checklist
- Public max length disables Post at 801+
- Private max length disables Post at 5001+
- 401/403/500/network errors keep text + show error + draft saved
- Offline queues and shows undo
- Drafts sheet restore/delete works
- `?prompt=` works
- `?side=` shows enter banner (no auto-switch)
