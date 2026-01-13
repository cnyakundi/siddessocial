#!/usr/bin/env python3
import argparse
import json
import os
import sys

# Ensure backend/ is on sys.path so we can import `siddes_push.*`
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
BACKEND_DIR = os.path.join(REPO_ROOT, "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from siddes_push.store import PushStore  # noqa: E402
from siddes_push.api_stub import subscribe, unsubscribe, send  # noqa: E402
from siddes_push.payloads import PushPayload  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--selftest", action="store_true")
    args = ap.parse_args()

    store = PushStore()
    user_id = "user_1"

    sub_json = {
        "endpoint": "https://example.com/push/abc",
        "keys": {"p256dh": "p256dh_key", "auth": "auth_key"},
    }

    r1 = subscribe(store, user_id, sub_json)
    payload = PushPayload(
        title="Siddes",
        body="New activity",
        url="/siddes-notifications",
        side="friends",
        glimpse="Count me in for Saturday!",
    )
    r2 = send(store, user_id, payload)
    r3 = unsubscribe(store, user_id, sub_json["endpoint"])

    out = {"subscribe": r1, "send": r2, "unsubscribe": r3, "count": store.count()}
    print(json.dumps(out, indent=2))

    if args.selftest:
        assert out["count"] == 0, "expected empty store after unsubscribe"
        assert r2["subscriptions"] == 1, "expected 1 subscription during send"
        print("SELFTEST_OK")


if __name__ == "__main__":
    main()
