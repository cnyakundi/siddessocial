"""API stub for /api/contacts/match (framework-agnostic).

Request (v0):
{
  "identifiers": ["+2547...", "someone@example.com"]
}

Server steps:
1) Require explicit consent (user taps "Sync Contacts")
2) Normalize identifiers defensively:
   - email -> lowercase/trim
   - phone -> E.164 (best-effort)
3) Tokenize:
   - token = HMAC_SHA256(pepper, normalized_identifier)
4) Match tokens against stored verified identity tokens (DB query)
5) Return matched users only
6) Discard raw contact payload (do not store)

Response (v0):
{
  "matches": [
    {"user_id": "123", "handle": "@marc_us", "display_name": "Marcus"}
  ]
}

Integration notes:
- Django Ninja: router.post("/contacts/match")
- DRF: APIView / Serializer
- Store identity tokens in a table keyed by token + type + verified_at
"""
