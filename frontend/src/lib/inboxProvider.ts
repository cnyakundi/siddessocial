"use client";

import type { InboxThread } from "@/src/lib/mockInbox";
import type { SideId } from "@/src/lib/sides";
import type { ThreadMessage, ThreadMeta } from "@/src/lib/threadStore";
import { mockProvider } from "@/src/lib/inboxProviders/mock";
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
  viewer?: string;
  limit?: number;
  cursor?: string;
};

export type InboxProviderThreadOpts = {
  viewer?: string;
  limit?: number;
  cursor?: string;
};

export type InboxProvider = {
  name: "mock" | "backend_stub";
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
  const mode = process.env.NEXT_PUBLIC_INBOX_PROVIDER as "mock" | "backend_stub" | undefined;
  if (mode === "backend_stub") return backendStubProvider;
  if (mode === "mock") return mockProvider;

  // Beginner-safe default:
  // - When `NEXT_PUBLIC_API_BASE` is present (Docker full stack), prefer backend_stub.
  // - Otherwise fall back to mock.
  const hasApiBase = Boolean(String(process.env.NEXT_PUBLIC_API_BASE || "").trim());
  return hasApiBase ? backendStubProvider : mockProvider;
}
