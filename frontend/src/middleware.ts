import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * sd_252: X-Request-ID propagation
 *
 * - If the request has no X-Request-ID, generate one (edge-safe).
 * - Attach the same id to the response headers.
 *
 * This enables log correlation:
 * Browser -> Next routes -> Django.
 */
export function middleware(req: NextRequest) {
  const headers = new Headers(req.headers);

  let requestId = headers.get("x-request-id");
  if (!requestId) {
    requestId = crypto.randomUUID();
    headers.set("x-request-id", requestId);
  }

  const res = NextResponse.next({
    request: { headers },
  });

  // Mirror for client + downstream visibility.
  res.headers.set("x-request-id", requestId);

  return res;
}

// Exclude static assets.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
