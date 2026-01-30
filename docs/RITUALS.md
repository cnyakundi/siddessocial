# Siddes — Rituals (Pulse)

Rituals are **structured micro-moments** that live **above the feed**.
They are *not posts*.

Examples:
- Mood check (Friends Circle)
- Reading list (Close Circle)
- Blocker check (Work Circle)
- Public Daily Town Hall (Public)

## Privacy model (who sees what)

**Core rule:** server-side privacy is the truth. No cross-side leakage.

### Public
- **Side-wide** Public Rituals are limited to **Town Hall** (`kind=townhall`).
- Public Rituals require an authenticated viewer (unknown viewer returns `restricted:true`).

### Friends / Close / Work
- **V1 is Circle-scoped only.**
- A viewer can read/write only if they are the Circle owner or a Circle member (DB-enforced).
- The Circle's stored `side` is the truth (client cannot spoof the side).

### Broadcasts / Topics (`set_id=b_*`)
- Treated as Public channels. In v1, Ritual kind is limited to **question**.

## Enforcement (server-side)

### Viewer identity (production truth)
- Production: session auth is the truth (no client-supplied viewer identity).
- Dev: `x-sd-viewer` is allowed only when `DEBUG=True`.

### Default-safe behavior
- List returns `restricted:true` + empty items for unknown viewer.
- Detail endpoints return `404 not_found` for unreadable rituals (no existence leaks).

### Blocks
- Blocked pairs do not see each other in docks/responses (best-effort).

### Lifecycle controls
- `proposed → warming → active → archived`
- Expired/archived rituals cannot be **responded** to or **ignited** (fail closed).

## Throttling (rate limits)

Ritual endpoints use DRF scoped throttling:
- `backend/siddes_backend/throttles.py`
- `backend/siddes_backend/settings.py`

Scopes (defaults): see `docs/THROTTLING.md`.

## Alignment cycles (build order)

- **Cycle 1 (sd_336):** DB scaffold + read-only list
- **Cycle 2 (sd_337):** propose / ignite / respond endpoints + Next proxies
- **Cycle 3 (sd_338):** Ritual Dock UI + sheets
- **Cycle 4 (sd_339):** Public Town Hall (Gavel) + UI polish
- **Cycle 5 (sd_340):** safety hardening + throttles + leak attempts

## Verification

Static checks:
- `bash scripts/run_tests.sh` (runs `scripts/checks/*`)

Dynamic leak attempts (requires backend running):
- `VIEWER=me VIEWER2=close bash scripts/dev/rituals_privacy_smoke.sh`

