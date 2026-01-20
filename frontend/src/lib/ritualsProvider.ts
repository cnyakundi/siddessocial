"use client";

// sd_338: Rituals provider interface

import type { SideId } from "@/src/lib/sides";
import type { RitualItem, RitualKind, RitualResponseItem } from "@/src/lib/ritualsTypes";
import { backendStubProvider } from "@/src/lib/ritualsProviders/backendStub";

export type RitualsDockOpts = {
  side: SideId;
  setId?: string | null;
};

export type CreateRitualInput = {
  side: SideId;
  setId?: string | null;
  kind: RitualKind;
  title?: string;
  prompt: string;
  expiresAt?: number | null;
};

export type RespondInput = {
  payload?: Record<string, any>;
  text?: string;
};

export type RitualsProvider = {
  name: "backend_stub";

  dock: (opts: RitualsDockOpts) => Promise<{ restricted: boolean; items: RitualItem[] }>;
  get: (id: string) => Promise<RitualItem | null>;

  create: (input: CreateRitualInput) => Promise<RitualItem>;
  ignite: (id: string) => Promise<RitualItem | null>;
  respond: (id: string, input: RespondInput) => Promise<RitualItem | null>;
  responses: (id: string) => Promise<RitualResponseItem[]>;
};

export function getRitualsProvider(): RitualsProvider {
  return backendStubProvider;
}
