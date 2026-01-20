from __future__ import annotations

import os
import re
from typing import Set, Tuple

# Launch policy (safe-by-default): ASCII lowercase only.
# This eliminates Unicode confusables + mixed-script impersonation at launch.
USERNAME_RE = re.compile(r"^[a-z0-9_]{3,24}$")

# Words we never want users to claim.
# Includes staff/system terms + common route names + high-risk impersonation handles.
DEFAULT_RESERVED: Set[str] = {
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

def _env_reserved() -> Set[str]:
    raw = os.environ.get("SIDDES_RESERVED_USERNAMES") or os.environ.get("SD_RESERVED_USERNAMES") or ""
    out: Set[str] = set()
    for part in str(raw).split(","):
        p = part.strip().lower()
        if p:
            out.add(p)
    return out

RESERVED: Set[str] = set(DEFAULT_RESERVED) | _env_reserved()

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
