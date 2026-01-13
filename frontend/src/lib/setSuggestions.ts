"use client";

import type { SetColor } from "@/src/lib/setThemes";

export type SuggestedSet = {
  id: string;
  label: string;
  color: SetColor;
  members: string[]; // handles
  reason: string;
};

/**
 * v0: mock generator based on which matched contacts exist.
 * Real version will use clustering + interaction signals.
 */
export function getSuggestedSets(matchedHandles: string[]): SuggestedSet[] {
  const has = new Set(matchedHandles);

  const out: SuggestedSet[] = [];

  // Gym Squad
  if (has.has("@marc_us") || has.has("@sara_j")) {
    out.push({
      id: "suggest_gym",
      label: "Gym Squad",
      color: "orange",
      members: matchedHandles.filter((h) => ["@marc_us", "@sara_j"].includes(h)),
      reason: "You matched gym friends",
    });
  }

  // Weekend Crew
  if (has.has("@marc_us") || has.has("@elena")) {
    out.push({
      id: "suggest_weekend",
      label: "Weekend Crew",
      color: "purple",
      members: matchedHandles.filter((h) => ["@marc_us", "@elena"].includes(h)),
      reason: "You matched weekend friends",
    });
  }

  // Colleagues (example)
  const workish = matchedHandles.filter((h) => h.includes("pm") || h.includes("design") || h.includes("dev"));
  if (workish.length >= 2) {
    out.push({
      id: "suggest_work",
      label: "Colleagues",
      color: "slate",
      members: workish,
      reason: "Work-like handles detected",
    });
  }

  return out.filter((s) => s.members.length >= 2);
}
