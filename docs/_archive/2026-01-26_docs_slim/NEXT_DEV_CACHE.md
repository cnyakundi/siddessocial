# Next dev cache reset

If you see errors like:
- `Cannot find module './###.js'` from `.next/server/webpack-runtime.js`
- `_next/static/...` assets 404
- dev server 500s after an overlay / rebuild

It usually means the local `.next` artifacts are stale/corrupted.

## Fix (recommended)
Run:

```bash
cd /Users/cn/Downloads/sidesroot
./scripts/dev/clean_next_cache.sh
cd frontend
npm run dev
```

## What it does
- deletes: `frontend/.next`
- deletes (best effort): `frontend/node_modules/.cache`
