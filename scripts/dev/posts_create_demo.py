#!/usr/bin/env python3
import argparse
import json
import os
import sys

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
BACKEND_DIR = os.path.join(REPO_ROOT, "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from siddes_posts.store import PostStore  # noqa: E402
from siddes_posts.endpoint_stub import create_post  # noqa: E402

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--selftest", action="store_true")
    args = ap.parse_args()

    store = PostStore()
    author = "u1"

    r1 = create_post(store, author_id=author, side="public", text="hello", client_key="k1")
    r2 = create_post(store, author_id=author, side="public", text="hello", client_key="k1")  # dup
    r3 = create_post(store, author_id=author, side="work", text="standup", client_key="k2")
    r4 = create_post(store, author_id=author, side="work", text="standup", client_key="k2")  # dup
    r5 = create_post(store, author_id=author, side="friends", text="bbq", client_key="k3")

    out = {"r1": r1, "r2": r2, "r3": r3, "r4": r4, "r5": r5, "total": store.total()}
    print(json.dumps(out, indent=2))

    if args.selftest:
        assert out["total"] == 3, "idempotency should dedupe to 3 posts"
        assert out["r1"]["post"]["id"] == out["r2"]["post"]["id"]
        assert out["r3"]["post"]["id"] == out["r4"]["post"]["id"]
        print("SELFTEST_OK")

if __name__ == "__main__":
    main()
