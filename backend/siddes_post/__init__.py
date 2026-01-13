"""siddes_post package.

Keep imports lightweight.

Importing a submodule (e.g. `siddes_post.detail_stub`) may pull in other
packages (visibility, feed mocks). Avoid eager imports here so that tooling
and demo scripts don't hit circular import chains.
"""


def get_post_detail(*args, **kwargs):
    from .detail_stub import get_post_detail as _get_post_detail
    return _get_post_detail(*args, **kwargs)


__all__ = ["get_post_detail"]
