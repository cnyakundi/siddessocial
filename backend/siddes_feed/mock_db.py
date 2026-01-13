"""Mock DB for feed endpoint stub.

Posts:
- stored as simple dicts or dataclass Post (visibility policy expects Post objects)

Relationships:
relationships[author_id] = { friends:set, close:set, work:set }
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Literal, Set

from siddes_visibility.policy import Post as VPost, SideId


# Mock posts across sides
MOCK_POSTS: List[VPost] = [
    VPost(id="p_pub_1", author_id="a", side="public"),
    VPost(id="p_fr_1", author_id="a", side="friends"),
    VPost(id="p_cl_1", author_id="a", side="close"),
    VPost(id="p_wk_1", author_id="a", side="work"),
    VPost(id="p_pub_2", author_id="b", side="public"),
    VPost(id="p_fr_2", author_id="b", side="friends"),
]

# Mock membership graph:
RELATIONSHIPS: Dict[str, Dict[str, Set[str]]] = {
    "a": {"friends": {"v_friend"}, "close": {"v_close"}, "work": {"v_work"}},
    "b": {"friends": {"v_friend"}, "close": set(), "work": set()},
}

# Mock post content store
POST_CONTENT: Dict[str, dict] = {
    "p_pub_1": {"author": "A", "text": "Public post A"},
    "p_fr_1": {"author": "A", "text": "Friends post A"},
    "p_cl_1": {"author": "A", "text": "Close post A"},
    "p_wk_1": {"author": "A", "text": "Work post A"},
    "p_pub_2": {"author": "B", "text": "Public post B"},
    "p_fr_2": {"author": "B", "text": "Friends post B"},
}
