# Dead Code Ledger (Siddes)

Deletion rule: **you never delete based on vibes.**  
You delete only with proof.

Safe delete requires **at least 2 proofs**, e.g.:
- not imported anywhere (static graph)
- not referenced by grep (strings/routes/endpoints)
- not hit by smoke flows / golden flows
- not part of framework conventions (Next routes, Django apps, migrations)

Before delete: **quarantine** in `deprecated/` for 1–2 green cycles.

---

## Safe candidates (2+ proofs)
- path:
  proofs:
    - (proof 1)
    - (proof 2)
  risk:
  plan:
    - quarantine → run gates → keep 1–2 cycles → delete

## Risky candidates (quarantine only)
- path:
  why risky:
  suggested quarantine plan:

## Duplicates to consolidate
- component A:
- component B:
- plan:
  - pick canonical
  - migrate callsites
  - keep alias temporarily
  - delete after green cycles
