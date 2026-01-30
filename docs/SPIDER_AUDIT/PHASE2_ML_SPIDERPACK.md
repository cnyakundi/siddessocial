# Phase 2.15 - ML (Local Intelligence + Server Suggestions)

This Spider Pack maps Siddes' **ML tissue** as it exists in this repo:

1) **Local-first (on-device) “Context Engine”** that turns contact matches into *Suggested Circles* (review-first, user-controlled).
2) **Server-side ML Suggestions** store + endpoints (`/api/ml/suggestions`) that can optionally drive similar suggestions and capture feedback.

Scope: **structural + data-contract mapping only** (no logic critique, no fixes).

---

## 0) Topology (one-screen mental model)

### A) Local-first Circle Suggestions (current primary path)
1. User provides identifiers during onboarding (emails/phones) → `POST /api/contacts/match`
2. Response returns `matches[]` (safe handles + derived hints)
3. Frontend runs `suggestSetsFromMatches(matches)` **on-device**
4. User reviews in `SuggestedCirclesSheet`
5. Accept creates real Circles via `POST /api/circles` (single or bulk)
6. Local ledger/cache prevents repeat nagging

### B) Server-side Suggestion Store (available, lightly wired)
1. Backend creates `MlSuggestion` rows (via seed + command + future pipelines)
2. Client can read: `GET /api/ml/suggestions?status=new`
3. User action: `POST /api/ml/suggestions/<id>/<accept|reject|dismiss>`
4. Backend records `MlFeedback`; for `kind=set_cluster`, **accept** can create a real Circle via `DbSetsStore`

---

## 1) Frontend: Local Intelligence Engine

### 1.1 SuggestedCircle type (frontend contract)
- File: `frontend/src/lib/setSuggestions.ts`
- Type:
  ```ts
  export type SuggestedCircle = {
    id: string;
    label: string;
    side?: SideId;
    color: CircleColor;
    members: string[]; // handles
    reason: string;
  };
  ```

### 1.2 “No mock suggestions” shim
- File: `frontend/src/lib/setSuggestions.ts`
- Function: `getSuggestedCircles()` now returns `[]` and points callers to the on-device engine.

### 1.3 On-device Context Engine
- File: `frontend/src/lib/localIntelligence/onDeviceContextEngine.ts`
- Exports:
  - `suggestSetsFromMatches(matches: ContactMatch[]): SuggestedCircle[]`
  - `MAX_MEMBERS_PER_SUGGESTION = 24`
  - `MAX_TOTAL_SUGGESTIONS = 8`
- ContactMatch shape:
  ```ts
  export type ContactMatch = {
    handle: string;
    display_name: string;
    hint?: {
      kind?: string | null;
      domain?: string | null;
      workish?: boolean;
    };
  };
  ```

#### 1.3.1 Cluster “families” (what it generates)
The engine creates `SuggestedCircle[]` with stable deterministic ids:
- `local_work_*` (Work) – shared work-ish domain
- `local_family_*` (Close) – shared surname heuristic
- `local_cluster_*` (Friends) – token clustering of names/handles
- `local_friends_*` (Friends) – catch-all from remaining matches

#### 1.3.2 Side + color coercion
- Side is derived from the suggestion color when missing (`slate->work`, `rose->close`, `blue->public`, default `emerald->friends`).

#### 1.3.3 DEV-only debug
- The engine logs **counts-only** debug (`console.debug`) on localhost/127.0.0.1.

### 1.4 Local persistence: cache + ledger

#### 1.4.1 Suggested Circles cache (per viewer key)
- File: `frontend/src/lib/localIntelligence/localSuggestedCirclesCache.ts`
- Storage key prefix: `siddes.suggested_sets.cache.v1:<viewerKey>`
- Stores:
  - `ts` (Date.now)
  - `suggestions[]` (deduped by id)

#### 1.4.2 Suggestion ledger (accepted/dismissed IDs only)
- File: `frontend/src/lib/localIntelligence/localSuggestionLedger.ts`
- Storage key prefix: `siddes.local_suggestions.v1:<viewerKey>`
- Stores only:
  - `accepted: { [suggestionId]: timestamp }`
  - `dismissed: { [suggestionId]: timestamp }`
- APIs:
  - `isSuggestionSuppressed(viewerKey,id)`
  - `markSuggestionAccepted(viewerKey,id)`
  - `markSuggestionDismissed(viewerKey,id)`
  - `clearSuggestionDecision(viewerKey,id)`

---

## 2) Frontend Surfaces that “consume ML”

### 2.1 Onboarding contact-match → local suggestions
- Route: `frontend/src/app/onboarding/page.tsx`
- Calls:
  - `POST /api/contacts/match { identifiers: string[] }`
  - `suggestSetsFromMatches(rawMatches)`
  - filters via `isSuggestionSuppressed(viewerKey, s.id)`
  - caches via `saveSuggestedCirclesCache(viewerKey, filtered)`
- Accept path:
  - single: `POST /api/circles { side,label,members,color }`
  - bulk: `POST /api/circles { inputs: [...] }`

### 2.2 Import Circle flow: contact suggestions → local suggestions
- Component: `frontend/src/components/ImportCircleSheet.tsx`
- Calls:
  - `GET /api/contacts/suggestions`
  - builds `matchedContactMatches[]`
  - `suggestSetsFromMatches(matchedContactMatches)`
  - opens `SuggestedCirclesSheet`

### 2.3 Review-first suggestions UI
- Component: `frontend/src/components/SuggestedCirclesSheet.tsx`
- Purpose: review/edit suggestions **before** creating real sets.

Key behaviors (structural):
- Supports overrides per suggestion:
  - rename label
  - change Side + auto-color
  - remove members
- Guardrail: “personal” suggestions (local/on-device) **cannot be Public** (disabled Public selection)
- Batch actions:
  - `Accept valid (N)` / `Skip all`

Telemetry hooks:
- Calls `sdTelemetry()` events:
  - `suggestion_shown`
  - `suggestion_accepted`
  - `suggestion_skipped`
  - `suggestion_edited`
- File: `frontend/src/lib/telemetry/sdTelemetry.ts`

---

## 3) Next.js API layer (ML)

### 3.1 GET suggestions proxy
- File: `frontend/src/app/api/ml/suggestions/route.ts`
- Endpoint: `GET /api/ml/suggestions?kind=&status=`
- Proxies to Django: `GET /api/ml/suggestions` (+ querystring)

### 3.2 POST action proxy
- File: `frontend/src/app/api/ml/suggestions/[id]/[action]/route.ts`
- Endpoint: `POST /api/ml/suggestions/<id>/<accept|reject|dismiss>`
- Proxies to Django: `POST /api/ml/suggestions/<id>/<action>`

Both use:
- `proxyJson()` from `frontend/src/app/api/auth/_proxy.ts` (cookie forwarding, CSRF handling, request-id propagation).

---

## 4) Backend ML subsystem (Django)

### 4.1 Models
- File: `backend/siddes_ml/models.py`

#### MlSuggestion
- `id` (PK)
- `viewer_id` (string, *viewer token* like `me_<id>`, not FK)
- `kind` (enum)
  - `side_assignment` | `set_cluster` | `compose_intent`
- `payload` (JSON dict; safe/derived)
- `score` (0..1)
- `reason_code`, `reason_text`
- `status` enum: `new|accepted|rejected|dismissed`
- `model_version`
- `created_at`, `updated_at`

#### MlFeedback
- `suggestion` FK
- `viewer_id`
- `action`: `accept|reject|dismiss|undo`
- `note`
- `created_at`

### 4.2 Endpoints
- URLConf: `backend/siddes_ml/urls.py`
- Views: `backend/siddes_ml/views.py`

Endpoints:
- `GET  /api/ml/suggestions` → `MlSuggestionsView`
- `POST /api/ml/suggestions/<id>/<action>` → `MlSuggestionActionView`

### 4.3 Viewer identity + restriction model
- `_raw_viewer_from_request()` in `backend/siddes_ml/views.py`
  - production: uses authenticated Django session user → `me_<id>`
  - debug: may accept `x-sd-viewer` header or `sd_viewer` cookie
- `_viewer_ctx()` returns `(has_viewer, viewer, role)` using:
  - `siddes_backend.identity.viewer_aliases(viewer)`
  - `siddes_inbox.visibility_stub.resolve_viewer_role(viewer)`

### 4.4 Action side effects: accept can create Circles
For `kind=set_cluster`, `accept` triggers:
- `DbSetsStore().create(owner_id=viewer, side, label, members, color)`
- attaches `createdCircleId` into the suggestion payload on success

---

## 5) Data contracts

### 5.1 Backend: GET `/api/ml/suggestions`
Response shape:
```json
{
  "ok": true,
  "restricted": false,
  "viewer": "me_12",
  "role": "me",
  "count": 3,
  "items": [
    {
      "id": "mls_...",
      "viewer": "me_12",
      "kind": "set_cluster",
      "payload": { "side": "work", "label": "Acme Team", "color": "slate", "members": ["@a", "@b"] },
      "score": 0.78,
      "reasonCode": "shared_domain",
      "reasonText": "Shared email domain (acme.com)",
      "status": "new",
      "modelVersion": "contacts_match_v0",
      "createdAt": 1730000000000,
      "updatedAt": 1730000000000
    }
  ]
}
```
Restricted (no viewer) returns:
```json
{ "ok": true, "restricted": true, "viewer": null, "role": "anon", "items": [] }
```

### 5.2 Backend: POST `/api/ml/suggestions/<id>/<action>`
- Requires viewer + role `me`
- Returns:
```json
{ "ok": true, "item": { /* same item shape as above */ } }
```
Errors:
- `401/403` for restricted
- `404` for not_found
- `409` for `set_create_failed` (accept on set_cluster)

### 5.3 Local suggestions (on-device) → Circles creation
- Accept (single): `POST /api/circles` with `{ side,label,members,color }`
- Accept (bulk): `POST /api/circles` with `{ inputs: [...] }`

---

## 6) Operational / dev tooling

### 6.1 Seed helper for suggestions
- File: `backend/siddes_ml/seed.py`
- Function: `seed_from_contact_matches(viewer_id, match_rows, model_version)`
  - creates `set_cluster` suggestions (work domain, colleagues, starter crew)

### 6.2 Management command (dev)
- File: `backend/siddes_ml/management/commands/ml_refresh_suggestions.py`
- Command: `python manage.py ml_refresh_suggestions --viewer auto --reset`

---

## 7) Third-party tissue

Frontend:
- No external ML libs; this is deterministic JS + localStorage.

Backend:
- Django + DRF
- Uses DB transactions and JSONField for suggestion payloads.

---

## 8) File index (complete inventory for this subsystem)

### Frontend (local intelligence)
- `frontend/src/lib/setSuggestions.ts`
- `frontend/src/lib/localIntelligence/onDeviceContextEngine.ts`
- `frontend/src/lib/localIntelligence/localSuggestedCirclesCache.ts`
- `frontend/src/lib/localIntelligence/localSuggestionLedger.ts`
- `frontend/src/components/SuggestedCirclesSheet.tsx`
- `frontend/src/components/ImportCircleSheet.tsx`
- `frontend/src/app/onboarding/page.tsx`

### Frontend (Next ML routes)
- `frontend/src/app/api/ml/suggestions/route.ts`
- `frontend/src/app/api/ml/suggestions/[id]/[action]/route.ts`
- `frontend/src/app/api/auth/_proxy.ts`

### Backend
- `backend/siddes_ml/models.py`
- `backend/siddes_ml/views.py`
- `backend/siddes_ml/urls.py`
- `backend/siddes_ml/seed.py`
- `backend/siddes_ml/management/commands/ml_refresh_suggestions.py`

