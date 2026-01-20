"use client";

import type { SetColor } from "@/src/lib/setThemes";
import type { SideId } from "@/src/lib/sides";

export type SuggestedSet = {
  id: string;
  label: string;
  side?: SideId; // optional: suggested Side for the set
  color: SetColor;
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
export function getSuggestedSets(_matchedHandles: string[]): SuggestedSet[] {
  return [];
}
