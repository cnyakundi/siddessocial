"use client";

import type { SideId } from "@/src/lib/sides";
import type { SetColor } from "@/src/lib/setThemes";
import type { SetDef } from "@/src/lib/sets";
import type { SetEvent } from "@/src/lib/setEvents";
import { localProvider } from "@/src/lib/setsProviders/local";
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
  name: "local" | "backend_stub";

  list: (opts?: SetsListOpts) => Promise<SetDef[]>;
  get: (id: string) => Promise<SetDef | null>;

  create: (input: CreateSetInput) => Promise<SetDef>;
  bulkCreate: (inputs: CreateSetInput[]) => Promise<SetDef[]>;

  update: (id: string, patch: UpdateSetPatch) => Promise<SetDef | null>;
  events: (id: string) => Promise<SetEvent[]>;
};

export function getSetsProvider(): SetsProvider {
  const mode = (process.env.NEXT_PUBLIC_SETS_PROVIDER as "local" | "backend_stub" | undefined) || "local";

  if (mode === "backend_stub") return backendStubProvider;
  return localProvider;
}
