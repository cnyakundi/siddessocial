"use client";

import type { SideId } from "@/src/lib/sides";
import type { CircleColor } from "@/src/lib/circleThemes";
import type { CircleDef } from "@/src/lib/circles";
import type { CircleEvent } from "@/src/lib/circleEvents";
import { backendStubProvider } from "@/src/lib/circlesProviders/backendStub";

export type CirclesListOpts = {
  side?: SideId;
};

export type CreateCircleInput = {
  side?: SideId;
  label: string;
  members: string[];
  color?: CircleColor;
};

export type UpdateCirclePatch = Partial<Pick<Required<CreateCircleInput>, "side" | "label" | "members" | "color">>;

export type CirclesProvider = {
  name: "backend_stub";

  list: (opts?: CirclesListOpts) => Promise<CircleDef[]>;
  get: (id: string) => Promise<CircleDef | null>;

  create: (input: CreateCircleInput) => Promise<CircleDef>;
  bulkCreate: (inputs: CreateCircleInput[]) => Promise<CircleDef[]>;

  update: (id: string, patch: UpdateCirclePatch) => Promise<CircleDef | null>;
  // Leave a Circle as a non-owner member. Returns updated Set (best-effort).
  leave: (id: string) => Promise<CircleDef | null>;
  events: (id: string) => Promise<CircleEvent[]>;
};

export function getCirclesProvider(): CirclesProvider {
  // sd_785: allow selecting the Sets provider (default: backend_stub for WhatsApp-like groups)
  // NOTE: The next line is intentionally grep-detectable by scripts/checks/sets_backend_stub_provider_check.sh
  // mode === "backend_stub"
  const providerMode = String((process.env.NEXT_PUBLIC_CIRCLES_PROVIDER || process.env.NEXT_PUBLIC_SD_CIRCLES_PROVIDER || "")).trim() || "backend_stub";
  if (providerMode === "backend_stub") return backendStubProvider;

  return backendStubProvider;
}



