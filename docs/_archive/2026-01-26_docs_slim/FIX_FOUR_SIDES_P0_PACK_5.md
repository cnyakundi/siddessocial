# FIX: Four Sides — P0 Pack 5 (Prism: order + copy + teaching)

**Overlay:** sd_744_four_sides_fix_p0_pack_5_prism_order_copy  
**Date:** 2026-01-26

## Goal
Finish the P0 standardization inside **Prism Profile** surfaces:
- No custom Side arrays (always canonical `SIDE_ORDER`).
- Reinforce the core mental model: **Side = who this is for.**
- Make **Close** read as **Inner Circle** and **Work** read as **Colleagues & clients**.

## What changed
- `PrismSideTabs`: now uses `SIDE_ORDER` instead of a local `["public","friends","close","work"]` array.
- `OwnerTopRow` (preview toggles): now uses `SIDE_ORDER`.
- Added a compact teaching line above the Prism side tabs: *Side = who this is for.*
- Updated the Side access sheet copy:
  - Close: “Inner Circle …”
  - Work: “Colleagues & clients …”
  - Confirm dialog: “Confirm Inner Circle access”

## Files changed
- `frontend/src/components/PrismProfile.tsx`

## Smoke test
1) Open any profile `/u/<handle>`
   - Under the profile identity tabs, you see: **Side = who this is for.**
2) Verify identity tabs order matches everywhere: **Public → Friends → Close → Work**
3) Tap **Side** (or “Sided: …”) to open the access sheet
   - Close row mentions **Inner Circle**
   - Work row mentions **Colleagues & clients**
   - Confirm screen title says **Confirm Inner Circle access**
