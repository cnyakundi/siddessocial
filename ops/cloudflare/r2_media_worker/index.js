/**
 * Siddes R2 Media Worker (hardened)
 *
 * GET /m/<key>?t=<token> -> R2.get(key)
 * - Supports Range requests (video)
 * - Public tokens are cacheable (stable)
 * - Private tokens are short-lived and NOT cacheable
 *
 * Required secret:
 * - MEDIA_TOKEN_SECRET (must match Django SIDDES_MEDIA_TOKEN_SECRET)
 */

function parseRange(rangeHeader) {
  if (!rangeHeader) return null;
  const m = /^bytes=(\d+)-(\d+)?$/i.exec(rangeHeader.trim());
  if (!m) return null;
  const start = Number(m[1]);
  const end = m[2] ? Number(m[2]) : null;
  if (!Number.isFinite(start) || start < 0) return null;
  if (end !== null && (!Number.isFinite(end) || end < start)) return null;
  if (end === null) return { offset: start };
  return { offset: start, length: end - start + 1 };
}

function b64urlToBytes(s) {
  s = String(s || "").replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  const bin = atob(s + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64url(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let v = 0;
  for (let i = 0; i < a.length; i++) v |= a[i] ^ b[i];
  return v === 0;
}

async function hmacSha256(secret, dataBytes) {
  const keyBytes = new TextEncoder().encode(String(secret || ""));
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, dataBytes);
  return new Uint8Array(sig);
}

async function verifyToken(secret, key, token) {
  const t = String(token || "");
  const parts = t.split(".");
  if (parts.length !== 2) return { ok: false };

  const payloadB64 = parts[0];
  const sigB64 = parts[1];

  let payloadBytes;
  let sigBytes;
  try {
    payloadBytes = b64urlToBytes(payloadB64);
    sigBytes = b64urlToBytes(sigB64);
  } catch {
    return { ok: false };
  }

  const want = await hmacSha256(secret, payloadBytes);
  if (!timingSafeEqual(want, sigBytes)) return { ok: false };

  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(payloadBytes));
  } catch {
    return { ok: false };
  }

  const k = String(payload.k || "").replace(/^\/+/, "");
  if (!k || k !== String(key || "")) return { ok: false };

  const mode = String(payload.m || "priv");
  const exp = payload.e ? Number(payload.e) : null;
  if (exp && Number.isFinite(exp)) {
    const now = Math.floor(Date.now() / 1000);
    if (now > exp) return { ok: false, expired: true };
  }

  return { ok: true, mode };
}

// sd_792_worker_hardening: security + method gating + safe content types
function applySecurityHeaders(headers) {
  try {
    headers.set("x-content-type-options", "nosniff");
    headers.set("referrer-policy", "no-referrer");
    headers.set("cross-origin-resource-policy", "same-origin");
    headers.set("x-robots-tag", "noindex, nofollow");
  } catch {}
  return headers;
}

function clampContentType(headers) {
  try {
    const raw = String(headers.get("content-type") || "");
    const base = raw.split(";")[0].trim().toLowerCase();
    const isSvg = base === "image/svg+xml" || base.endsWith("+xml") && base.includes("svg");
    const safe = (base.startsWith("image/") || base.startsWith("video/")) && !isSvg;
    if (!safe) {
      headers.set("content-type", "application/octet-stream");
      if (!headers.has("content-disposition")) headers.set("content-disposition", "attachment");
    }
  } catch {}
}

function err(body, status, cacheControl, extra) {
  const headers = new Headers(extra || {});
  applySecurityHeaders(headers);
  headers.set("content-type", "text/plain; charset=utf-8");
  headers.set("cache-control", cacheControl || "private, no-store");
  return new Response(body, { status, headers });
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/m/")) return err("not_found", 404, "public, max-age=60");

    const m = String(request.method || "GET").toUpperCase();
    if (m !== "GET" && m !== "HEAD") {
      return err("method_not_allowed", 405, "private, no-store", { allow: "GET, HEAD" });
    }

    const secret = env.MEDIA_TOKEN_SECRET;
    if (!secret) return err("worker_not_configured", 503, "private, no-store");

    const key = decodeURIComponent(url.pathname.slice(3)).replace(/^\/+/, "");
    if (!key) return err("bad_request", 400, "private, no-store");
    // Restrict key namespace (defense-in-depth)
    if (!key.startsWith("u/")) return err("not_found", 404, "private, no-store");
    // Reject path tricks / weird bytes
    if (key.includes("..") || !/^[A-Za-z0-9_./~\-]+$/.test(key)) return err("bad_request", 400, "private, no-store");

    const token = url.searchParams.get("t") || "";
    if (!token) return err("restricted", 401, "private, no-store");

    const v = await verifyToken(secret, key, token);
    if (!v.ok) return err(v.expired ? "expired" : "forbidden", 401, "private, no-store");

    const range = parseRange(request.headers.get("range"));
    const obj = await env.MEDIA_BUCKET.get(key, range ? { range } : undefined);
    if (!obj || !obj.body) {
      const cc = v.mode === "pub" ? "public, max-age=60" : "private, no-store";
      return err("not_found", 404, cc);
    }

    const headers = new Headers();
    try {
      obj.writeHttpMetadata(headers);
    } catch {}

    headers.set("etag", obj.httpEtag);
    headers.set("accept-ranges", "bytes");
    headers.set("vary", "range");
    applySecurityHeaders(headers);
    clampContentType(headers);
// Cache rules:
    // - pub: safe to cache hard (token is stable, URL is stable)
    // - priv: never cache
    if (v.mode === "pub") {
      headers.set("cache-control", "public, max-age=31536000, immutable");
    } else {
      headers.set("cache-control", "private, no-store");
    }

    let status = 200;
    if (obj.range) {
      const off = Number(obj.range.offset || 0);
      const len = Number(obj.range.length || 0);
      if (len > 0) {
        const end = off + len - 1;
        headers.set("content-range", `bytes ${off}-${end}/${obj.size}`);
        status = 206;
      }
    }

    // HEAD support
    if (request.method === "HEAD") return new Response(null, { status, headers });

    return new Response(obj.body, { status, headers });
  },
};
