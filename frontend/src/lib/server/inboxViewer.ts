import { cookies } from "next/headers";

export type StubViewerResolution = {
  viewerId: string | null;
  source: "cookie" | "header" | null;
};

function isLocalHost(req: Request): boolean {
  const raw = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "").toLowerCase();
  const host = raw.split(",")[0].trim();
  return host.startsWith("localhost") || host.startsWith("127.0.0.1") || host.startsWith("[::1]");
}

/**
 * resolveStubViewer
 *
 * Next.js API routes in this repo are fallback *stubs*.
 * They must remain default-safe and never be treated as production auth.
 *
 * Rules:
 * - Never accept viewer identity via URL query params.
 * - Missing viewer => treated as unknown => restricted=true
 * - In production builds, we intentionally disable stub identity (viewerId=null),
 *   EXCEPT for local-only production builds (host=localhost/127.0.0.1) (sd_742).
 */
export function resolveStubViewer(req: Request): StubViewerResolution {
  // If someone accidentally deploys the Next stubs to production,
  // we must not let a client spoof private access via cookies/headers.
  if (process.env.NODE_ENV === "production" && !isLocalHost(req)) {
    return { viewerId: null, source: null };
  }

  const c = cookies().get("sd_viewer")?.value;
  if (c) return { viewerId: c, source: "cookie" };

  const h = req.headers.get("x-sd-viewer");
  if (h) return { viewerId: h, source: "header" };

  return { viewerId: null, source: null };
}
