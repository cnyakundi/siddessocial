"""Siddes EmailService adapter (Launch Part 0 / Workstream 0.1).

This is the base transactional-email foundation used by:
- email verification
- password reset
- security alerts (later)

Provider selection (env):
- SD_EMAIL_PROVIDER: console | smtp | sendgrid
- SD_EMAIL_FROM: default From address

SMTP (provider=smtp):
- SD_SMTP_HOST
- SD_SMTP_PORT (default 587)
- SD_SMTP_USER
- SD_SMTP_PASSWORD
- SD_SMTP_USE_TLS (default 1)
- SD_SMTP_USE_SSL (default 0)
- SD_SMTP_TIMEOUT (default 10)

SendGrid (provider=sendgrid):
- SD_SENDGRID_API_KEY

Notes:
- In dev, default provider is console.
- In prod (DJANGO_DEBUG=0), default provider is smtp.
- Logs are written to the structured "siddes.api" logger.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict, List, Optional, Sequence, Union

from django.core.mail import EmailMultiAlternatives, get_connection

try:
    import requests  # type: ignore
except Exception:  # pragma: no cover
    requests = None

LOG_API = logging.getLogger("siddes.api")


def _truthy(v: str | None) -> bool:
    return str(v or "").strip().lower() in ("1", "true", "yes", "y", "on")


def _env(name: str, default: str = "") -> str:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return str(raw).strip() or default


def _env_int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None:
        return default
    try:
        return int(str(raw).strip())
    except Exception:
        return default


def _truncate(s: str, n: int = 200) -> str:
    s = str(s or "")
    if len(s) <= n:
        return s
    return s[:n] + "..."


def _redact_email(email: str) -> str:
    e = str(email or "").strip()
    if "@" not in e:
        return _truncate(e, 24)
    local, domain = e.split("@", 1)
    local = (local[:2] + "***") if local else "***"
    domain = domain[:32]
    return f"{local}@{domain}"


def _as_list(to: Union[str, Sequence[str]]) -> List[str]:
    if isinstance(to, (list, tuple)):
        return [str(x).strip() for x in to if str(x).strip()]
    return [str(to).strip()] if str(to).strip() else []


def get_email_provider() -> str:
    debug = _truthy(os.environ.get("DJANGO_DEBUG", "1"))
    default_provider = "console" if debug else "smtp"
    return _env("SD_EMAIL_PROVIDER", default_provider).lower()


def get_email_from() -> str:
    return _env("SD_EMAIL_FROM", "no-reply@siddes.local")


def send_email(
    to: Union[str, Sequence[str]],
    subject: str,
    text: str,
    html: Optional[str] = None,
    request_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Send a transactional email using the configured provider.

    Returns a small dict suitable for API responses or command output.
    """

    provider = get_email_provider()
    from_addr = get_email_from()
    to_list = _as_list(to)

    if not to_list:
        return {"ok": False, "error": "missing_to", "provider": provider}

    rid = str(request_id or "").strip()[:64] or None

    if provider == "console":
        payload = {
            "event": "email_console",
            "provider": "console",
            "request_id": rid,
            "from": _redact_email(from_addr),
            "to": [_redact_email(x) for x in to_list][:10],
            "to_count": len(to_list),
            "subject": _truncate(subject, 120),
            "text_preview": _truncate(text, 240),
            "has_html": bool(html),
        }
        LOG_API.info(json.dumps(payload, separators=(",", ":")))
        return {"ok": True, "provider": "console"}

    if provider == "smtp":
        host = _env("SD_SMTP_HOST", "")
        if not host:
            return {"ok": False, "error": "missing_smtp_host", "provider": "smtp"}

        port = _env_int("SD_SMTP_PORT", 587)
        username = _env("SD_SMTP_USER", "")
        password = _env("SD_SMTP_PASSWORD", "")
        use_tls = _truthy(_env("SD_SMTP_USE_TLS", "1"))
        use_ssl = _truthy(_env("SD_SMTP_USE_SSL", "0"))
        timeout = _env_int("SD_SMTP_TIMEOUT", 10)

        try:
            conn = get_connection(
                backend="django.core.mail.backends.smtp.EmailBackend",
                host=host,
                port=port,
                username=username,
                password=password,
                use_tls=use_tls,
                use_ssl=use_ssl,
                timeout=timeout,
            )
            msg = EmailMultiAlternatives(
                subject=str(subject),
                body=str(text),
                from_email=from_addr,
                to=to_list,
                connection=conn,
            )
            if html:
                msg.attach_alternative(str(html), "text/html")
            sent = int(msg.send(fail_silently=False) or 0)

            LOG_API.info(
                json.dumps(
                    {
                        "event": "email_send",
                        "provider": "smtp",
                        "request_id": rid,
                        "to_count": len(to_list),
                        "to": [_redact_email(x) for x in to_list][:10],
                        "subject": _truncate(subject, 120),
                        "sent": sent,
                    },
                    separators=(",", ":"),
                )
            )
            return {"ok": True, "provider": "smtp", "sent": sent}
        except Exception as e:
            LOG_API.info(
                json.dumps(
                    {
                        "event": "email_send_failed",
                        "provider": "smtp",
                        "request_id": rid,
                        "to_count": len(to_list),
                        "subject": _truncate(subject, 120),
                        "error": str(getattr(e, "message", None) or e)[:240],
                    },
                    separators=(",", ":"),
                )
            )
            return {"ok": False, "provider": "smtp", "error": "smtp_send_failed"}

    if provider == "sendgrid":
        if requests is None:
            return {"ok": False, "provider": "sendgrid", "error": "requests_not_installed"}

        api_key = _env("SD_SENDGRID_API_KEY", "")
        if not api_key:
            return {"ok": False, "provider": "sendgrid", "error": "missing_sendgrid_api_key"}

        url = "https://api.sendgrid.com/v3/mail/send"
        payload: Dict[str, Any] = {
            "personalizations": [{"to": [{"email": x} for x in to_list]}],
            "from": {"email": from_addr},
            "subject": str(subject),
            "content": [{"type": "text/plain", "value": str(text)}],
        }
        if html:
            payload["content"].append({"type": "text/html", "value": str(html)})

        try:
            resp = requests.post(
                url,
                headers={
                    "authorization": f"Bearer {api_key}",
                    "content-type": "application/json",
                },
                json=payload,
                timeout=10,
            )
        except Exception as e:
            LOG_API.info(
                json.dumps(
                    {
                        "event": "email_send_failed",
                        "provider": "sendgrid",
                        "request_id": rid,
                        "to_count": len(to_list),
                        "subject": _truncate(subject, 120),
                        "error": str(getattr(e, "message", None) or e)[:240],
                    },
                    separators=(",", ":"),
                )
            )
            return {"ok": False, "provider": "sendgrid", "error": "sendgrid_request_failed"}

        ok = 200 <= int(getattr(resp, "status_code", 0) or 0) < 300
        msg_id = None
        try:
            msg_id = resp.headers.get("x-message-id") or resp.headers.get("X-Message-Id")
        except Exception:
            msg_id = None

        if not ok:
            detail: Any = None
            try:
                detail = resp.json()
            except Exception:
                detail = _truncate(getattr(resp, "text", "") or "", 500)

            LOG_API.info(
                json.dumps(
                    {
                        "event": "email_send_failed",
                        "provider": "sendgrid",
                        "request_id": rid,
                        "status": int(getattr(resp, "status_code", 0) or 0),
                        "to_count": len(to_list),
                        "subject": _truncate(subject, 120),
                        "detail": detail if isinstance(detail, (str, int, float, bool, type(None))) else "see_provider_logs",
                    },
                    separators=(",", ":"),
                )
            )
            return {"ok": False, "provider": "sendgrid", "error": "sendgrid_send_failed", "status": int(resp.status_code)}

        LOG_API.info(
            json.dumps(
                {
                    "event": "email_send",
                    "provider": "sendgrid",
                    "request_id": rid,
                    "to_count": len(to_list),
                    "to": [_redact_email(x) for x in to_list][:10],
                    "subject": _truncate(subject, 120),
                    "message_id": msg_id,
                },
                separators=(",", ":"),
            )
        )
        return {"ok": True, "provider": "sendgrid", "status": int(resp.status_code), "message_id": msg_id}

    return {"ok": False, "error": "unknown_provider", "provider": provider}
