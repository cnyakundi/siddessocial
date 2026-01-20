"""Gunicorn config for Siddes (production).

DigitalOcean App Platform and most PaaS providers will set $PORT.

Tune via env:
- WEB_CONCURRENCY (workers)
- GUNICORN_THREADS
- GUNICORN_TIMEOUT
"""

import os

bind = f"0.0.0.0:{os.environ.get('PORT', '8000')}"

workers = int(os.environ.get("WEB_CONCURRENCY", "2"))
threads = int(os.environ.get("GUNICORN_THREADS", "8"))

timeout = int(os.environ.get("GUNICORN_TIMEOUT", "60"))
keepalive = int(os.environ.get("GUNICORN_KEEPALIVE", "5"))

accesslog = "-"
errorlog = "-"
loglevel = os.environ.get("SD_LOG_LEVEL", "info").lower()

# Respect X-Forwarded-Proto / X-Forwarded-For from DO load balancers
forwarded_allow_ips = "*"
secure_scheme_headers = {"X-FORWARDED-PROTO": "https"}
