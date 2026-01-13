#!/usr/bin/env python3
import argparse
import json
import os
import sys

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
BACKEND_DIR = os.path.join(REPO_ROOT, "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from siddes_sets.store import SetsStore  # noqa: E402
from siddes_sets.endpoint_stub import (
    create_set,
    list_sets,
    add_members,
    remove_members,
    rename_set,
    list_events,
)  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--selftest", action="store_true")
    args = ap.parse_args()

    store = SetsStore()
    owner = "u1"

    r1 = create_set(store, owner_id=owner, side="friends", label="Gym Squad", members=["@marc_us", "@sara_j"], color="orange")
    sid = r1["set"]["id"]

    r2 = add_members(store, owner_id=owner, set_id=sid, members=["@elena", "@marc_us"])  # marc already present
    r3 = rename_set(store, owner_id=owner, set_id=sid, label="Gym Crew")
    r4 = remove_members(store, owner_id=owner, set_id=sid, members=["@sara_j"])

    r5 = list_sets(store, owner_id=owner, side="friends")
    r6 = list_events(store, owner_id=owner, set_id=sid)

    out = {
        "create": r1,
        "add": r2,
        "rename": r3,
        "remove": r4,
        "list": r5,
        "events": r6,
        "total": store.total(),
    }
    print(json.dumps(out, indent=2))

    if args.selftest:
        assert out["total"] == 1, "should have 1 set"
        assert out["list"]["sets"][0]["label"] == "Gym Crew"
        assert "@sara_j" not in out["list"]["sets"][0]["members"]
        # Expect at least: create, add, rename, remove
        kinds = [e["kind"] for e in out["events"]["events"]]
        assert "create" in kinds
        assert "members_added" in kinds
        assert "rename" in kinds
        assert "members_removed" in kinds
        print("SELFTEST_OK")


if __name__ == "__main__":
    main()
