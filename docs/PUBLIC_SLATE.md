# Public Slate + Pinned Stack (sd_131)

The Public Side is where context collapse happens first.

This overlay introduces two **profile-first** primitives that make Public profiles feel like a homepage instead of a feed dump:

1. **Pinned Stack (“Start Here”)**
   - A small carousel of pinned cards (e.g. *Who I am*, *Best essays*, *Projects*).
   - This replaces the single “Pinned” card when present.

2. **Public Slate**
   - A guestbook-style section where trusted people can leave **vouches** or **questions**.
   - In this stub/MVP era, Slate entries are demo data (and the “Write” button is disabled).
   - Later, we’ll enforce:
     - who can write (trusted-only)
     - rate limits
     - moderation hooks

## Flags
This is fully opt-in.

Enable:
- `NEXT_PUBLIC_SD_PUBLIC_SLATE=1`

Optional (independent):
- `NEXT_PUBLIC_SD_PUBLIC_CHANNELS=1`
- `NEXT_PUBLIC_SD_PUBLIC_TRUST_DIAL=1`

## What to test
1. Set `NEXT_PUBLIC_SD_PUBLIC_SLATE=1` and restart Next.
2. Go to `/siddes-profile?u=elena` and switch the profile strip to **Public**.
3. You should see:
   - **Start Here** pinned carousel
   - **Slate** section with a few entries
4. Disable the flag and confirm the profile reverts to the old behavior.

## Files
- `frontend/src/components/PinnedStack.tsx`
- `frontend/src/components/PublicSlate.tsx`
- `frontend/src/lib/mockPublicSlate.ts`
- `frontend/src/lib/mockUsers.ts` (adds `pinnedStack` demo data)
- `frontend/src/components/ProfileView.tsx` (wires slate + stack behind the flag)

---

## DB-backed Slate (sd_181i)
Slate entries are now stored in the database and served by the backend.

### API
- `GET /api/slate?target=@handle`

### Seed demo entries
Run:
- `python manage.py migrate`
- `python manage.py seed_public_slate_demo --reset --target=@founder`

### Frontend
- Next proxy: `frontend/src/app/api/slate/route.ts`
- UI: `frontend/src/components/PublicSlate.tsx` fetches `/api/slate` (no mocks)

