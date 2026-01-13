#!/usr/bin/env python3
import json
import sys
import urllib.request
from collections import Counter

def get(url: str):
    with urllib.request.urlopen(url) as r:
        return json.loads(r.read().decode("utf-8"))

def main():
    base = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000"
    viewers = ["anon", "friends", "close", "work", "me"]

    print("== Inbox backend_stub smoke demo ==")
    print("Base:", base)
    print()

    for v in viewers:
        data = get(f"{base}/api/inbox/threads?viewer={v}")
        items = data.get("items") or []
        sides = Counter([it.get("lockedSide") for it in items])
        print(f"viewer={v:7} role={data.get('role'):7} threads={len(items):2} sides={dict(sides)}")

    print("\n== Restricted example (friends attempting close thread) ==")
    # Try reading a close thread while viewer=friends
    close_id = "t_close2"
    t = get(f"{base}/api/inbox/thread/{close_id}?viewer=friends")
    print("GET thread", close_id, "restricted=", t.get("restricted"), "role=", t.get("role"))

    print("\nTip: Open /siddes-inbox?debug=1&viewer=close to see Close threads in the UI.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
