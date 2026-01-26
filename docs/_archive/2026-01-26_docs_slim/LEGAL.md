# Siddes — Legal & policy pages (Launch Part 0 / sd_321)

This workstream ships **minimum public-facing legal pages** required for a real-world launch:

- `/terms` — Terms of Service
- `/privacy` — Privacy Policy
- `/community-guidelines` — Community Guidelines
- `/legal` — Index page linking to all policies

## IMPORTANT
These documents are **templates**. Before a public/global launch, you must:

1) Set your **operator name** and a real **support contact** (email + in-app path).
2) Confirm your **jurisdiction** and dispute language.
3) Confirm your **data retention** policy and whether you run analytics.
4) Confirm your **child safety** policy and minimum age.

## Where the pages live
- `frontend/src/app/legal/*`
- `frontend/src/app/terms/page.tsx`
- `frontend/src/app/privacy/page.tsx`
- `frontend/src/app/community-guidelines/page.tsx`

Login + signup pages include links so users can access policies at decision-time.
