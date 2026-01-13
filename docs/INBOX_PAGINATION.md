# Inbox pagination (backend_stub)

Backend stub inbox threads endpoint supports basic cursor pagination.

## Endpoint
`GET /api/inbox/threads`

## Query params
- `viewer` (deprecated): viewer identity token (prefer cookie `sd_viewer` or header `x-sd-viewer`)
- `side` (optional): filter to a single lockedSide
- `limit` (optional): number of items (default 20, max 50)
- `cursor` (optional): opaque cursor token from previous response

## Response
```json
{
  "ok": true,
  "viewer": "me",
  "role": "me",
  "side": null,
  "count": 20,
  "items": [...],
  "hasMore": true,
  "nextCursor": "1700000000000:t_work2"
}
```

## Cursor format
Current stub cursor is `"<updatedAt>:<id>"` (opaque for clients).

## Notes
- Cursor ordering is by `updatedAt DESC`, then `id DESC`.
- If you pass a cursor that can’t be parsed, the endpoint behaves like no cursor.
