"""siddes_feed package.

Keep imports lightweight.

Do NOT import heavy modules (like feed stubs) at import time. Importing a
submodule always executes this file first, so
any eager imports here can create circular import chains.

We expose `list_feed` via a lazy wrapper to preserve the old API:

  from siddes_feed import list_feed

"""


def list_feed(*args, **kwargs):
    from .feed_stub import list_feed as _list_feed
    return _list_feed(*args, **kwargs)


__all__ = ["list_feed"]
