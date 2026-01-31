/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production";

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
];

// CSP-lite: compatible with Next.js without nonce plumbing.
// Tighten further once you add nonces/hashes.
const enableGoogleGSI = Boolean(String(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "").trim());

// Optional extra connect-src allowlist (space- or comma-separated), e.g.
// NEXT_PUBLIC_CSP_CONNECT_EXTRA="https://uploads.example.com https://cdn.example.com"
const extraConnectRaw = String(process.env.NEXT_PUBLIC_CSP_CONNECT_EXTRA || "").trim();
const extraConnect = extraConnectRaw
  ? extraConnectRaw
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
  : [];

// NOTE: Google Identity Services requires explicit allowlisting in CSP when enabled:
//   - script-src:  https://accounts.google.com/gsi/client
//   - frame-src:   https://accounts.google.com/gsi/
//   - connect-src: https://accounts.google.com/gsi/
//   - style-src:   https://accounts.google.com/gsi/style
//
// Cloudflare R2 direct uploads (presigned PUT URLs) require connect-src allowlisting.
const connectSrcAllow = [
  ...(enableGoogleGSI ? ["https://accounts.google.com/gsi/"] : []),
  // R2 S3 API endpoint domains (safe wildcard)
  "https://*.r2.cloudflarestorage.com",
  "https://*.r2.dev",
  ...extraConnect,
];

// Media is served either via:
// - Cloudflare Worker on the same origin (/m/*), OR
// - A short-lived redirect to an R2 signed URL (fallback).
// In both cases, we must allow R2 hosts for img/media loads.
const r2MediaAllow = [
  "https://*.r2.cloudflarestorage.com",
  "https://*.r2.dev",
];

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "img-src 'self' data: blob:" + (r2MediaAllow.length ? " " + r2MediaAllow.join(" ") : ""),
  "media-src 'self' data: blob:" + (r2MediaAllow.length ? " " + r2MediaAllow.join(" ") : ""),
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'" + (enableGoogleGSI ? " https://accounts.google.com/gsi/style" : ""),
  "script-src 'self' 'unsafe-inline'" + (enableGoogleGSI ? " https://accounts.google.com/gsi/client" : ""),
  "frame-src 'self'" + (enableGoogleGSI ? " https://accounts.google.com/gsi/" : ""),
  "connect-src 'self'" + (connectSrcAllow.length ? " " + connectSrcAllow.join(" ") : ""),
  "script-src-attr 'none'",
].join("; ");

const nextConfig = {
  reactStrictMode: true,
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  async rewrites() {
    return [
      { source: "/api/_diag", destination: "/api/diag" },
    ];
  },

async headers() {
    const hdrs = [...securityHeaders];
    if (isProd) {
      hdrs.push({ key: "Content-Security-Policy", value: csp });
    }
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-store, must-revalidate" },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" },
        ],
      },
            {
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store" },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" },
        ],
      },
      {
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/icons/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [
          { key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" },
        ],
      },
{
        source: "/(.*)",
        headers: hdrs,
      },
    ];
  },
};

module.exports = nextConfig;
