# Push Backend Wiring Guide
**Updated:** 2026-01-09

This doc explains how to wire push persistence into Django once the backend is ready.

---

## 1) Model
Create a Django model like:

- user FK
- endpoint (indexed)
- p256dh
- auth
- raw JSON
- timestamps

Key rule: dedupe by (user_id, endpoint)

---

## 2) Endpoints
- POST /api/push/subscribe
- POST /api/push/unsubscribe
- POST /api/push/send (admin/internal)
- GET /api/push/vapid (optional; Next currently serves it)

---

## 3) Web push send library
Use `pywebpush` or equivalent.

Inputs:
- subscription info (endpoint + keys)
- VAPID private key
- payload JSON

---

## 4) Payload schema (locked v0)
- title, body, url, side, glimpse (+ optional icon/image)

---

## 5) Security
- subscribe/unsubscribe require auth
- rate-limit
- never allow clients to trigger /send

---

## 6) Local test
Use `scripts/dev/push_store_demo.py --selftest` to validate logic without a DB.
