# Siddes — Public Trust Dial (Calm / Standard / Arena) [Draft]

> **Note:** UI says **Topics**. Implementation uses `publicChannel` internally (topics are an implementation detail).

Goal: let users control the **temperature** of the Public feed without an algorithm.

Instead of forcing “For You” vs “Siding”, Siddes exposes a simple dial:

- **Calm** (Signal): trusted-only
- **Standard**: hides obvious low-trust noise
- **Arena** (Noise): shows everything

This is intentionally **under-the-hood**. Users don’t need to see “L3”.
They see a dial; the system uses trust bands.

## What shipped (sd_130)
- Adds a local trust dial preference store (`localStorage`)
  - key: `sd.publicTrustDial.v0`
- Adds an opt-in Trust Dial row at the top of the **Public** feed
- Filters Public posts by `trustLevel` threshold:
  - Calm: `trustLevel >= 3`
  - Standard: `trustLevel >= 1`
  - Arena: `trustLevel >= 0`

Notes:
- In stub/demo data, Public posts include `trustLevel` so the dial has a visible effect.
- Stub “me” posts created via `/api/post` are treated as `trustLevel=3` (trusted).

## Flags
Enable in dev:

- `NEXT_PUBLIC_SD_PUBLIC_TRUST_DIAL=1`

Public Topics are independent (optional):

- `NEXT_PUBLIC_SD_PUBLIC_CHANNELS=1`

## Endgame (next milestones)
- sd_131: Public Slate + Pinned Stack (profile becomes a homepage)
- sd_132: Public “Visual Calm” (hide counts by default; reveal on hover/tap)