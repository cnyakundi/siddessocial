# ML Part 1 — On-Device Intelligence (Personal Brain)
**Updated:** 2026-01-19

Siddes must win where other social products died:
- **No clerical work** (no “taxonomy homework”)
- **No trust violations** (no private graph harvesting)
- **Fast cold-start** (people + Sets appear quickly)

This document defines a strict architecture boundary:

## The Two-Lane Brain

### Lane A — Personal Brain (ON-DEVICE)
Runs on the user’s device (browser/PWA now; native later). Handles anything that would otherwise feel like “contact spreadsheet work.”

**Examples (must be on-device):**
- Suggesting whether a matched person is likely **Work / Close / Friends**
- Clustering matched people into **Suggested Sets**
- Naming/labeling those clusters
- Explaining suggestions (“why this set?”)

**Rule:** raw personal signals do not need to leave the device.

### Lane B — Platform Brain (SERVER)
Runs on server-side data that is inherently platform-scoped.

**Examples (server is fine):**
- Public feed ranking
- Spam/abuse detection
- Public story clustering / broadcast summarization
- Editorial prompts and topic discovery

**Rule:** platform ML never requires your address book.

---

## Privacy boundary (non-negotiable)

1) **No raw address books stored server-side**
- Contact matching remains tokenized (HMAC). The backend never stores the user’s raw pasted identifiers.

2) **On-device produces suggestions; server stores truth only after acceptance**
- The device computes Suggested Sets.
- When the user taps **Accept**, we create real Sets via `/api/sets`.

3) **Server “suggestion seeding” is opt-in only (dev/experiments)**
- Even derived hints can drift into “creepy” if overused.
- Default is OFF.

---

## Implementation in Siddes (sd_358)

### Backend
**File:** `backend/siddes_contacts/views.py`

- `/api/contacts/match` now returns per-match **safe derived hints**:
  - `hint.kind`: `email` | `phone`
  - `hint.domain`: email domain (if email)
  - `hint.workish`: whether the domain looks non-personal

- Server-side seeding of ML suggestions is guarded by:
  - `SIDDES_ENABLE_SERVER_SUGGESTIONS=1`

Default is **OFF**.

### Frontend
**Files:**
- `frontend/src/lib/localIntelligence/onDeviceContextEngine.ts`
- `frontend/src/lib/localIntelligence/localSuggestionLedger.ts`
- `frontend/src/app/onboarding/page.tsx`

Flow:
1) User pastes identifiers on `/onboarding`
2) We call `/api/contacts/match`
3) We compute Suggested Sets **on-device** (domain clusters, surname clusters, etc.)
4) The Suggested Sets sheet opens
5) **Accept** → POST `/api/sets` (real Set created)
6) **Skip** → stored locally (won’t nag again)

---

## How to run / verify

1) Apply overlay (sd_358)
2) Start dev:
- `docker compose -f ops/docker/docker-compose.dev.yml up`
- `cd frontend && npm run dev`

3) Visit:
- `http://localhost:3000/onboarding`

4) Paste 2+ identifiers that match existing accounts.

You should see:
- Matches list
- A “Suggested Sets” sheet generated **locally**

---

## Upgrade path: “real ML” on-device (next)

We will keep the same boundary and improve quality incrementally:

1) **Rules + heuristics (today)**
- Fast, cheap, zero dependencies.

2) **Embeddings in the browser**
- Use an on-device embedding model (WebGPU/WASM) to cluster labels/names/handles.
- Still no private data sent to a server.

3) **Optional tiny local LLM**
- Only for naming clusters and explaining low-confidence cases.

The boundary stays: **Personal Brain stays on-device.**
