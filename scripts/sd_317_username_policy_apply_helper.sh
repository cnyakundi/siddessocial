#!/usr/bin/env bash
set -euo pipefail

# sd_317_username_policy_apply_helper.sh
# Launch Part 0 / Workstream 0.4
# Username + identity policy (anti-impersonation)
# - Lowercase-only usernames (ASCII): [a-z0-9_], 3-24 chars
# - Reserved usernames + reserved prefixes
# - Prevent case-insensitive duplicates on signup
# - Login helper: accept @username and case-insensitive username
# - Google sign-in username generation uses the same policy
# - Frontend signup normalizes username input to match backend

need_dir() {
  if [[ ! -d "$1" ]]; then
    echo "ERROR: Expected directory not found: $1"
    echo "Run this from your Siddes repo root."
    exit 1
  fi
}

PYBIN="python3"
if ! command -v "$PYBIN" >/dev/null 2>&1; then
  PYBIN="python"
fi
if ! command -v "$PYBIN" >/dev/null 2>&1; then
  echo "ERROR: python3 (or python) is required to apply this overlay."
  echo "Install python3 or run via ops/docker."
  exit 1
fi

need_dir "backend"
need_dir "frontend"
need_dir "docs"
need_dir "backend/siddes_auth"
need_dir "frontend/src/app"

STAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR=".backup_sd_317_username_policy_${STAMP}"
mkdir -p "$BACKUP_DIR"

backup_if_exists() {
  local f="$1"
  if [[ -f "$f" ]]; then
    mkdir -p "$BACKUP_DIR/$(dirname "$f")"
    cp -f "$f" "$BACKUP_DIR/$f"
  fi
}

echo "== sd_317: Username policy (reserved + lowercase + anti-impersonation) =="
echo "Backups: $BACKUP_DIR"

backup_if_exists "backend/siddes_auth/views.py"
backup_if_exists "backend/siddes_auth/username_policy.py"
backup_if_exists "docs/STATE.md"
backup_if_exists "docs/USERNAME_POLICY.md"
backup_if_exists "frontend/src/app/signup/page.tsx"

# -----------------------------------------------------------------------------
# Backend: username policy module
# -----------------------------------------------------------------------------
cat > backend/siddes_auth/username_policy.py <<'PY'
from __future__ import annotations

import os
import re
from typing import Circle, Tuple

# Launch policy (safe-by-default): ASCII lowercase only.
# This eliminates Unicode confusables + mixed-script impersonation at launch.
USERNAME_RE = re.compile(r"^[a-z0-9_]{3,24}$")

# Words we never want users to claim.
# Includes staff/system terms + common route names + high-risk impersonation handles.
DEFAULT_RESERVED: Circle[str] = {
    "admin", "administrator", "root", "owner",
    "staff", "team", "moderator", "mod",
    "support", "help", "security", "safety", "trust",
    "official", "verified",
    "system", "api", "status", "health", "healthz", "readyz",
    "privacy", "terms", "tos", "legal", "dmca",
    "login", "logout", "signup", "register", "signin",
    "settings", "account", "profile", "me",
    "discover", "explore", "search", "notifications", "inbox",
    "broadcasts", "adminpanel",
    "siddes", "sides",
}

# Prefixes blocked because they collide with internal ids / seeds or imply staff/bots.
RESERVED_PREFIXES = ("me_", "seed_", "sys_", "svc_", "bot_", "admin_", "staff_", "mod_")

def _env_reserved() -> Circle[str]:
    raw = os.environ.get("SIDDES_RESERVED_USERNAMES") or os.environ.get("SD_RESERVED_USERNAMES") or ""
    out: Circle[str] = set()
    for part in str(raw).split(","):
        p = part.strip().lower()
        if p:
            out.add(p)
    return out

RESERVED: Circle[str] = set(DEFAULT_RESERVED) | _env_reserved()

def normalize_username(raw: str) -> str:
    s = str(raw or "").strip()
    if s.startswith("@"):
        s = s[1:]
    return s.lower()

def validate_username_or_error(raw: str) -> Tuple[str, str | None]:
    """
    Returns: (normalized_username, error_code_or_None)
    Error codes:
      - invalid_username
      - reserved_username
    """
    u = normalize_username(raw)
    if not u:
        return "", "invalid_username"
    if len(u) < 3 or len(u) > 24:
        return "", "invalid_username"
    if not USERNAME_RE.match(u):
        return "", "invalid_username"
    if u.startswith("_") or u.endswith("_") or "__" in u:
        return "", "invalid_username"
    if u.isdigit():
        return "", "invalid_username"

    for pref in RESERVED_PREFIXES:
        if u.startswith(pref):
            return "", "reserved_username"
    if u in RESERVED:
        return "", "reserved_username"

    return u, None
PY

echo "OK: wrote backend/siddes_auth/username_policy.py"

# -----------------------------------------------------------------------------
# Docs: USERNAME_POLICY.md
# -----------------------------------------------------------------------------
cat > docs/USERNAME_POLICY.md <<'MD'
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
MD

echo "OK: wrote docs/USERNAME_POLICY.md"

# -----------------------------------------------------------------------------
# Patch backend auth views to enforce the policy
# -----------------------------------------------------------------------------
"$PYBIN" - <<'PY'
import pathlib

p = pathlib.Path("backend/siddes_auth/views.py")
txt = p.read_text(encoding="utf-8")
orig = txt

# 1) Ensure import
if "from .username_policy import" not in txt:
    anchor = "from .email_verification import create_and_send_email_verification"
    imp = "from .username_policy import validate_username_or_error"
    if anchor in txt:
        txt = txt.replace(anchor, anchor + "\n" + imp)
    else:
        anchor2 = "from .models import SiddesProfile"
        if anchor2 in txt:
            txt = txt.replace(anchor2, anchor2 + "\n" + imp)
        else:
            txt = imp + "\n" + txt

# 2) Tighten regex constant (even if no longer used everywhere)
txt = txt.replace(
    '_USERNAME_RE = re.compile(r"^[a-zA-Z0-9_]{3,24}$")',
    '_USERNAME_RE = re.compile(r"^[a-z0-9_]{3,24}$")',
)

# 3) Signup: validate + normalize + case-insensitive uniqueness
if "username, uerr = validate_username_or_error" not in txt:
    txt = txt.replace(
        'username = str(body.get("username") or "").strip()',
        'raw_username = str(body.get("username") or "").strip()\n        username, uerr = validate_username_or_error(raw_username)',
    )
    txt = txt.replace(
        'if not username or not _USERNAME_RE.match(username):\n            return Response({"ok": False, "error": "invalid_username"}, status=status.HTTP_400_BAD_REQUEST)',
        'if uerr:\n            return Response({"ok": False, "error": uerr}, status=status.HTTP_400_BAD_REQUEST)',
    )

# Username taken should be case-insensitive (safe even if already patched)
txt = txt.replace(
    'User.objects.filter(username=username).exists()',
    'User.objects.filter(username__iexact=username).exists()',
)

# 4) Login: accept @username + case-insensitive lookup before authenticate
if 'if username.startswith("@")' not in txt:
    txt = txt.replace(
        "        username = identifier\n",
        "        username = identifier\n        if username.startswith(\"@\"):\n            username = username[1:]\n",
        1,
    )

marker = "        user = authenticate(request, username=username, password=password)\n"
if "u2 = User.objects.filter(username__iexact=username).first()" not in txt and marker in txt:
    insert = (
        "        if \"@\" not in identifier:\n"
        "            u2 = User.objects.filter(username__iexact=username).first()\n"
        "            if u2:\n"
        "                username = u2.get_username()\n\n"
    )
    txt = txt.replace(marker, insert + marker, 1)

# 5) Google sign-in username generation: normalize + validate + case-insensitive uniqueness
old_block = (
    '            # Generate a safe unique username; user can change later in onboarding.\n'
    '            base = re.sub(r"[^a-zA-Z0-9_]", "_", email.split("@")[0])[:12] or "sider"\n'
    '            cand = base\n'
    '            n = 0\n'
    '            while User.objects.filter(username=cand).exists():\n'
    '                n += 1\n'
    '                cand = f"{base}_{n}"\n'
    '                if len(cand) > 24:\n'
    '                    cand = f"sider_{sub[-6:]}"\n'
    '                    break\n'
)

new_block = (
    '            # Generate a safe unique username; user can change later in onboarding.\n'
    '            base_raw = re.sub(r"[^a-z0-9_]", "_", email.split("@")[0].lower())\n'
    '            base_raw = base_raw.strip("_")[:12] or "sider"\n'
    '            base, berr = validate_username_or_error(base_raw)\n'
    '            if berr:\n'
    '                base = "sider"\n\n'
    '            cand = base\n'
    '            n = 0\n'
    '            while User.objects.filter(username__iexact=cand).exists():\n'
    '                n += 1\n'
    '                cand = f"{base}_{n}"\n'
    '                cand = cand[:24].strip("_")\n'
    '                cand2, cerr = validate_username_or_error(cand)\n'
    '                if cerr:\n'
    '                    cand = f"sider_{sub[-6:]}"[:24].strip("_")\n'
    '                    break\n'
    '                cand = cand2\n'
    '                if n >= 999:\n'
    '                    cand = f"sider_{sub[-6:]}"[:24].strip("_")\n'
    '                    break\n'
)

if old_block in txt:
    txt = txt.replace(old_block, new_block)
else:
    # Fallback: at least make uniqueness check case-insensitive
    txt = txt.replace(
        "while User.objects.filter(username=cand).exists():",
        "while User.objects.filter(username__iexact=cand).exists():",
    )

if txt != orig:
    p.write_text(txt, encoding="utf-8")
    print("OK: patched", str(p))
else:
    print("SKIP: backend/siddes_auth/views.py already up to date")
PY

# -----------------------------------------------------------------------------
# Patch frontend signup page: normalize username input + match regex
# -----------------------------------------------------------------------------
"$PYBIN" - <<'PY'
import pathlib

p = pathlib.Path("frontend/src/app/signup/page.tsx")
txt = p.read_text(encoding="utf-8")
orig = txt

# Normalize username as user types
if "replace(/[^a-z0-9_]/g" not in txt:
    txt = txt.replace(
        "onChange={(e) => setUsername(e.target.value)}",
        "onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, \"\").slice(0, 24))}",
    )

# Make canSubmit match backend regex (basic)
txt = txt.replace(
    'const canSubmit = email.includes("@") && username.trim().length >= 3 && password.length >= 8;',
    'const canSubmit = email.includes("@") && /^[a-z0-9_]{3,24}$/.test(username.trim()) && password.length >= 8;',
)

# Update placeholder copy (optional)
if "lowercase" not in txt:
    txt = txt.replace(
        'placeholder="3–24 chars, letters/numbers/_"',
        'placeholder="3–24 chars, lowercase a-z / 0-9 / _"',
    )

if txt != orig:
    p.write_text(txt, encoding="utf-8")
    print("OK: patched", str(p))
else:
    print("SKIP: frontend/src/app/signup/page.tsx already up to date")
PY

# -----------------------------------------------------------------------------
# Patch docs/STATE.md to record milestone
# -----------------------------------------------------------------------------
"$PYBIN" - <<'PY'
import pathlib

p = pathlib.Path("docs/STATE.md")
txt = p.read_text(encoding="utf-8")
if "sd_317:" in txt:
    print("SKIP: docs/STATE.md already mentions sd_317")
    raise SystemExit(0)

lines = txt.splitlines()
out = []
inserted = False
for line in lines:
    out.append(line)
    if (not inserted) and line.strip().startswith("- **sd_314:**"):
        out.append("- **sd_317:** Username policy (reserved + lowercase + anti-impersonation; case-insensitive uniqueness)")
        inserted = True

if not inserted:
    out.append("")
    out.append("- **sd_317:** Username policy (reserved + lowercase + anti-impersonation; case-insensitive uniqueness)")

p.write_text("\n".join(out) + "\n", encoding="utf-8")
print("OK: patched", str(p))
PY

echo ""
echo "== sd_317 applied =="
echo "Notes:"
echo "  - No DB migrations needed."
echo "  - Restart backend to pick up changes."
echo ""
echo "Next (VS Code terminal):"
echo "  docker compose -f ops/docker/docker-compose.dev.yml restart backend"
echo ""
echo "Quick checks (dev):"
echo "  # Signup should reject reserved usernames like 'admin'"
echo "  # Signup should treat 'John' and 'john' as the same (case-insensitive)"
echo ""
