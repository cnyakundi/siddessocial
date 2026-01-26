# Siddes — Core Laws (Constitution)
**Updated:** 2026-01-26

These are the non‑negotiable laws that keep Siddes from turning into “context collapse with extra steps”.
If a change violates a law, it does **not** ship.

---

## L0 — Side Isolation (no cross‑Side leakage)
- Content created in a Side may only be viewed in that Side unless there is an explicit, server‑enforced bridge.
- UI must never *imply* visibility that the backend does not enforce.

## L1 — Privacy is server‑enforced
- “UI-only privacy” is forbidden.
- Visibility / authz is decided by the backend and verified in tests/checks.

## L2 — Viewer identity is explicit
- Every read/write is evaluated for a specific viewer (real auth in prod; stub viewer in dev).
- “Per-viewer state” (unread, last-seen, access) is stored per viewer. No global shortcuts.

## L3 — Widening visibility requires confirmation
- Any action that makes something visible to more people must:
  1) be explicit in UX copy,
  2) be reversible (where possible),
  3) be confirmed when risky.

## L4 — Safe defaults
- Defaults bias toward **less** visibility, **less** notification spam, **less** permanent damage.
- A “bad tap” should be recoverable.

## L5 — Deterministic, reproducible debugging
- Fixes must come with a reproducible repro and the “first real error”.
- If you can’t reproduce it, you can’t confidently fix it.

## L6 — Stability beats novelty (especially pre-launch)
- Feature work pauses when P0 stability is at risk.
- One active fix window at a time (no context bleed).

## L7 — PWA ergonomics (one-handed, mobile-first)
- Navigation must be obvious and consistent.
- Sheets/modals must close reliably; back navigation must not trap users.

## L8 — Caching must be correctness-safe
- No cross-user cache contamination.
- Cache strategy must respect Side + viewer boundaries.

## L9 — Document the current truth
- `docs/STATE.md` is the single source of “where we are”.
- Every significant overlay updates STATE (and Overlays Index if applicable).

---
