# Privacy & Security (contact hashing + enforcement)
**Updated:** 2026-01-09

## Side privacy (server-side)
- Posts have `side_id`
- Feeds enforce membership rules on the server
- No “private post counts” leak to non-members

## Contact matching (WhatsApp DNA) — v0
We do not store raw address books.

### Normalize
- phone → E.164 (libphonenumber)
- email → lowercase+trim

### Tokenize
Server stores only:
- `token = HMAC_SHA256(server_pepper, normalized_identifier)`

### Match
- client submits normalized identifiers after consent
- server tokenizes on receipt and matches tokens
- server discards raw payload immediately

## Abuse controls
- verified accounts only
- rate limits and batching
- audit logs

## Roadmap
PSI/OPRF-based matching (server never sees raw identifiers).
