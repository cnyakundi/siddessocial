# Siddes Full Project Audit Runbook

Goal: stop the “one error at a time” loop by producing **one complete** list of:
- frontend lint issues
- TypeScript errors (all at once)
- next build failures
- backend migration drift

## Run

From repo root:

```bash
bash scripts/dev/full_project_audit.sh
```

It generates:

- `audit_runs/audit_YYYYMMDD_HHMMSS/` (logs + summary)
- `audit_runs/audit_YYYYMMDD_HHMMSS.zip` (share this zip with your dev/debugging assistant)

## What’s inside

- `env.txt` — versions + environment
- `frontend_lint.log`
- `frontend_typecheck.log`
- `frontend_build.log`
- `backend_makemigrations_dryrun.log` (if docker compose is present)
- `AUDIT_SUMMARY.md` — pointers + exit codes

## Why this works

`next build` stops at the first type error. `tsc --noEmit` shows **all** TypeScript errors at once.
This runbook collects everything so fixes can be applied in **big batches** with confidence.
