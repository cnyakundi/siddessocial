# Siddes — Public Topics (Granular Siding) [Draft]

> **Note:** UI says **Topics**. Implementation uses `publicChannel` internally (topics are an implementation detail).

Goal: prevent **Public context collapse** without an algorithm, by letting authors tag their Public posts and letting viewers filter.

## What shipped (sd_128)
This milestone is intentionally **opt-in** and **non-invasive**.

- Adds an optional `publicChannel` tag to Public posts (`general | tech | politics | personal`)
- Default topic is **General**
- UI (only when enabled):
  - Compose page: topic picker
  - Public feed: topic filter row (All + topics)
  - PostCard: topic chip

## What shipped (sd_129)
- Adds **per-person topic tuning** for Public (“Granular Siding”).
- Profile (Public only): Side becomes stateful (local) and opens a **Topics** tuner sheet.
- Public feed: applies your per-person topic prefs **in addition** to the global topic filter row.

Storage:
- `sd.publicSiding.v0` in `localStorage`

## What shipped (sd_130)
- Adds the **Public Trust Dial** (Calm / Standard / Arena) behind a flag.
- Trust Dial is independent of topics, but composes cleanly:
  - Trust filter happens first, then Granular Siding prefs, then the global topic pill filter.

See: `docs/PUBLIC_TRUST_DIAL.md`

## Flags
All Public tuning flags default OFF.

Enable Public Topics in dev by setting:

- `NEXT_PUBLIC_SD_PUBLIC_CHANNELS=1`

Enable Trust Dial in dev by setting:

- `NEXT_PUBLIC_SD_PUBLIC_TRUST_DIAL=1`

Recommended: keep flags OFF until we’re happy with taxonomy + UI.

## Endgame (next milestones)
- sd_131: Public Slate + Pinned Stack (profile becomes a homepage)
- sd_132: Public Visual Calm (hide counts until hover/tap)