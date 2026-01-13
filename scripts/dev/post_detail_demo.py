#!/usr/bin/env python3
import argparse
import json
import os
import sys

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
BACKEND_DIR = os.path.join(REPO_ROOT, "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from siddes_post.detail_stub import get_post_detail  # noqa: E402

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--selftest", action="store_true")
    args = ap.parse_args()

    out = {
        "anon_public": get_post_detail("anon", "p_pub_1"),
        "anon_friends_forbidden": get_post_detail("anon", "p_fr_1"),
        "v_friend_friends_ok": get_post_detail("v_friend", "p_fr_1"),
        "v_close_close_ok": get_post_detail("v_close", "p_cl_1"),
        "v_friend_close_forbidden": get_post_detail("v_friend", "p_cl_1"),
    }

    print(json.dumps(out, indent=2))

    if args.selftest:
        assert out["anon_public"]["ok"] is True
        assert out["anon_friends_forbidden"]["status"] == 403
        assert out["v_friend_friends_ok"]["ok"] is True
        assert out["v_close_close_ok"]["ok"] is True
        assert out["v_friend_close_forbidden"]["status"] == 403
        print("SELFTEST_OK")

if __name__ == "__main__":
    main()
