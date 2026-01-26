# Compose Intelligence Engine (Side/Set suggestions as you type)
**Updated:** 2026-01-09

## Goal
As the user types, Siddes suggests the correct:
- Side (Work/Friends/Close/Public)
- Set (Gym Squad, Colleagues, etc.)
- Context chips (Urgent, Doc, Mention)

Principle: **suggest only**. Never auto-switch or auto-tag.

## UX
A slim suggestion bar above the composer:
- Suggested: Work (tap to switch)
- Suggested: Gym Squad (tap to apply)
- Urgent (tap to add chip)

## v0 Implementation
- Rules engine + confidence thresholds
- Show suggestions only above threshold (avoid spam)
- No LLM required for v0

## v1 Implementation
- embeddings similarity vs user history
- optional LLM fallback only when needed and privacy-safe

## Testing
- Unit tests for rules (inputs → expected suggestions)
- E2E test: type a work phrase → suggestion appears → tap applies Side
