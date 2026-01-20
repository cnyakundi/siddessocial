import { cookies } from "next/headers";

import type { TrustLevel } from "@/src/lib/trustLevels";
import { normalizeTrustLevel } from "@/src/lib/trustLevels";
import { roleForViewer } from "@/src/lib/server/inboxVisibility";

export type StubTrustResolution = {
  trustLevel: TrustLevel;
  source: "cookie" | "header" | "default" | null;
};

/**
 * resolveStubTrust
 *
 * Next.js API routes in this repo are fallback stubs.
 * This helper provides a *dev-only* trust band so we can model Public capabilities
 * (rate limits, link gating) without pretending we have real auth.
 *
 * Rules:
 * - In production, always return TrustLevel 0 (stubs must be default-safe).
 * - In dev, accept sd_trust cookie / x-sd-trust header.
 * - If missing, choose a deterministic default based on viewer role.
 */
export function resolveStubTrust(req: Request, viewerId: string | null): StubTrustResolution {
  if (process.env.NODE_ENV === "production") {
    return { trustLevel: 0, source: null };
  }

  const fallback = defaultTrustForViewer(viewerId);

  const c = cookies().get("sd_trust")?.value;
  if (c) {
    return { trustLevel: normalizeTrustLevel(c, fallback), source: "cookie" };
  }

  const h = req.headers.get("x-sd-trust");
  if (h) {
    return { trustLevel: normalizeTrustLevel(h, fallback), source: "header" };
  }

  return { trustLevel: fallback, source: "default" };
}

function defaultTrustForViewer(viewerId: string | null): TrustLevel {
  const role = roleForViewer(viewerId || "anon");
  switch (role) {
    case "me":
      return 3;
    case "work":
    case "close":
      return 2;
    case "friends":
      return 1;
    case "anon":
    default:
      return 0;
  }
}
