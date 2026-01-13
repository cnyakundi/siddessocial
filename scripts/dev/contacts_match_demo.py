#!/usr/bin/env python3
import argparse
import json
import os
import sys

# Ensure backend/ is on sys.path
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
BACKEND_DIR = os.path.join(REPO_ROOT, "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from siddes_contacts.tokens import hmac_token  # noqa: E402
from siddes_contacts.endpoint_stub import contacts_match  # noqa: E402

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pepper", default="dev_pepper_change_me")
    ap.add_argument("--selftest", action="store_true")
    args = ap.parse_args()

    pepper = args.pepper

    # Fake DB mapping: token -> user payload
    known = {}
    known[hmac_token("+15551234567", pepper)] = {"user_id": "1", "handle": "@marc_us", "display_name": "Marcus"}
    known[hmac_token("marcus@example.com", pepper)] = {"user_id": "2", "handle": "@elena", "display_name": "Elena"}

    req = {"identifiers": ["+15551234567", "marcus@example.com", "nope@example.com"]}
    out = contacts_match(req["identifiers"], known, pepper=pepper, default_region="US")

    print(json.dumps(out, indent=2))

    if args.selftest:
        assert len(out["matches"]) == 2, "expected 2 matches"
        print("SELFTEST_OK")

if __name__ == "__main__":
    main()
