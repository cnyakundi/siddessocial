// sd_338: Rituals types (frontend)

import type { SideId } from "@/src/lib/sides";

export type RitualStatus = "proposed" | "warming" | "active" | "archived" | string;

// Keep extensible: backend may add more kinds.
export type RitualKind = "mood" | "reading" | "question" | "townhall" | string;

export type RitualItem = {
  id: string;
  kind: RitualKind;
  title: string;
  prompt: string;
  status: RitualStatus;
  side: SideId;
  setId: string | null;
  createdBy: string;
  createdAt: number;
  expiresAt: number | null;
  igniteThreshold: number;
  ignites: number;
  replies: number;
  data: Record<string, any>;
};

export type RitualResponseItem = {
  id: string;
  by: string;
  byDisplay?: { id?: string; handle?: string; name?: string };
  createdAt: number;
  kind: string;
  payload: Record<string, any>;
  text: string;
};
