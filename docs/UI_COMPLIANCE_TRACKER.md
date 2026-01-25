# UI Compliance Tracker (100% Alignment Scoreboard)

This tracker is the measurable definition of “100% aligned”.

## ✅ Phase 0 — Governance
- [ ] UI Laws blueprint exists (`docs/UI_LAWS_BLUEPRINT.md`)
- [ ] Master runbook exists (`docs/MASTER_IMPLEMENTATION_RUNBOOK.md`)
- [ ] Compliance tracker exists (this file)

## ✅ Phase 1A — Forms A11y
- [ ] Auth forms: real labels (htmlFor+id)
- [ ] Visible focus (focus-visible ring) everywhere
- [ ] Errors tied to fields (aria-describedby + role="alert" when blocking)
- [ ] Account email/password forms aligned

## ✅ Phase 1B — Overlay Contract
- [ ] Every overlay has role="dialog" aria-modal + accessible name
- [ ] ESC closes topmost overlay
- [ ] Background scroll locks (useLockBodyScroll)
- [ ] Focus enters overlay + traps + returns to trigger
- [ ] Overlay E2E test exists and passes

## ✅ Phase 2 — States Matrix
- [ ] Search states (loading skeleton, empty CTA, error+retry, restricted distinct)
- [ ] Inbox list states (skeleton rows, error+retry, empty CTA)
- [ ] Inbox thread “no lies” (no empty during initial load)
- [ ] Sets list + set hub states match SideFeed
- [ ] Profile self/other states (skeleton + retry; network error != not authed)
- [ ] States E2E test exists and passes

## ✅ Phase 3 — Token Enforcement
- [ ] One background tone across shell + globals
- [ ] Radii tokens enforced; rounded-[…] only in allowlist
- [ ] Shadows restricted; shadow-[…] only in BottomNav + FeedModuleCard
- [ ] Buttons: only 2 families (auth pill + sheet action)
- [ ] Inputs: one canonical bundle
- [ ] Token guardrail script exists and passes

## ✅ Phase 4 — Trust Cues
- [ ] Public entry confirm always appears
- [ ] Post-to-public confirm works + “don’t ask again” honored
- [ ] Audience stamp always visible (compose + posts + detail)
- [ ] Non-public never shows Share; copy warns “requires access”
- [ ] Side mismatch blocks unsafe replies with “Enter Side” CTA
- [ ] Inbox context risk cues consistent
- [ ] Trust E2E test exists and passes

## ✅ Phase 5 — Performance Feel
- [ ] Skeleton parity (no text-only loading in major surfaces)
- [ ] No layout shift from images (space reserved)
- [ ] Buttons don’t resize on loading
- [ ] Smooth scroll on feed/inbox
- [ ] Search preserves results while loading
