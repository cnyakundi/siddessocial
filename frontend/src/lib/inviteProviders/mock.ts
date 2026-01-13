"use client";

import type {
  InviteAction,
  InviteDirection,
  InviteListOpts,
  InviteProvider,
  SetInvite,
} from "@/src/lib/inviteProvider";
import type { SideId } from "@/src/lib/sides";
import { emitSetsChanged } from "@/src/lib/setsSignals";

function now(): number {
  return Date.now();
}

function newId(): string {
  return `iv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeHandle(raw: string): string {
  const t = (raw || "").trim();
  if (!t) return "";
  if (t.startsWith("@")) return t;
  return `@${t.replace(/^@+/, "")}`;
}

const SEED: SetInvite[] = [
  {
    id: "iv_seed_1",
    setId: "gym",
    side: "friends" as SideId,
    from: "me",
    to: "@jordan",
    status: "pending",
    message: "Join the Gym Squad",
    createdAt: now() - 86_400_000,
    updatedAt: now() - 86_400_000,
  },
];

let INVITES: SetInvite[] = [...SEED];

function visibleTo(viewer: string, inv: SetInvite): boolean {
  return inv.from === viewer || inv.to === viewer;
}

function applyAction(viewer: string, inv: SetInvite, action: InviteAction): SetInvite | null {
  if (action === "revoke") {
    if (inv.from !== viewer) return null;
    if (inv.status !== "pending") return inv;
    return { ...inv, status: "revoked", updatedAt: now() };
  }

  // accept/reject: only recipient
  if (inv.to !== viewer) return null;
  if (inv.status !== "pending") return inv;

  if (action === "accept") return { ...inv, status: "accepted", updatedAt: now() };
  if (action === "reject") return { ...inv, status: "rejected", updatedAt: now() };
  return null;
}

function directionFilter(viewer: string, direction: InviteDirection, inv: SetInvite): boolean {
  if (direction === "incoming") return inv.to === viewer;
  if (direction === "outgoing") return inv.from === viewer;
  return inv.from === viewer || inv.to === viewer;
}

export const mockProvider: InviteProvider = {
  name: "mock",

  async list(opts?: InviteListOpts): Promise<SetInvite[]> {
    const viewer = "me";
    const direction = (opts?.direction || "all") as InviteDirection;
    return INVITES.filter((x) => visibleTo(viewer, x)).filter((x) => directionFilter(viewer, direction, x)).sort((a, b) => b.updatedAt - a.updatedAt);
  },

  async get(id: string): Promise<SetInvite | null> {
    const viewer = "me";
    const inv = INVITES.find((x) => x.id === id);
    if (!inv) return null;
    return visibleTo(viewer, inv) ? inv : null;
  },

  async create(input): Promise<SetInvite> {
    const viewer = "me";
    const inv: SetInvite = {
      id: newId(),
      setId: input.setId,
      side: input.side,
      from: viewer,
      to: normalizeHandle(input.to) || "@unknown",
      status: "pending",
      message: (input.message || "").trim(),
      createdAt: now(),
      updatedAt: now(),
    };

    INVITES = [inv, ...INVITES];
    return inv;
  },

  async act(id: string, action: InviteAction): Promise<SetInvite | null> {
    const viewer = "me";
    const cur = INVITES.find((x) => x.id === id);
    if (!cur) return null;
    if (!visibleTo(viewer, cur)) return null;

    const nxt = applyAction(viewer, cur, action);
    if (!nxt) return null;

    INVITES = INVITES.map((x) => (x.id === id ? nxt : x));
    if (action === "accept" && nxt.status === "accepted") {
      emitSetsChanged();
    }
    return nxt;
  },
};
