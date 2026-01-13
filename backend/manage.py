#!/usr/bin/env python
"""Siddes Django entrypoint.

This is intentionally minimal. The repo historically used backend modules as
framework-agnostic stubs; starting sd_108 we bootstrap a real Django project so
Docker dev and future DB-backed APIs can land cleanly.

If Django isn't installed locally yet, `./scripts/run_tests.sh` will warn (not
fail). Use Docker (`ops/docker`) or install `backend/requirements.txt`.
"""

import os
import sys


def main() -> None:
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "siddes_backend.settings")

    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Django is not installed. Install backend/requirements.txt or run via ops/docker."
        ) from exc

    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
