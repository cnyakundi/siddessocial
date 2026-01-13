#!/usr/bin/env python3
import argparse
import json
import os
import sys

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
BACKEND_DIR = os.path.join(REPO_ROOT, "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from siddes_feed.feed_stub import list_feed  # noqa: E402

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--selftest", action="store_true")
    args = ap.parse_args()

    out = {
        "anon_public": list_feed("anon", "public"),
        "anon_friends": list_feed("anon", "friends"),
        "v_friend_friends": list_feed("v_friend", "friends"),
        "v_close_close": list_feed("v_close", "close"),
        "v_work_work": list_feed("v_work", "work"),
    }

    print(json.dumps(out, indent=2))

    if args.selftest:
        assert out["anon_public"]["count"] == 2
        assert out["anon_friends"]["count"] == 0
        assert out["v_friend_friends"]["count"] == 2
        assert out["v_close_close"]["count"] == 1
        assert out["v_work_work"]["count"] == 1
        print("SELFTEST_OK")

if __name__ == "__main__":
    main()
