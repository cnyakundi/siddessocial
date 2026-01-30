"use client";

import type { CircleColor } from "@/src/lib/circleThemes";
import type { SideId } from "@/src/lib/sides";

export type SuggestedCircle = {
  id: string;
  label: string;
  side?: SideId; // optional: suggested Side for the set
  color: CircleColor;
  members: string[]; // handles
  reason: string;
};

/**
 * Deprecated (no mock):
 * We do not generate fake suggestions (e.g., "Gym Squad").
 *
 * Use the on-device context engine instead:
 *   src/lib/localIntelligence/onDeviceContextEngine.ts
 * which clusters real matched contacts without server-side address book storage.
 */
export function getSuggestedCircles(_matchedHandles: string[]): SuggestedCircle[] {
  return [];
}
