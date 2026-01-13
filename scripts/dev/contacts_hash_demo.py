#!/usr/bin/env python3
import argparse
import json
import os
import sys

# Ensure backend/ is on sys.path so we can import `siddes_contacts.*`
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
BACKEND_DIR = os.path.join(REPO_ROOT, "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from siddes_contacts.normalize import normalize_email, normalize_phone  # noqa: E402
from siddes_contacts.tokens import hmac_token  # noqa: E402
from siddes_contacts.match import match_tokens  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pepper", default="dev_pepper_change_me")
    ap.add_argument("--selftest", action="store_true")
    args = ap.parse_args()

    pepper = args.pepper

    # Simulated DB table: token -> user payload
    known = {}

    known_phone = normalize_phone("+15551234567") or "+15551234567"
    known_email = normalize_email("marcus@example.com")

    t1 = hmac_token(known_phone, pepper)
    t2 = hmac_token(known_email, pepper)

    known[t1] = {"user_id": "1", "handle": "@marc_us", "display_name": "Marcus"}
    known[t2] = {"user_id": "2", "handle": "@elena", "display_name": "Elena"}

    incoming = [
        normalize_phone("+15551234567") or "+15551234567",
        normalize_email("someone@nope.com"),
        normalize_email("marcus@example.com"),
    ]
    incoming_tokens = [hmac_token(x, pepper) for x in incoming]

    matches = match_tokens(incoming_tokens, known)

    print(
        json.dumps(
            {
                "pepper_used": "dev" if pepper == "dev_pepper_change_me" else "custom",
                "incoming_count": len(incoming),
                "matches": [m.__dict__ for m in matches],
            },
            indent=2,
        )
    )

    if args.selftest:
        assert len(matches) == 2, "Expected 2 matches in selftest"
        print("SELFTEST_OK")


if __name__ == "__main__":
    main()
