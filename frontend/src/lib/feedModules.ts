"use client";

import type { SideId } from "@/src/lib/sides";
import type { SetDef } from "@/src/lib/sets";

export type FeedModuleKind =
  | "public_today"
  | "side_health"
  | "set_prompt"
  | "memory"
  | "work_triage";

export type FeedModule = {
  id: string;
  side: SideId;
  kind: FeedModuleKind;
  title: string;
  subtitle?: string;
  payload?: Record<string, any>;
};

export type FeedModulePlanEntry = {
  after: number; // insert after post index N (0-based). When no posts, rendered in plan order.
  module: FeedModule;
};

const STORAGE_KEY = "sd.feedModules.dismissed.v0";
export const EVT_FEED_MODULES_CHANGED = "sd.feedModules.changed";

const IS_PROD = process.env.NODE_ENV === "production";

type DismissedMap = Record<string, number>;

function hasWindow(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function loadDismissed(): DismissedMap {
  if (!hasWindow()) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as DismissedMap;
  } catch {
    return {};
  }
}

function saveDismissed(m: DismissedMap) {
  if (!hasWindow()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(m));
  } catch {
    // ignore
  }
}

function emitChanged() {
  if (!hasWindow()) return;
  try {
    window.dispatchEvent(new Event(EVT_FEED_MODULES_CHANGED));
  } catch {
    // ignore
  }
}

export function isFeedModuleDismissed(id: string): boolean {
  const m = loadDismissed();
  return typeof m[id] === "number";
}

export function dismissFeedModule(id: string) {
  const m = loadDismissed();
  m[id] = Date.now();
  saveDismissed(m);
  emitChanged();
}

export function undismissFeedModule(id: string) {
  const m = loadDismissed();
  if (m[id]) {
    delete m[id];
    saveDismissed(m);
    emitChanged();
  }
}

function clampAfter(after: number, postCount: number): number {
  if (postCount <= 0) return 0;
  const max = Math.max(0, postCount - 1);
  return Math.max(0, Math.min(after, max));
}

/**
 * planFeedModules
 * - UI-only modules that can be injected into SideFeed without backend dependency.
 * - Side-scoped.
 * - Default: max 2 modules per feed session.
 * - Never consecutive by construction (different after indices).
 */
export function planFeedModules(args: {
  side: SideId;
  sets: SetDef[];
  activeSet: SetDef | null;
  publicChannel: string; // "all" | <channelId>
  postCount: number;
}): FeedModulePlanEntry[] {
  const { side, sets, activeSet, publicChannel, postCount } = args;

  // UI-only feed modules are DEV-only until backed by real server data.
  if (IS_PROD) return [];

  const out: FeedModulePlanEntry[] = [];

  const add = (after: number, module: FeedModule) => {
    if (isFeedModuleDismissed(module.id)) return;
    out.push({ after: clampAfter(after, postCount), module });
  };

  if (side === "public") {
    if ((publicChannel || "all") === "all") {
      add(0, {
        id: "public_today",
        side,
        kind: "public_today",
        title: "Today in Public",
        subtitle: "Top topics right now",
        payload: {
          trends: [
            { tag: "Politics", count: "Top" },
            { tag: "Sports", count: "Rising" },
            { tag: "Tech", count: "Active" },
          ],
        },
      });
    }
  }

  if (side === "friends") {
    add(0, {
      id: "friends_side_health",
      side,
      kind: "side_health",
      title: "Friends Side Health",
      subtitle: "+3 new connections this week",
      payload: {
        stat: "+3",
        label: "New Friends sided you",
        insight: activeSet?.label
          ? `Most active set: ${activeSet.label}`
          : "Tip: Use Sets to avoid context collapse",
      },
    });

    const preferred = activeSet || sets.find((s) => s.side === "friends") || null;
    add(2, {
      id: "friends_set_prompt",
      side,
      kind: "set_prompt",
      title: preferred ? `Prompt • ${preferred.label}` : "Prompt",
      subtitle: "Quick check-in",
      payload: {
        setLabel: preferred?.label || "Friends",
        prompt: "What are you up to this week?",
        ctaLabel: "Post now",
      },
    });
  }

  if (side === "close") {
    add(1, {
      id: "close_memory",
      side,
      kind: "memory",
      title: "On this day",
      subtitle: "A gentle memory from Close",
      payload: {
        time: "1 year ago",
        text: "Weekend trip to the coast 🌊",
        image:
          "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&q=80",
      },
    });
  }

  if (side === "work") {
    add(0, {
      id: "work_triage",
      side,
      kind: "work_triage",
      title: "Morning triage",
      subtitle: "Start with what matters",
      payload: {
        dueToday: 2,
        waitingOnYou: 1,
      },
    });
  }

  // Cap modules (default 2)
  return out.slice(0, 2);
}
