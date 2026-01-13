/**
 * inboxVisibility.ts
 * Deterministic visibility shim for backend stub inbox routes.
 * Goal: stop leaks-by-default and make testing predictable.
 */

export type SideId = "public" | "friends" | "close" | "work";

export type ViewerRole = "anon" | "friends" | "close" | "work" | "me";

export function normalizeViewer(raw?: string | null): string {
  const v = (raw || "").trim();
  return v || "anon";
}

export function roleForViewer(viewer: string): ViewerRole {
  const v = normalizeViewer(viewer).toLowerCase();

  if (v === "me" || v.startsWith("me_")) return "me";

  if (v === "friends" || v === "friend" || v.startsWith("fr_")) return "friends";
  if (v === "close" || v.startsWith("cl_")) return "close";
  if (v === "work" || v === "coworker" || v.startsWith("wk_")) return "work";

  if (v === "anon" || v === "anonymous") return "anon";
  return "anon";
}

export function allowedSidesForRole(role: ViewerRole): SideId[] {
  switch (role) {
    case "me":
      return ["public", "friends", "close", "work"];
    case "friends":
      return ["public", "friends"];
    case "close":
      return ["public", "friends", "close"];
    case "work":
      return ["public", "work"];
    case "anon":
    default:
      return ["public"];
  }
}

export function allowedSidesForViewer(viewer: string): SideId[] {
  return allowedSidesForRole(roleForViewer(viewer));
}

export function viewerAllowed(viewer: string, side: string): boolean {
  const s = String(side || "").toLowerCase() as SideId;
  const allowed = new Set(allowedSidesForViewer(viewer));
  return allowed.has(s);
}

/**
 * Deterministic test vectors for gate scripts / docs.
 */
export const STUB_VISIBILITY_TEST_VECTORS: Array<{
  viewer: string;
  role: ViewerRole;
  allow: SideId[];
  deny: SideId[];
}> = [
  { viewer: "anon", role: "anon", allow: ["public"], deny: ["friends", "close", "work"] },
  { viewer: "friends", role: "friends", allow: ["public", "friends"], deny: ["close", "work"] },
  { viewer: "close", role: "close", allow: ["public", "friends", "close"], deny: ["work"] },
  { viewer: "work", role: "work", allow: ["public", "work"], deny: ["friends", "close"] },
  { viewer: "me", role: "me", allow: ["public", "friends", "close", "work"], deny: [] },
];
