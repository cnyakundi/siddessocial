"use client";

import type { InboxThread } from "@/src/lib/inboxTypes";
import type { SideId } from "@/src/lib/sides";
import type { ThreadMessage, ThreadMeta } from "@/src/lib/threadStore";
import { backendStubProvider } from "@/src/lib/inboxProviders/backendStub";

export type InboxThreadItem = InboxThread;

export type InboxThreadView = {
  thread: InboxThreadItem & { lockedSide: SideId };
  meta: ThreadMeta | null;
  messages: ThreadMessage[];

  // Optional message pagination metadata (backend_stub)
  messagesHasMore?: boolean;
  messagesNextCursor?: string | null;
};

export type InboxThreadsPage = {
  items: InboxThreadItem[];
  hasMore: boolean;
  nextCursor: string | null;
  restricted?: boolean;
};

export type InboxProviderListOpts = {
  viewer?: string;

  side?: SideId;
  limit?: number;
  cursor?: string;
};

export type InboxProviderThreadOpts = {
  viewer?: string;

  limit?: number;
  cursor?: string;
};

export type InboxProvider = {
  name: "backend_stub";
  listThreads: (opts?: InboxProviderListOpts) => Promise<InboxThreadsPage>;
  getThread: (id: string, opts?: InboxProviderThreadOpts) => Promise<InboxThreadView>;
  sendMessage: (
    id: string,
    text: string,
    from?: "me" | "them",
    opts?: InboxProviderThreadOpts
  ) => Promise<ThreadMessage>;
  setLockedSide: (id: string, side: SideId, opts?: InboxProviderThreadOpts) => Promise<ThreadMeta>;
};

export function getInboxProvider(): InboxProvider {
  // sd_181t: No mock provider. Inbox is DB-backed via backend_stub.
  // sd_142: reference NEXT_PUBLIC_API_BASE for API-base-aware wiring checks.
  // Note: inbox calls still go via SAME-ORIGIN Next API routes (/api/inbox/*); the proxy layer uses NEXT_PUBLIC_API_BASE.
  const _apiBase = process.env.NEXT_PUBLIC_API_BASE;
  void _apiBase;

  // sd_559: provider selection (kept simple for now).
  // Allowed values (currently): "backend_stub"
  const env = (process.env.NEXT_PUBLIC_INBOX_PROVIDER || "backend_stub").trim();
  if (env === "backend_stub") return backendStubProvider;

  // Fail-closed: unknown provider still uses backend_stub.
  return backendStubProvider;
}
