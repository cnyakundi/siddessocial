#!/usr/bin/env python3
import argparse
import json
import os
import sys

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
BACKEND_DIR = os.path.join(REPO_ROOT, "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

os.environ.setdefault("SIDDES_DEMO_UNIVERSE", "1")
from siddes_feed import mock_db  # noqa: E402
mock_db.ensure_seeded(force=True)

from siddes_reply.store import ReplyStore  # noqa: E402
from siddes_reply.endpoint_stub import create_reply  # noqa: E402

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--selftest", action="store_true")
    args = ap.parse_args()

    store = ReplyStore()

    # p_fr_1 is friends post by author "a" (see siddes_feed.mock_db)
    ok = create_reply(store, viewer_id="v_friend", post_id="p_fr_1", text="Looks good!")
    forbidden = create_reply(store, viewer_id="anon", post_id="p_fr_1", text="hi")
    close_forbidden = create_reply(store, viewer_id="v_friend", post_id="p_cl_1", text="hi close")
    close_ok = create_reply(store, viewer_id="v_close", post_id="p_cl_1", text="close reply")

    out = {
        "ok": ok,
        "forbidden": forbidden,
        "close_forbidden": close_forbidden,
        "close_ok": close_ok,
        "counts": {
            "p_fr_1": store.count_for_post("p_fr_1"),
            "p_cl_1": store.count_for_post("p_cl_1"),
            "total": store.total(),
        },
    }

    print(json.dumps(out, indent=2))

    if args.selftest:
        assert ok["ok"] is True and ok["status"] == 201
        assert forbidden["ok"] is False and forbidden["status"] in (403, 404)
        assert close_forbidden["ok"] is False and close_forbidden["status"] in (403, 404)
        assert close_ok["ok"] is True and close_ok["status"] == 201
        assert out["counts"]["p_fr_1"] == 1
        assert out["counts"]["p_cl_1"] == 1
        assert out["counts"]["total"] == 2
        print("SELFTEST_OK")

if __name__ == "__main__":
    main()
