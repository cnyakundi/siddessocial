# ML Part 8 - Privacy-Safe Telemetry (Counts Only)

We improve suggestion quality without collecting personal data.

## Rule
- Track counts only
- No handles
- No contact identifiers
- No raw names/text from contacts
- No device identifiers

## Storage
We store only:
- viewer_id (string: supports dev SiddesViewer like "me_1" and production user ids)
- event name
- timestamp

## Events
- suggestion_shown
- suggestion_accepted
- suggestion_skipped
- suggestion_edited (member removals / renames)
- suggestion_undo (optional; wire from Undo bar)
- embeddings_opt_in / embeddings_opt_out

## Why
- Accept rate: value signal
- Edit rate: quality signal
- Undo rate: danger signal
All without creating a privacy liability.

## Retention

Telemetry is counts-only, but we still keep it on a short leash.

- `SIDDES_TELEMETRY_RETENTION_DAYS` (default: 30)

To purge old rows:

```bash
docker compose -f ops/docker/docker-compose.dev.yml exec backend python manage.py purge_telemetry --dry-run
docker compose -f ops/docker/docker-compose.dev.yml exec backend python manage.py purge_telemetry --days 30
```
