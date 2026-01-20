# Siddes — Username policy (Workstream 0.4 / sd_317)

## Launch rules (v0)

- **Allowed:** `a-z`, `0-9`, `_`
- **Length:** 3–24
- **Lowercase only** (ASCII)
- No leading/trailing `_`, no `__`
- **Reserved words** (system/staff/routes) are blocked
- **Reserved prefixes** are blocked:
  - `me_` (viewer ids are `me_<id>`)
  - `seed_`, `sys_`, `svc_`, `bot_`, `admin_`, `staff_`, `mod_`

## Why ASCII-only at launch?
Safest way to eliminate Unicode confusables + mixed-script impersonation.
You can expand the international username scheme later once the platform is stable.

## Behavior
- Signup rejects invalid/reserved usernames.
- Signup checks duplicates **case-insensitively**.
- Login accepts `@username` and resolves usernames case-insensitively.
- Google sign-in generated usernames are normalized + validated.
