# Migration Pack

This file exists so overlay/tooling verification can reliably find the expected docs scaffold.

## What is a Migration Pack?
A Migration Pack is a small, versioned set of changes that upgrades project structure, tooling, and/or conventions
without being tied to a single product feature.

## How we use it in Siddes
- Keep changes small and reversible
- Always include apply-helper instructions
- Run: ./verify_overlays.sh and the relevant scripts/checks/*.sh
- Document outcomes in docs/STATE.md

## Typical contents
- Docs scaffolding updates
- Scripts/checks additions
- One-time codemods
- Deprecation notes and cleanup guidance
