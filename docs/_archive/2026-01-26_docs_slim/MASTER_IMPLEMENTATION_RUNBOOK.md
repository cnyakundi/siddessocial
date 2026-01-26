# Siddes UI Quality Master Implementation Runbook (100% Clean)

This is your single, end-to-end “flight checklist” to implement the UI Laws & Quality Blueprint in the repo without inconsistency. It’s written for a beginner workflow: small steps, clear gates, zero guessing.

Everything below is repo-specific to `sidesroot/`.

## The North Star (what “100% clean” means)
You’re “100%” when all of these are true:

1) Design consistency: spacing/type/radius/shadows/buttons/inputs follow a single system  
2) Accessibility: keyboard-only + screen reader users can complete core flows  
3) Overlay reliability: menus/sheets/drawers behave consistently (ESC, scroll lock, focus)  
4) State truthfulness: every major screen has correct Loading/Empty/Error/Restricted/Offline  
5) Trust cues: “Who sees this?” is always obvious; no accidental widening  
6) Performance feel: no layout shift, no jank, stable skeletons  
7) QA gates: regressions are caught by scripts + Playwright, not by users

## Quality Gates
- Gate A: `./scripts/run_tests.sh`
- Gate B (UI touched): `cd frontend && npm run e2e`

## Phases
- Phase 0: Governance (docs + tracker)
- Phase 1: Foundation (forms a11y + overlay contract)
- Phase 2: States matrix (truthful loading/empty/error/restricted/offline)
- Phase 3: Token enforcement (stop drift permanently)
- Phase 4: Trust cues (no accidental widening)
- Phase 5: Performance feel (no layout shift, smooth interactions)
- Phase 6: Release gates (never regress)
