"""Visibility policy (server-side) for Siddes Sides.

Terminology:
- viewer: user requesting to view content
- author: user who created the post
- side: one of public/friends/close/work

Non-negotiable:
- This policy must be enforced server-side in feed queries.
- UI must not be trusted for privacy.

v0 Inputs:
- relationship sets passed in (author -> viewer membership)
  e.g. author_friends contains viewer_id if viewer is in author's Friends.

Django wiring:
- relationship sets come from DB joins
- feed query filters by side + membership
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Literal, Set


SideId = Literal["public", "friends", "close", "work"]


@dataclass(frozen=True)
class VisibilityContext:
    viewer_id: str
    author_id: str
    author_friends: Set[str]
    author_close: Set[str]
    author_work: Set[str]


def can_view_post(side: SideId, ctx: VisibilityContext) -> bool:
    # Author always sees own posts
    if ctx.viewer_id == ctx.author_id:
        return True

    if side == "public":
        return True
    if side == "friends":
        return ctx.viewer_id in ctx.author_friends
    if side == "close":
        return ctx.viewer_id in ctx.author_close
    if side == "work":
        return ctx.viewer_id in ctx.author_work

    return False


@dataclass(frozen=True)
class Post:
    id: str
    author_id: str
    side: SideId


def filter_visible_posts(posts: Iterable[Post], viewer_id: str, *, relationships: dict) -> list[Post]:
    """Filter posts visible to viewer.

    relationships format (v0):
    relationships[author_id] = {
      "friends": set([...]),
      "close": set([...]),
      "work": set([...]),
    }
    """
    out: list[Post] = []
    for p in posts:
        rel = relationships.get(p.author_id) or {"friends": set(), "close": set(), "work": set()}
        ctx = VisibilityContext(
            viewer_id=viewer_id,
            author_id=p.author_id,
            author_friends=set(rel.get("friends") or set()),
            author_close=set(rel.get("close") or set()),
            author_work=set(rel.get("work") or set()),
        )
        if can_view_post(p.side, ctx):
            out.append(p)
    return out
