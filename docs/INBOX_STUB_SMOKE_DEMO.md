# Inbox stub smoke demo

This is an optional helper for **backend_stub** mode.

## Prereqs
1) You are running the Next dev server:
   - `npm run dev`
2) You are using backend stub inbox provider:
   - `NEXT_PUBLIC_INBOX_PROVIDER=backend_stub`

## Run
```bash
python3 scripts/dev/inbox_stub_smoke_demo.py http://localhost:3000
```

## What it prints
For each viewer (anon, friends, close, work, me) it prints:
- how many threads are visible
- which Sides they come from
- and a quick restricted example for a Close thread when viewer=friends

This is not a test harness — just a fast sanity tool.
