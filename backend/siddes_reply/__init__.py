"""siddes_reply package.

Keep imports lightweight.

Why:
- Importing endpoint stubs here can trigger circular imports when other
  modules import `siddes_reply.store` (Python executes the package
  `__init__.py` first).

Pattern:
- Export lightweight symbols directly.
- Provide lazy wrappers for heavier functions.
"""

from .store import ReplyStore


def create_reply(*args, **kwargs):
    from .endpoint_stub import create_reply as _create_reply
    return _create_reply(*args, **kwargs)


__all__ = ["ReplyStore", "create_reply"]
