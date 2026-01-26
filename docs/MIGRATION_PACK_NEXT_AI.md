# Migration Pack — Next AI (sd_152h)
**Updated:** 2026-01-26

This file exists because some checks expect a dedicated “next AI” migration pack scaffold.

## Layout spec
- Desktop reading should be **Tumblr-width** (comfortable measure; not full-bleed).

## Strategy
### Kill stubs
- Add real implementation behind a flag
- Migrate callers incrementally
- Remove stub paths once gates pass (no zombie branches)
