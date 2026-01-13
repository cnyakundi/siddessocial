
---

## 10) Django wiring example (stub)
See:
- `backend/siddes_contacts/endpoint_stub.py` (framework-agnostic handler)
- `backend/siddes_contacts/django_view_example.py` (example Django view)

Wiring steps (Django):
1) Add a URL route: POST `/api/contacts/match`
2) Authenticate user
3) Query identity tokens by token IN (...)
4) Call `contacts_match(identifiers, known_tokens)`
5) Return matches JSON
6) Do not store raw identifiers
