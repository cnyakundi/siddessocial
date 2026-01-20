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
};

export type InboxProviderListOpts = {
  side?: SideId;
  limit?: number;
  cursor?: string;
};

export type InboxProviderThreadOpts = {
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
  return backendStubProvider;
}
