"use client";

import type { SideId } from "@/src/lib/sides";
import { backendStubProvider } from "@/src/lib/inviteProviders/backendStub";

export type InviteStatus = "pending" | "accepted" | "rejected" | "revoked";

export type SetInvite = {
  id: string;
  setId: string;
  /** Snapshot of the Set label at invite creation time (so pending recipients can see it without Set access). */
  setLabel?: string;
  side: SideId;
  from: string;
  to: string;
  status: InviteStatus;
  message?: string;
  createdAt: number;
  updatedAt: number;
};

export type InviteDirection = "incoming" | "outgoing" | "all";

export type InviteListOpts = {
  direction?: InviteDirection;
};

export type CreateInviteInput = {
  setId: string;
  side: SideId;
  to: string;
  message?: string;
};

export type InviteAction = "accept" | "reject" | "revoke";

export type InviteProvider = {
  name: "backend_stub";
  list: (opts?: InviteListOpts) => Promise<SetInvite[]>;
  get: (id: string) => Promise<SetInvite | null>;
  create: (input: CreateInviteInput) => Promise<SetInvite>;
  act: (id: string, action: InviteAction) => Promise<SetInvite | null>;
};

export function getInviteProvider(): InviteProvider {
  return backendStubProvider;
}



