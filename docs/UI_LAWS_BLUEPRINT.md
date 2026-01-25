# Siddes UI Laws & Quality Blueprint (Source of Truth)

This document defines the non-negotiable UI laws for Siddes:
- Design tokens (spacing/type/radius/shadows/buttons/inputs)
- Interaction standards (menus/sheets/modals/drawers/toasts)
- States matrix (loading/empty/error/restricted/offline)
- Accessibility (keyboard/focus/ARIA/tap targets/reduced motion)
- Trust cues (who sees this? no accidental widening)
- Performance (no layout shift, no jank)
- QA plan (smoke + automation + regression)

## Authority
If any PR conflicts with this document, this document wins.

## Terms
- **MUST**: non-negotiable
- **SHOULD**: default; deviations require justification
- **MAY**: optional

## Canonical references in repo (house style)
- Layout shell: `frontend/src/components/AppShell.tsx`
- Global background: `frontend/src/app/globals.css`
- Side themes: `frontend/src/lib/sides.ts`
- Auth card style: `frontend/src/components/auth/AuthShell.tsx`
- Canon states behavior: `frontend/src/components/SideFeed.tsx`
- Post object: `frontend/src/components/PostCard.tsx`

## Runbook + tracking
Implementation runbook:
- `docs/MASTER_IMPLEMENTATION_RUNBOOK.md`

Compliance tracker:
- `docs/UI_COMPLIANCE_TRACKER.md`
