# Migration Master Prompt (sd_152h)
**Updated:** 2026-01-26

This is the master prompt we use when generating “migration packs” and big refactors.

Non‑negotiables:
- **Tumblr-width** layouts for feed/post reading on desktop (readable line length; no edge-to-edge walls of text).
- Prefer small, reversible batches.
- Always preserve Siddes core laws (Side isolation; server-enforced privacy).

## Strategy
### kill stubs
When a feature has “stub” code paths, we do not leave them half‑alive.
Plan the migration so we can **kill stubs** decisively:
- add real implementation behind a flag
- migrate callers
- remove the stub path once tests/gates are green
