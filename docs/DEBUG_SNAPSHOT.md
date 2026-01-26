# Debug Snapshot (Siddes)

Use this every time you report a bug.  
Rule: **first real error** wins. Everything after is noise.

---

## Baseline
- Branch:
- Commit:
- Zip/Overlay ID:
- Local or Prod:
- What changed most recently:

## Repro Steps
1)
2)
3)

Expected:
Actual:

## Evidence (first real error)
- Frontend console (first error):
- Backend logs (first exception):
- Stack trace file:line:

## Environment Fingerprint (no secrets)
- Node:
- Python:
- Next.js:
- Django:
- Key env vars (keys only):
  - NEXT_PUBLIC_API_BASE=
  - DJANGO_SETTINGS_MODULE=
  - SD_...=

## Scope
- Which screen/route:
- Which API endpoint:
- Which Side (Public/Friends/Close/Work):

---

## Quick helper
Run this and paste the output:

```bash
bash scripts/debug_pack.sh
```

Optional (include docker logs):
```bash
INCLUDE_LOGS=1 bash scripts/debug_pack.sh
```

Optional (show source context around a line):
```bash
CONTEXT="frontend/src/app/siddes-post/[id]/page.tsx:120" bash scripts/debug_pack.sh
```
