from __future__ import annotations

from typing import Any, Dict


# sd_743_push_prefs
def normalize_prefs(p: Dict[str, Any]) -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    out["enabled"] = bool(p.get("enabled", True))

    types = p.get("types") if isinstance(p.get("types"), dict) else {}
    out["types"] = {
        "mention": bool(types.get("mention", True)),
        "reply": bool(types.get("reply", True)),
        "like": bool(types.get("like", True)),
        "echo": bool(types.get("echo", True)),
        "other": bool(types.get("other", True)),
    }

    sides = p.get("sides") if isinstance(p.get("sides"), dict) else {}
    out["sides"] = {
        "public": bool(sides.get("public", True)),
        "friends": bool(sides.get("friends", True)),
        "close": bool(sides.get("close", True)),
        "work": bool(sides.get("work", True)),
    }
    return out
