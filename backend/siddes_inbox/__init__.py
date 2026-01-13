"""Siddes Inbox backend module (real backend target).

This package is framework-agnostic on purpose.
- `models_stub.py` sketches the durable data structures.
- `endpoint_stub.py` sketches the durable behaviors/JSON shapes.

A real Django project can import and expose these via Ninja/DRF.
"""

from .endpoint_stub import get_thread, list_threads, send_message, set_locked_side

__all__ = [
    "list_threads",
    "get_thread",
    "send_message",
    "set_locked_side",
]
