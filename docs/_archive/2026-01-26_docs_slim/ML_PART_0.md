# ML Part 0 — Clerkless Context Engine (Contacts → Sides → Circles)
**Updated:** 2026-01-19

Siddes lives or dies on one thing: **Context Safety without clerical work.**

If people must manually classify every contact like a spreadsheet, Siddes becomes “Google+ Circles with homework.”

This document defines the **Clerkless Context Engine (CCE)**: a privacy-safe, low-cost AI/ML system that *suggests* where people belong (Friends / Close / Work) and how they cluster into Circles — while keeping the user in control.

---

## Non-negotiables

1) **Suggest-only by default**
- The engine may recommend, highlight, prefill.
- It must **never silently move someone** into a Side/Circle.
- Any “Auto-accept” is an explicit user setting with undo.

2) **No raw address books stored**
- Server stores only HMAC tokens (and optional short hints for dev).
- Raw identifiers are discarded immediately after matching.

3) **No cross-user leakage**
- No “who is in your contacts” inference.
- No showing mutual contact proof.
- Strong rate limits + abuse controls.

4) **Server-side privacy remains the truth**
- Side enforcement stays server-side.
- A suggestion can’t override visibility rules.

---

## Why this prevents “platform death”
Social products die when they fail one of these:
- **Cold start:** empty graph → no habit.
- **Friction:** too much setup → bounce.
- **Trust:** users feel unsafe → churn.
- **Culture:** creators don’t get value → they leave.

CCE is a survival engine because it:
- **Fixes cold start**: quickly forms a usable Friends graph and starter Circles.
- **Kills friction**: users accept 3–10 suggestions instead of doing 300 clicks.
- **Builds trust**: explicit control + reversible actions + privacy-safe matching.
- **Builds a moat**: “context safety at scale” is harder to copy than a single feature.

---

## What other giants do (and what we borrow)

### WhatsApp
- Treats the address book as the graph.
- Segmentation is *conversation-level* (groups) and “broadcast lists” for one-to-many messaging.
- Recently added chat organization helpers like custom “Lists” (work/family/etc.)

**Borrow:** the *flat* mental model (don’t force taxonomy early), plus lightweight “lists” as an organizing layer.

### Signal
- Uses privacy-preserving contact discovery and increasingly supports username-based connections.

**Borrow:** “private contact discovery” mindset — matching should not become a surveillance feature.

### Telegram
- Organizes via chat folders, pinning, archived chats.

**Borrow:** “folders as calm filters,” not dashboards.

**Key difference:** Those products are primarily chat/conversation-based, which naturally separates contexts. Siddes is feed-based “rooms,” so we must provide the missing segmentation — but without homework.

---

## The Clerkless Context Engine (CCE)

### Core jobs
1) **Candidate discovery** (who might matter)
2) **Side suggestion** (Friends vs Close vs Work)
3) **Circle clustering** (sub-groups inside a Side)
4) **Reasoning + explanation** (why we think so)
5) **Feedback loop** (learn from accept/reject)

### Inputs (privacy-first)
We prefer signals that are already “within Siddes” and avoid raw personal data.

**A) Contact matching (existing DNA)**
- Client submits identifiers after consent → server hashes and matches → returns “these users exist.”

**B) In-app interaction signals**
- likes/echo/replies/mentions
- profile visits
- follow/close/friend/work actions
- time/recency patterns

**C) Lightweight metadata (optional, user-consented)**
- user-labeled tags ("coworker", "family")
- email domain (work-ish) as a derived feature
- calendar meeting co-attendance (only if user enables)

**Never required:** importing the entire address book payload into the backend.

---

## Phase plan (cheap → smart → personalized)

### Phase 0 (now): Rules + thresholds (no ML training)
Goal: ship real value with zero infra.

**Side suggestion rules (examples):**
- If a matched contact’s handle/name includes work markers ("pm", "dev", "design") AND user confirms once → suggest Work for similar contacts.
- If email domain matches user’s verified work domain (optional) → suggest Work.
- High interaction intensity + “late night + weekend” patterns → suggest Close.

**Circle suggestion rules (examples):**
- Cluster by “frequently co-mentioned together”
- Cluster by “often co-present in the same threads”

Output: suggestions with confidence + human-readable reasons.

### Phase 1: Embeddings + clustering (still cheap)
Goal: better Circle quality without training big models.

- Create embeddings from *non-sensitive* text (handles, bios, user-provided labels)
- Cluster embeddings (HDBSCAN/k-means)
- Use interaction graph as constraints (“must-link / cannot-link”)

### Phase 2: Personalized lightweight classifier
Goal: get “your brain” without giant cost.

- Train per-user (or per-cohort) logistic regression / gradient boosting
- Labels come from user accept/reject actions
- Features are derived + privacy-safe

### Phase 3: Optional LLM “edge-case assistant”
Goal: handle rare, messy cases + write reasons.

- Use LLM only when:
  - confidence is low, and
  - user asks “why?” or “help decide”, and
  - inputs are scrubbed/minimized.

---

## Storage model (proposed)

Create a small backend app (future): `backend/siddes_ml/`

### Tables
**MlSuggestion**
- user_id
- kind: `side_assignment` | `set_cluster` | `compose_intent`
- payload (JSON): e.g. {"target_user_id":"u12","suggested_side":"work"}
- score (0..1)
- reason_code (string) + reason_text (safe)
- status: `new` | `accepted` | `rejected` | `dismissed`
- model_version
- created_at / updated_at

**MlFeedback**
- suggestion_id
- action: accept/reject/undo
- optional user_note

This keeps AI explainable and auditable.

---

## UX surfaces (where suggestions appear)

1) **Onboarding**
- After contact match:
  - “We found 8 people. Want to put them into rooms?”
  - Offer 2–3 bundles: “Likely Work (5)”, “Likely Friends (3)”
  - Accept / review / skip.

2) **Circles creation flow** (already exists)
- After sync, show Suggested Circles (accept/rename/skip)
- Never auto-create without a tap.

3) **Butler Tray: Context tab**
- “You have 3 people who look like Work. Review?”
- “This Circle looks too big. Split suggestion?”

4) **Compose**
- Use existing “Compose Intelligence” bar to suggest Side/Circle.

---

## Execution in our usual scripts (how this will run)

### Dev scripts (proposed)
We will add these as we implement CCE:

1) `scripts/dev/ml_refresh_suggestions.sh`
- Runs the suggestion engine against current DB data.
- Prints counts and writes MlSuggestion rows.

2) `scripts/dev/ml_selftest.sh`
- Seeds a tiny universe and validates:
  - no cross-user leakage
  - suggestions are per-user
  - accept/reject flows update status

3) `scripts/dev/ml_demo_report.py`
- Generates a human-readable summary for a given user:
  - top side suggestions
  - top set clusters
  - confidence + reasons

### Production execution (later)
- Event-driven refresh:
  - on contact-match completion
  - on new interaction bursts
  - nightly compact job (low priority)

- Scheduler options:
  - Celery beat / cron inside backend container

---

## Guardrails & abuse resistance
- Rate limit `/api/contacts/match`
- Add “verified account” requirement for large match batches
- Log match attempts (counts only)
- Never reveal which identifier matched (only the account that matched)
- Consider PSI/OPRF upgrade (server doesn’t see raw identifiers)

---

## Definition of Done for CCE Phase 0
1) User can accept a suggested Side placement for matched contacts.
2) User can accept suggested Circles from matched contacts.
3) Every suggestion has a visible reason.
4) Everything is undoable.
5) No raw contact book is stored.
6) Smoke tests pass.

---

## Naming (internal)
- Engine: **CCE (Clerkless Context Engine)**
- Outputs: **Suggestions**
- UI home: **Butler Tray → Context**

