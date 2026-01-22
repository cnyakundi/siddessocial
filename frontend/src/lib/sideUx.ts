import type { SideId } from "@/src/lib/sides";

/**
 * Side UX metadata (skin + microcopy) — intentionally NOT themes.
 *
 * Rules:
 * - No Tailwind classes here (themes live in lib/sides.ts).
 * - No React components/icons here (views map tool IDs -> icons).
 * - Keep this file pure data so it can be shared by web + native clients later.
 */

export type SideToolId =
  | "image"
  | "camera"
  | "mic"
  | "send"
  | "smile"
  | "heart"
  | "paperclip"
  | "checklist";

export type SidePersona = {
  name: string;
  metaphor: string;
  statsLabel?: string;
};

export type SideUx = {
  /** Room metaphor (long). */
  meaning: string;
  /** Short meaning for compact UI (eg. tabs row). */
  meaningShort: string;
  /** Default composer prompt for this Side (can be overridden by Set / channel). */
  composerPrompt: string;
  /** Suggested quick tools shown near composer (mapped in UI). */
  tools: SideToolId[];
  /** Optional persona framing for Prism / profile surfaces. */
  persona?: SidePersona;
};

export const SIDE_UX: Record<SideId, SideUx> = {
  public: {
    meaning: "The Billboard",
    meaningShort: "Everyone",
    composerPrompt: "Share with everyone…",
    tools: ["image", "send"],
    persona: {
      name: "You",
      metaphor: "Billboard Mode",
      statsLabel: "Reach",
    },
  },
  friends: {
    meaning: "The Living Room",
    meaningShort: "My friends",
    composerPrompt: "What’s happening with the squad?",
    tools: ["camera", "smile", "image"],
    persona: {
      name: "You",
      metaphor: "T‑Shirt Mode",
      statsLabel: "Friends",
    },
  },
  close: {
    meaning: "The Bedroom",
    meaningShort: "Only close people",
    composerPrompt: "Whisper to your inner circle…",
    tools: ["mic", "camera", "heart"],
    persona: {
      name: "You",
      metaphor: "Pajama Mode",
      statsLabel: "Close",
    },
  },
  work: {
    meaning: "The Office",
    meaningShort: "Work people",
    composerPrompt: "Log a status update…",
    tools: ["paperclip", "checklist", "send"],
    persona: {
      name: "You",
      metaphor: "Suit Mode",
      statsLabel: "Connections",
    },
  },
};
