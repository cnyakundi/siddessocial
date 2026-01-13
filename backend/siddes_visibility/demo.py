#!/usr/bin/env python3
import argparse
import json
import os
import sys

# Ensure backend/ is on sys.path so we can import `siddes_visibility.*`
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
BACKEND_DIR = os.path.join(REPO_ROOT, "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from siddes_visibility.policy import Post, filter_visible_posts  # noqa: E402

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--selftest", action="store_true")
    args = ap.parse_args()

    posts = [
        Post(id="p1", author_id="a", side="public"),
        Post(id="p2", author_id="a", side="friends"),
        Post(id="p3", author_id="a", side="close"),
        Post(id="p4", author_id="a", side="work"),
    ]

    relationships = {
        "a": {"friends": {"v_friend"}, "close": {"v_close"}, "work": {"v_work"}}
    }

    cases = {
        "anon": filter_visible_posts(posts, "anon", relationships=relationships),
        "v_friend": filter_visible_posts(posts, "v_friend", relationships=relationships),
        "v_close": filter_visible_posts(posts, "v_close", relationships=relationships),
        "v_work": filter_visible_posts(posts, "v_work", relationships=relationships),
        "author": filter_visible_posts(posts, "a", relationships=relationships),
    }

    out = {k: [p.id for p in v] for k, v in cases.items()}
    print(json.dumps(out, indent=2))

    if args.selftest:
        assert out["anon"] == ["p1"]
        assert out["v_friend"] == ["p1", "p2"]
        assert out["v_close"] == ["p1", "p3"]
        assert out["v_work"] == ["p1", "p4"]
        assert out["author"] == ["p1", "p2", "p3", "p4"]
        print("SELFTEST_OK")

if __name__ == "__main__":
    main()
