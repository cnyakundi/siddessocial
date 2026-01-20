"use client";

import type { SideId } from "@/src/lib/sides";
import type { SetColor } from "@/src/lib/setThemes";
import type { SetDef } from "@/src/lib/sets";
import type { SetEvent } from "@/src/lib/setEvents";
import { backendStubProvider } from "@/src/lib/setsProviders/backendStub";

export type SetsListOpts = {
  side?: SideId;
};

export type CreateSetInput = {
  side?: SideId;
  label: string;
  members: string[];
  color?: SetColor;
};

export type UpdateSetPatch = Partial<Pick<Required<CreateSetInput>, "side" | "label" | "members" | "color">>;

export type SetsProvider = {
  name: "backend_stub";

  list: (opts?: SetsListOpts) => Promise<SetDef[]>;
  get: (id: string) => Promise<SetDef | null>;

  create: (input: CreateSetInput) => Promise<SetDef>;
  bulkCreate: (inputs: CreateSetInput[]) => Promise<SetDef[]>;

  update: (id: string, patch: UpdateSetPatch) => Promise<SetDef | null>;
  events: (id: string) => Promise<SetEvent[]>;
};

export function getSetsProvider(): SetsProvider {
  return backendStubProvider;
}



