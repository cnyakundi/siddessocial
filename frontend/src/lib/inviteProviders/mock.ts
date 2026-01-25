"use client";

import type { CreateInviteInput, InviteAction, InviteDirection, InviteListOpts, InviteProvider, SetInvite } from "@/src/lib/inviteProvider";
import type { SideId } from "@/src/lib/sides";

/**
 * mock invite provider (dev-only)
 * This file exists to satisfy the invites scaffold check and to support offline UI work.
 * The app currently uses backendStubProvider by default.
 */

function now(): number {
  return Date.now();
}

function viewerHandle(): string {
  try {
    if (typeof document !== "undefined") {
      const m = document.cookie.match(/(?:^|;\s*)sd_viewer=([^;]+)/);
      if (m && m[1]) return decodeURIComponent(m[1]);
    }
  } catch {
    // ignore
  }
  return "@me";
}

function normalizeHandle(raw: string): string {
  const t = String(raw || "").trim();
  if (!t) return "";
  if (t.startsWith("@")) return t;
  return `@${t.replace(/^@+/, "")}`;
}

function newId(): string {
  return `iv_mock_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

let INVITES: SetInvite[] = [
  {
    id: "iv_mock_seed_1",
    setId: "set_demo",
    setLabel: "Demo Set",
    side: "friends" as SideId,
    from: "@alice",
    to: "@me",
    status: "pending",
    message: "Join my set?",
    createdAt: now() - 60_000,
    updatedAt: now() - 60_000,
  },
];

function visibleTo(v: string, inv: SetInvite): boolean {
  return inv.from === v || inv.to === v;
}

function filterDirection(v: string, inv: SetInvite, direction: InviteDirection): boolean {
  if (!visibleTo(v, inv)) return false;
  if (direction === "incoming") return inv.to === v;
  if (direction === "outgoing") return inv.from === v;
  return true;
}

export const mockProvider: InviteProvider = {
  // NOTE: type currently constrains name to "backend_stub"; keep it compatible.
  name: "backend_stub",

  async list(opts?: InviteListOpts): Promise<SetInvite[]> {
    const v = viewerHandle();
    const direction = (opts?.direction || "all") as InviteDirection;
    const items = INVITES.filter((inv) => filterDirection(v, inv, direction));
    items.sort((a, b) => b.updatedAt - a.updatedAt);
    return items;
  },

  async get(id: string): Promise<SetInvite | null> {
    const v = viewerHandle();
    const inv = INVITES.find((x) => x.id === id) || null;
    if (!inv) return null;
    return visibleTo(v, inv) ? inv : null;
  },

  async create(input: CreateInviteInput): Promise<SetInvite> {
    const v = viewerHandle();
    const to = normalizeHandle(input.to) || "@unknown";
    const t = now();
    const inv: SetInvite = {
      id: newId(),
      setId: input.setId,
      setLabel: undefined,
      side: (String(input.side || "friends").toLowerCase() as SideId) || "friends",
      from: v,
      to,
      status: "pending",
      message: String(input.message || "").trim() || undefined,
      createdAt: t,
      updatedAt: t,
    };
    INVITES = [inv, ...INVITES];
    return inv;
  },

  async act(id: string, action: InviteAction): Promise<SetInvite | null> {
    const v = viewerHandle();
    const cur = INVITES.find((x) => x.id === id) || null;
    if (!cur) return null;
    if (!visibleTo(v, cur)) return null;

    // revoke: sender only
    if (action === "revoke") {
      if (cur.from !== v) return null;
      if (cur.status !== "pending") return cur;
      const nxt = { ...cur, status: "revoked" as const, updatedAt: now() };
      INVITES = INVITES.map((x) => (x.id === id ? nxt : x));
      return nxt;
    }

    // accept/reject: recipient only
    if (cur.to !== v) return null;
    if (cur.status !== "pending") return cur;
    const nxt = { ...cur, status: action === "accept" ? ("accepted" as const) : ("rejected" as const), updatedAt: now() };
    INVITES = INVITES.map((x) => (x.id === id ? nxt : x));
    return nxt;
  },
};
