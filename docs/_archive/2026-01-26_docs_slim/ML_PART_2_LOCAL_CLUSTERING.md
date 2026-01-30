# ML Part 2 — On-Device Local Clustering v2 (Token Similarity)

Goal: reduce onboarding "clerical work" by generating **Suggested Circles** locally (browser/on-device)
from *safe match results* — without sending private context to the server.

This version extends the existing high-precision anchors (Work domain + surname) with a cheap
**keyword clustering** step that can surface groups like "Alumni", "Choir", "Startup", etc when signal exists.

## Inputs
From `POST /api/contacts/match` we use the safe subset:
- `handle`
- `display_name`
- `hint.domain` + `hint.workish`

## Output
A list of `SuggestedCircle` objects:
- `label`, `members[]`, `side`, `color`, `reason`, `id`

Server only receives the final accepted Circle via `POST /api/circles`.

## Pipeline
1) Work clusters (high precision)
   - group by workish email domain
2) Close clusters (high precision)
   - conservative surname grouping
3) Token clusters (medium precision, cheap)
   - build tokens from display_name + handle
   - compute global token frequency
   - link people by:
     - shared rare-strong tokens (freq <= 3, len >= 4), and
     - shared rare token pairs (top-2 rarity signature)
   - keep only clusters size >= 2
   - cap clusters to avoid noise (max 3)
4) Friends catchall
   - keep onboarding moving

## Guardrails
- suggestions only (never auto-apply)
- stable ids (deterministic hash) so accept/skip persists locally
- do not create "everyone" clusters
- keep cluster count small to remain calm

## Upgrade path
Later we can replace token clustering with on-device embeddings (Transformers.js / onnxruntime-web),
but the privacy boundary stays:
**personal context stays on-device; server ML is for platform-wide/public cases only.**
