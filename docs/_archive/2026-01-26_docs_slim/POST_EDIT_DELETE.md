# Siddes — Post Edit + Delete (sd_325)

This workstream adds **author-safe** post editing and deletion.

## Why an edit window?
Public edits can be abused for bait-and-switch. Siddes ships with a default edit window:
- **Public:** 15 minutes
- **Non-public:** 24 hours

Override via env:
- `SIDDES_POST_EDIT_WINDOW_PUBLIC_SEC` (default `900`)
- `SIDDES_POST_EDIT_WINDOW_PRIVATE_SEC` (default `86400`)

## API

### Edit a post
`PATCH /api/post/<id>`

Body:
```json
{ "text": "new content" }
```

Rules:
- Only the author can edit.
- Pure echoes (no text) cannot be edited.
- Subject to the edit window.

### Delete a post
`DELETE /api/post/<id>`

Rules:
- Author can delete.
- Staff can delete (failsafe).

## Payload additions
Feed/post payload includes:
- `canEdit: boolean`
- `canDelete: boolean`
- `editedAt: number` (ms since epoch)
