# Four Sides Fix — P0 Pack 3 (Icons + Teaching Line)

Overlay: **sd_742_four_sides_fix_p0_pack_3_icons_and_teaching_line**  
Date: 2026-01-26

## What changed
- **Close identity icon is now consistent** (Heart, not Lock) in remaining places that still used Lock:
  - Desktop Side Rail (side switch buttons)
  - Ritual Dock (ritual cards)
- **Teaching line added** on Side selection surfaces:
  - Desktop Top Bar → Side popover
  - Side Switcher Sheet

## Why
- Lock is a *state* (restricted/private), not a Side identity. Using Lock as the Close icon teaches “secrecy” instead of “trusted inner circle.”
- The one-sentence teaching line reduces Side confusion instantly: **Side = who this is for.**

## Files touched
- `frontend/src/components/DesktopSideRail.tsx`
- `frontend/src/components/RitualDock.tsx`
- `frontend/src/components/DesktopTopBar.tsx`
- `frontend/src/components/SideSwitcherSheet.tsx`

## Manual smoke test
1) Desktop: open any page with the left rail → the **Close** button uses **Heart**, not Lock.  
2) Feed: if Ritual Dock is visible → ritual cards show **Close** label with **Heart**, not Lock.  
3) Open Side Switcher Sheet → shows: *Side = who this is for.* under the title.  
4) Desktop top bar: open the Side popover → shows: *Side = who this is for.*

## Notes
- Lock icon remains valid as a **privacy badge** (e.g., “private side”) and **SideLock indicator**.
