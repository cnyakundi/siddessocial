#!/usr/bin/env bash
set -euo pipefail

NAME="sd_395_api_request_log_hardening_robust"

if [ ! -d "backend" ] || [ ! -f "backend/siddes_backend/middleware.py" ]; then
  echo "ERROR: run from repo root (must contain backend/ and frontend/)."
  echo "Tip: 'pwd' then 'ls' should show backend and frontend."
  exit 1
fi

STAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR=".backup_${NAME}_${STAMP}"
mkdir -p "$BACKUP_DIR"
export BACKUP_DIR

echo "== ${NAME} =="
echo "Backups: ${BACKUP_DIR}"

python3 - <<'PY'
import os, re, shutil, sys
from pathlib import Path

root = Path('.').resolve()
backup_dir = Path(os.environ['BACKUP_DIR']).resolve()
target = root / 'backend' / 'siddes_backend' / 'middleware.py'

if not target.exists():
    print(f"ERROR: missing {target}")
    sys.exit(1)

# Backup
rel = target.relative_to(root)
dest = backup_dir / rel
dest.parent.mkdir(parents=True, exist_ok=True)
shutil.copy2(target, dest)

text = target.read_text(encoding='utf-8')

new_block = r'''

# --- sd_395: Harden API request logging (no spoofing + redaction) -----------
class ApiRequestLogMiddleware:
    """Structured JSON request logs for /api/*.

    Security hardening:
    - viewer is derived from authenticated request.user only (prevents log poisoning)
    - query params are redacted for sensitive keys, and bounded in length
    - /api/auth/* query strings are omitted entirely

    Notes:
    - In DEBUG, we include dev_viewer for convenience, but it is never treated as truth.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request: HttpRequest):
        if not request.path.startswith("/api/"):
            return self.get_response(request)

        t0 = time.time()
        response: HttpResponse = self.get_response(request)
        dt_ms = int((time.time() - t0) * 1000)

        rid = (
            getattr(request, "siddes_request_id", None)
            or request.headers.get("X-Request-ID")
            or request.META.get("HTTP_X_REQUEST_ID")
        )
        rid = str(rid or "").strip()[:64] or None

        viewer = None
        try:
            user = getattr(request, "user", None)
            if user is not None and getattr(user, "is_authenticated", False):
                uid = getattr(user, "id", None)
                viewer = f"me_{uid}" if uid is not None else None
        except Exception:
            viewer = None

        dev_viewer = None
        try:
            if _truthy(os.environ.get("DJANGO_DEBUG", "1")):
                dv = request.headers.get("x-sd-viewer") or request.COOKIES.get("sd_viewer")
                dev_viewer = str(dv or "").strip()[:64] or None
        except Exception:
            dev_viewer = None

        side = None
        try:
            side = str(request.GET.get("side") or "").strip().lower()[:16] or None
        except Exception:
            side = None

        query_out = ""
        try:
            path = str(request.path or "")
            if path.startswith("/api/auth/"):
                query_out = ""
            else:
                qs = str(request.META.get("QUERY_STRING") or "")
                if qs:
                    import urllib.parse
                    sensitive = {
                        "token", "password", "pass", "passwd", "session", "sessionid",
                        "csrf", "csrftoken", "auth", "authorization", "apikey", "api_key",
                        "key", "secret", "code", "otp",
                    }
                    pairs = urllib.parse.parse_qsl(qs, keep_blank_values=True, strict_parsing=False)
                    red = []
                    for k, v in pairs[:60]:
                        kl = str(k).lower()
                        if kl in sensitive or any(s in kl for s in ("token", "pass", "secret", "key", "csrf", "session", "auth")):
                            red.append((k, "[REDACTED]"))
                        else:
                            vv = str(v)
                            if len(vv) > 200:
                                vv = vv[:200] + "…"
                            red.append((k, vv))
                    query_out = urllib.parse.urlencode(red, doseq=True)
                    if len(query_out) > 800:
                        query_out = query_out[:800] + "…"
        except Exception:
            query_out = ""

        payload = {
            "event": "api_request",
            "request_id": rid,
            "viewer": viewer,
            "dev_viewer": dev_viewer,
            "method": request.method,
            "path": request.path,
            "query": query_out,
            "side": side,
            "status": int(getattr(response, "status_code", 0) or 0),
            "latency_ms": dt_ms,
        }
        try:
            LOG_API.info(json.dumps(payload, separators=(",", ":")))
        except Exception:
            pass

        return response
# -----------------------------------------------------------------------------
'''

# Replace existing ApiRequestLogMiddleware class block if present.
pat = re.compile(r"(?s)\nclass ApiRequestLogMiddleware\b.*?(?=\nclass |\Z)")
m = pat.search(text)
if m:
    text2 = text[:m.start()] + "\n" + new_block.strip("\n") + "\n" + text[m.end():]
    target.write_text(text2, encoding='utf-8')
    print("OK: replaced ApiRequestLogMiddleware")
else:
    # If missing, append a new definition (will be used if referenced in settings).
    text2 = text.rstrip() + "\n" + new_block
    target.write_text(text2, encoding='utf-8')
    print("OK: appended ApiRequestLogMiddleware (was missing)")
PY

echo "✅ ${NAME} applied."
echo "Backups: ${BACKUP_DIR}"

echo "Next (VS Code terminal):"
echo "  docker compose -f ops/docker/docker-compose.dev.yml restart backend"

echo "Quick check (Django direct):"
echo "  curl -i \"http://127.0.0.1:8000/api/feed?side=public&token=abc123&author=foo\""
echo "  docker compose -f ops/docker/docker-compose.dev.yml logs -n 120 backend | grep api_request | tail -n 5"
