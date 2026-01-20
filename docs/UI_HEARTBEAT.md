# Siddes UI Heartbeat (Read this first)

This file is the **UI source of truth** for Siddes.  
If you migrate this repo to another AI coding tool, read this first.

---

## The core model

**Side = context mode.**  
**Set = subgroup inside a Side.**  
**Topics = Public-only categories** (implementation detail: currently `publicChannel`).

**Never** confuse these:
- Side answers: *“Who am I talking to?”*
- Set answers: *“Which subset inside this Side?”*
- Topic answers: *“What is this about?”* (Public only)

---

## Naming laws (non‑negotiable)

Do **not** use:
- Siders / Siding
- Circles
- Stories / Rings

Use:
- **Side** (verb), **Sided**, **Unside** (confirm)
- **Siders** (owner-only), **Siding** (owner-only)
- **Sets**
- **Topics** (Public-only)

---

## UI hierarchy

**Side (global)** → **Set (optional)** → **Feed**

---

## Flags (UI)

- `NEXT_PUBLIC_SD_FEED_MODULES=1` — Remixed feed modules (UI-only cards injected into SideFeed)
- `NEXT_PUBLIC_SD_PUBLIC_CHANNELS=1` — Public Topics (internally “topics”)

---

## Canon docs (read order)

1) `docs/UI_MASTER_SPEC.md`
2) `docs/UI_STATUS_MATRIX.md`
3) `docs/UI_LAUNCH_MVP.md`

