# Phase 2.14 — Invites + Contacts Spider Pack (Siddes)

This pack maps the **Invite** subsystem (Set invites) and the **Contacts** subsystem (contact matching + suggestions) end‑to‑end:

**UI surfaces → client providers → Next API proxy routes → Django/DRF endpoints → DB models/stores**.

No logic critique or fixes here — only **structural DNA**: files, contracts, and connection points.

---

## 1) Surface Map (User‑Visible Entry Points)

### 1.1 Invites
- **Invites Inbox (incoming/outgoing/all)**
  - **Path:** `frontend/src/app/siddes-invites/page.tsx`
  - **Purpose:** List invites and perform actions (accept/reject/revoke) via provider.

- **Invite Detail / Action page**
  - **Path:** `frontend/src/app/invite/[id]/page.tsx`
  - **Purpose:** Load a single invite and allow accept/reject/revoke.

- **Create invite from Set detail**
  - **Path:** `frontend/src/app/siddes-sets/[id]/page.tsx`
  - **Purpose:** Open `InviteActionSheet` to send Set invites.

### 1.2 Contacts (used by multiple flows)
- **Onboarding: contact match**
  - **Path:** `frontend/src/app/onboarding/page.tsx`
  - **Purpose:** User pastes identifiers → `/api/contacts/match` returns matches; local on-device clustering suggests Sets.

- **Import Set flow: contacts suggestions**
  - **Path:** `frontend/src/components/ImportSetSheet.tsx`
  - **Purpose:** `/api/contacts/suggestions` provides a DB-backed list of people (dev-mode) for set creation + suggestions.

- **Inbox thread: mention candidates**
  - **Path:** `frontend/src/app/siddes-inbox/[id]/page.tsx`
  - **Purpose:** `/api/contacts/suggestions` provides candidates for @mention UI.

- **Set invite suggestions**
  - **Path:** `frontend/src/lib/inviteSuggestions.ts`
  - **Purpose:** Uses `/api/contacts/suggestions` to generate “who to invite” handle pool.

---

## 2) Frontend Building Blocks

### 2.1 UI Components
- **InviteActionSheet**
  - **Purpose:** Modal sheet to send a Set invite.
  - **State dependencies:** `useState`, `useEffect`, `useMemo` (provider), local validation.
  - **Path:** `frontend/src/components/Invites/InviteActionSheet.tsx`

- **InviteList**
  - **Purpose:** Simple list renderer of invites.
  - **State dependencies:** none (stateless).
  - **Path:** `frontend/src/components/Invites/InviteList.tsx`

### 2.2 Client Provider Layer (single source of truth for UI)
- **Invite types + provider interface**
  - **Purpose:** Defines `SetInvite` contract + provider methods.
  - **Path:** `frontend/src/lib/inviteProvider.ts`

- **Invite provider implementation (backend_stub)**
  - **Purpose:** Calls same-origin Next API routes (`/api/invites*`) and coerces JSON into `SetInvite`.
  - **Side effect:** On `accept`, emits `emitSetsChanged()` so Sets UI can refetch.
  - **Path:** `frontend/src/lib/inviteProviders/backendStub.ts`

### 2.3 Contacts helpers used by Invites
- **Invite suggestion handles**
  - **Purpose:** `GET /api/contacts/suggestions` → normalize + dedup + exclude current members.
  - **Path:** `frontend/src/lib/inviteSuggestions.ts`

---

## 3) Next.js API Layer (Route Handlers)

These are the same-origin **proxy endpoints** the UI calls.

### 3.1 Invites
- **`/api/invites`** (list + create)
  - **Paths:**
    - `frontend/src/app/api/invites/route.ts` (GET, POST)
  - **Proxy target:** Django `/api/invites`

- **`/api/invites/:id`** (read + action)
  - **Paths:**
    - `frontend/src/app/api/invites/[id]/route.ts` (GET, PATCH)
  - **Proxy target:** Django `/api/invites/<invite_id>`

### 3.2 Contacts
- **`/api/contacts/match`**
  - **Path:** `frontend/src/app/api/contacts/match/route.ts` (POST)
  - **Proxy target:** Django `/api/contacts/match`

- **`/api/contacts/suggestions`**
  - **Path:** `frontend/src/app/api/contacts/suggestions/route.ts` (GET)
  - **Proxy target:** Django `/api/contacts/suggestions`

### 3.3 Shared proxy plumbing
- **proxyJson / cookie forwarding / CSRF**
  - **Path:** `frontend/src/app/api/auth/_proxy.ts`

---

## 4) Backend API Layer (Django / DRF)

### 4.1 Invites API
- **URLConf**
  - **Path:** `backend/siddes_invites/urls.py`
  - **Routes:**
    - `GET/POST  /api/invites`
    - `GET/PATCH /api/invites/<invite_id>`

- **Views**
  - **Path:** `backend/siddes_invites/views.py`
  - **Viewer gating:**
    - Viewer identity comes from DRF auth.
    - In DEBUG, dev viewer may be supplied via `x-sd-viewer` or `sd_viewer` cookie.

- **Store**
  - **Path:** `backend/siddes_invites/store_db.py`
  - **Notes:** On accept, the store updates Set membership and emits a Set history event.

- **Model**
  - **Path:** `backend/siddes_invites/models.py` (`SiddesInvite`)

### 4.2 Contacts API
- **URLConf**
  - **Path:** `backend/siddes_contacts/urls.py`
  - **Routes:**
    - `POST /api/contacts/match`
    - `GET  /api/contacts/suggestions`

- **Views**
  - **Path:** `backend/siddes_contacts/views.py`
  - **Important production rule:** `/api/contacts/suggestions` returns **empty list when `DEBUG=False`**.

- **Model**
  - **Path:** `backend/siddes_contacts/models.py` (`ContactIdentityToken`)

- **Tokenization**
  - **Path:** `backend/siddes_contacts/tokens.py`
  - **Pepper:** env var `SIDDES_CONTACTS_PEPPER` (dev fallback exists).

- **Normalization**
  - **Path:** `backend/siddes_contacts/normalize.py`
  - **Phone:** best-effort via `phonenumbers` if installed.

---

## 5) Data Contracts (Request / Response Shapes)

### 5.1 Invites — `SetInvite` (frontend canonical type)
**Type source:** `frontend/src/lib/inviteProvider.ts`

```ts
export type SetInvite = {
  id: string;
  setId: string;
  setLabel?: string;
  side: "public"|"friends"|"close"|"work";
  from: string;
  to: string;
  status: "pending"|"accepted"|"rejected"|"revoked";
  message?: string;
  createdAt: number; // ms
  updatedAt: number; // ms
};
```

### 5.2 Invites — List
**UI caller:** `InviteProvider.list()` → `GET /api/invites?direction=incoming|outgoing|all`

**Backend response:**
```json
{
  "ok": true,
  "restricted": false,
  "viewer": "me_123",
  "role": "me",
  "items": [ /* SetInvite-like */ ]
}
```

**Restricted GET behavior (no viewer):**
```json
{ "ok": true, "restricted": true, "viewer": null, "role": "anon", "items": [] }
```

### 5.3 Invites — Create
**UI caller:** `InviteProvider.create()` → `POST /api/invites`

**Request JSON:**
```json
{ "setId": "set_...", "side": "friends", "to": "@jordan", "message": "..." }
```

**Backend response:**
```json
{ "ok": true, "restricted": false, "viewer": "me_123", "role": "me", "item": { /* SetInvite */ } }
```

### 5.4 Invites — Detail
**UI caller:** `InviteProvider.get(id)` → `GET /api/invites/:id`

**Response JSON:**
```json
{ "ok": true, "restricted": false, "viewer": "me_123", "role": "me", "item": { /* SetInvite */ } }
```

### 5.5 Invites — Action (accept/reject/revoke)
**UI caller:** `InviteProvider.act(id, action)` → `PATCH /api/invites/:id`

**Request JSON (preferred):**
```json
{ "action": "accept" }
```

**Also accepted by backend:** `{ "status": "accepted" }` (and rejected/revoked variants)

**Response JSON:**
```json
{ "ok": true, "restricted": false, "viewer": "me_123", "role": "me", "item": { /* SetInvite */ } }
```

**Forbidden action (server-enforced):** returns 403 with `{"ok":false,"restricted":true,"error":"restricted"}`.

### 5.6 Contacts — Match
**UI caller:** onboarding → `POST /api/contacts/match`

**Request JSON:**
```json
{ "identifiers": ["alice@gmail.com", "+2547...", "0700..."] }
```

**Response JSON:**
```json
{
  "ok": true,
  "matches": [
    {
      "user_id": "me_77",
      "handle": "@alice",
      "display_name": "alice",
      "hint": { "kind": "email", "domain": "example.com", "workish": true }
    }
  ]
}
```

### 5.7 Contacts — Suggestions
**Call sites:** `ImportSetSheet`, inbox mentions, invite suggestions.

**Response JSON in DEBUG:**
```json
{
  "ok": true,
  "items": [
    { "id": "u12", "name": "jordan", "handle": "@jordan", "matched": true }
  ]
}
```

**Response JSON when `DEBUG=false` (production-safe):**
```json
{ "ok": true, "items": [] }
```

---

## 6) Guardrails & Enforcement Points (Structural)

### 6.1 Auth gating
- Contacts endpoints require authenticated session:
  - `backend/siddes_contacts/views.py` returns **401** when unauthenticated.
- Invites:
  - GET returns `{restricted:true}` payload if no viewer.
  - POST/PATCH return **401/403** if restricted.

### 6.2 Production directory protection
- `/api/contacts/suggestions` returns empty list when `settings.DEBUG` is false.
  - **Path:** `backend/siddes_contacts/views.py`

### 6.3 Invite accept side-effects (membership)
On accept, backend updates Set membership and emits Set history:
- Add recipient handle to `SiddesSet.members`
- Best-effort sync membership table (`SiddesSetMember.get_or_create`)
- Emit event `SiddesSetEvent(kind=MEMBERS_UPDATED, data={from,to,via,inviteId})`
  - **Path:** `backend/siddes_invites/store_db.py`

### 6.4 Frontend refetch signaling
- After `accept`, client emits `emitSetsChanged()`
  - **Path:** `frontend/src/lib/inviteProviders/backendStub.ts`

---

## 7) Third‑Party Tissue (Where external deps hook in)

### 7.1 Frontend
- **lucide-react** icons
  - Invites UI: `Check`, `X`, `RefreshCcw` (and others)
  - **Paths:** `frontend/src/app/siddes-invites/page.tsx`, `frontend/src/components/Invites/InviteActionSheet.tsx`

### 7.2 Backend
- **Django + DRF**
  - APIView + Response + throttle scopes
  - **Paths:** `backend/siddes_invites/views.py`, `backend/siddes_contacts/views.py`

- **HMAC SHA-256 tokenization**
  - **Path:** `backend/siddes_contacts/tokens.py`

- **phonenumbers** (optional)
  - Used if installed for E.164 parsing
  - **Path:** `backend/siddes_contacts/normalize.py`

- **siddes_ml seeding hook** (optional, env-flagged)
  - Controlled by `SIDDES_ENABLE_SERVER_SUGGESTIONS`
  - **Path:** `backend/siddes_contacts/views.py`

---

## 8) Key Cross‑Links (the “Spider threads”)

- **Contacts suggestions → Invite suggestions**
  - `frontend/src/lib/inviteSuggestions.ts` consumes `/api/contacts/suggestions`.

- **Invite accept → Sets membership + Sets UI refresh**
  - Backend: `backend/siddes_invites/store_db.py` mutates membership + events.
  - Frontend: `emitSetsChanged()` from invite provider.

- **Contacts match → On-device clustering → Suggested Sets**
  - Frontend onboarding: `frontend/src/app/onboarding/page.tsx` calls match → feeds `onDeviceContextEngine`.


