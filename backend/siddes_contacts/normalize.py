"""Contact normalization utilities.

v0 rule:
- Prefer client-side normalization.
- Server re-normalizes defensively.

Email normalization:
- lowercase + trim

Phone normalization:
- Best-effort E.164 if `phonenumbers` is installed.
- Otherwise, accept already-E.164 input only (must start with '+').
"""

from __future__ import annotations

import re
from typing import Optional


def normalize_email(email: str) -> str:
    return (email or "").strip().lower()


def normalize_phone(phone: str, default_region: str = "US") -> Optional[str]:
    raw = (phone or "").strip()

    # If already E.164-like, keep after cleaning
    cleaned = re.sub(r"[^0-9+]", "", raw)
    if cleaned.startswith("+") and len(cleaned) >= 8:
        return cleaned

    # Best-effort E.164 via phonenumbers if available
    try:
        import phonenumbers  # type: ignore

        parsed = phonenumbers.parse(raw, default_region)
        if not phonenumbers.is_valid_number(parsed):
            return None
        return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
    except Exception:
        # Fallback heuristics when `phonenumbers` isn't installed.
        # We keep this conservative and only normalize obvious local formats.
        dr = str(default_region or "").strip().upper()
        digits = re.sub(r"[^0-9]", "", raw)

        # Kenya (KE): 07xx..., 01xx..., 2547..., 2541..., 7xxxxxxxx, 1xxxxxxxx
        if dr == "KE":
            if digits.startswith("0") and len(digits) == 10:
                return "+254" + digits[1:]
            if digits.startswith("254") and len(digits) == 12:
                return "+254" + digits[3:]
            if len(digits) == 9 and digits[:1] in ("7", "1"):
                return "+254" + digits

        return None
