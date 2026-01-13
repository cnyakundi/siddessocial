/**
 * In-memory invites store (dev/stub).
 * Persists only for lifetime of the Next.js node process.
 *
 * Contract:
 * - invites are visible only to sender or recipient
 * - acceptance updates the owning Set's members list (owner=from)
 */

import type { SideId } from "@/src/lib/sides";
import type { SetInvite } from "@/src/lib/inviteProvider";
import { getSet, updateSet } from "@/src/lib/server/setsStore";

export type InviteDirection = "incoming" | "outgoing" | "all";

export type CreateInviteInput = {
  setId: string;
  side: SideId;
  to: string;
  message?: string;
};

function now(): number {
  return Date.now();
}

function normalizeHandle(raw: string): string {
  const t = (raw || "").trim();
  if (!t) return "";
  if (t.startsWith("@")) return t;
  return `@${t.replace(/^@+/, "")}`;
}

function newId(): string {
  return `iv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

let INVITES: SetInvite[] = [];

export function listInvites(viewer: string, direction: InviteDirection = "all"): SetInvite[] {
  const v = String(viewer || "").trim();
  if (!v) return [];
  const out = INVITES.filter((inv) => {
    if (direction === "incoming") return inv.to === v;
    if (direction === "outgoing") return inv.from === v;
    return inv.from === v || inv.to === v;
  });
  out.sort((a, b) => b.updatedAt - a.updatedAt);
  return out;
}

export function getInvite(viewer: string, id: string): SetInvite | null {
  const v = String(viewer || "").trim();
  if (!v) return null;
  const inv = INVITES.find((x) => x.id === id);
  if (!inv) return null;
  if (inv.from !== v && inv.to !== v) return null;
  return inv;
}

export function createInvite(from: string, input: CreateInviteInput): SetInvite {
  const v = String(from || "").trim();
  const to = normalizeHandle(input.to);
  const t = now();

  // sd_141c: snapshot Set label at create-time so pending recipients can see it without Set access.
  let setLabel: string | undefined = undefined;
  try {
    const s = getSet(v, input.setId);
    const raw = (s && typeof (s as any).label === "string") ? (s as any).label : "";
    const cleaned = String(raw || "").trim();
    if (cleaned) setLabel = cleaned;
  } catch {
    // best-effort
  }

  const inv: SetInvite = {
    id: newId(),
    setId: input.setId,
    setLabel,
    side: input.side,
    from: v,
    to: to || "@unknown",
    status: "pending",
    message: (input.message || "").trim() || undefined,
    createdAt: t,
    updatedAt: t,
  };

  INVITES = [inv, ...INVITES];
  return inv;
}

export function actInvite(viewer: string, id: string, action: "accept" | "reject" | "revoke"): SetInvite | null {
  const v = String(viewer || "").trim();
  if (!v) return null;

  const cur = INVITES.find((x) => x.id === id);
  if (!cur) return null;

  // visibility
  if (cur.from !== v && cur.to !== v) return null;

  // revoke: only sender
  if (action === "revoke") {
    if (cur.from !== v) return null;
    if (cur.status !== "pending") return cur;
    const nxt = { ...cur, status: "revoked" as const, updatedAt: now() };
    INVITES = INVITES.map((x) => (x.id === id ? nxt : x));
    return nxt;
  }

  // accept/reject: only recipient
  if (cur.to !== v) return null;
  if (cur.status !== "pending") return cur;

  const status = action === "accept" ? "accepted" : "rejected";
  const nxt = { ...cur, status: status as any, updatedAt: now() };
  INVITES = INVITES.map((x) => (x.id === id ? nxt : x));

  // On accept: add member to the owner's Set (server-truth for owner).
  if (action === "accept") {
    try {
      const owner = cur.from;
      const set = getSet(owner, cur.setId);
      if (set) {
        const members = Array.isArray(set.members) ? set.members : [];
        if (!members.includes(cur.to)) {
          updateSet(owner, cur.setId, { members: [...members, cur.to] });
        }
      }
    } catch {
      // best-effort in stub mode
    }
  }

  return nxt;
}
