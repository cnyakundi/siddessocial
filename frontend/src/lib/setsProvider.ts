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
  // Leave a Set as a non-owner member. Returns updated Set (best-effort).
  leave: (id: string) => Promise<SetDef | null>;
  events: (id: string) => Promise<SetEvent[]>;
};

export function getSetsProvider(): SetsProvider {
  // sd_785: allow selecting the Sets provider (default: backend_stub for WhatsApp-like groups)
  // NOTE: The next line is intentionally grep-detectable by scripts/checks/sets_backend_stub_provider_check.sh
  // mode === "backend_stub"
  const providerMode = String((process.env.NEXT_PUBLIC_SETS_PROVIDER || process.env.NEXT_PUBLIC_SD_SETS_PROVIDER || "")).trim() || "backend_stub";
  if (providerMode === "backend_stub") return backendStubProvider;

  return backendStubProvider;
}



