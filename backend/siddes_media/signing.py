"""AWS Signature V4 presigning (S3-compatible) for Cloudflare R2.

We avoid pulling in boto3 to keep backend requirements small.

R2 S3-compatible API notes:
- Region is typically "auto".
- Service is "s3".

This module creates presigned URLs for PUT/GET.
"""

from __future__ import annotations

import hashlib
import hmac
from datetime import datetime, timezone
from urllib.parse import quote, urlencode, urlparse


def _hmac(key: bytes, msg: str) -> bytes:
    return hmac.new(key, msg.encode('utf-8'), hashlib.sha256).digest()


def _sha256_hex(s: str) -> str:
    return hashlib.sha256(s.encode('utf-8')).hexdigest()


def _signing_key(secret_key: str, date_yyyymmdd: str, region: str, service: str) -> bytes:
    k_date = _hmac(('AWS4' + secret_key).encode('utf-8'), date_yyyymmdd)
    k_region = hmac.new(k_date, region.encode('utf-8'), hashlib.sha256).digest()
    k_service = hmac.new(k_region, service.encode('utf-8'), hashlib.sha256).digest()
    k_signing = hmac.new(k_service, b'aws4_request', hashlib.sha256).digest()
    return k_signing


def presign_s3_url(
    *,
    method: str,
    endpoint: str,
    bucket: str,
    key: str,
    access_key_id: str,
    secret_access_key: str,
    expires: int = 300,
    region: str = 'auto',
    service: str = 's3',
) -> str:
    """Return a presigned URL (query auth) for the S3-compatible API.

    Uses path-style: {endpoint}/{bucket}/{key}
    """

    method_u = (method or 'GET').upper()

    ep = str(endpoint or '').strip()
    if not ep:
        raise ValueError('missing endpoint')

    # Accept both https://... and host:port forms
    if '://' not in ep:
        ep = 'https://' + ep

    pu = urlparse(ep)
    scheme = pu.scheme or 'https'
    host = pu.netloc or pu.path
    host = host.strip()
    if not host:
        raise ValueError('invalid endpoint')

    now = datetime.now(timezone.utc)
    amz_date = now.strftime('%Y%m%dT%H%M%SZ')
    date_stamp = now.strftime('%Y%m%d')

    # Canonical URI (path-style). Keep '/' safe so keys can contain folders.
    bucket_enc = quote(bucket, safe='')
    key_enc = quote(key, safe='/~')
    canonical_uri = f'/{bucket_enc}/{key_enc}'

    credential_scope = f'{date_stamp}/{region}/{service}/aws4_request'

    query = {
        'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
        'X-Amz-Credential': f'{access_key_id}/{credential_scope}',
        'X-Amz-Date': amz_date,
        'X-Amz-Expires': str(int(expires)),
        'X-Amz-SignedHeaders': 'host',
    }

    canonical_querystring = urlencode(sorted(query.items()), quote_via=quote, safe='=')

    canonical_headers = f'host:{host}\n'
    signed_headers = 'host'
    payload_hash = 'UNSIGNED-PAYLOAD'

    canonical_request = '\n'.join([
        method_u,
        canonical_uri,
        canonical_querystring,
        canonical_headers,
        signed_headers,
        payload_hash,
    ])

    string_to_sign = '\n'.join([
        'AWS4-HMAC-SHA256',
        amz_date,
        credential_scope,
        _sha256_hex(canonical_request),
    ])

    signing_key = _signing_key(secret_access_key, date_stamp, region, service)
    signature = hmac.new(signing_key, string_to_sign.encode('utf-8'), hashlib.sha256).hexdigest()

    final_qs = canonical_querystring + '&X-Amz-Signature=' + signature
    return f'{scheme}://{host}{canonical_uri}?{final_qs}'
