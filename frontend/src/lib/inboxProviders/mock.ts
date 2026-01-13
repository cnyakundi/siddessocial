"use client";

import type {
  InboxProvider,
  InboxProviderListOpts,
  InboxProviderThreadOpts,
  InboxThreadView,
  InboxThreadsPage,
} from "@/src/lib/inboxProvider";
import { MOCK_THREADS } from "@/src/lib/mockInbox";
import type { SideId } from "@/src/lib/sides";
import {
  appendMessage,
  ensureThreadLockedSide,
  loadThread,
  loadThreadMeta,
  setThreadLockedSide,
  type ThreadMessage,
  type ThreadMeta,
} from "@/src/lib/threadStore";

export const mockProvider: InboxProvider = {
  name: "mock",

  async listThreads(_opts?: InboxProviderListOpts): Promise<InboxThreadsPage> {
    return { items: MOCK_THREADS, hasMore: false, nextCursor: null };
  },

  async getThread(id: string, _opts?: InboxProviderThreadOpts): Promise<InboxThreadView> {
    const thread = MOCK_THREADS.find((t) => t.id === id) || MOCK_THREADS[0];
    const meta = ensureThreadLockedSide(id, (thread?.lockedSide ?? "friends") as SideId);
    const messages = loadThread(id);
    const storedMeta = loadThreadMeta(id);
    return {
      thread: { ...thread, lockedSide: meta.lockedSide },
      meta: storedMeta,
      messages,
      messagesHasMore: false,
      messagesNextCursor: null,
    };
  },

  async sendMessage(
    id: string,
    text: string,
    from: "me" | "them" = "me",
    _opts?: InboxProviderThreadOpts
  ): Promise<ThreadMessage> {
    const meta = ensureThreadLockedSide(id, "friends");
    return appendMessage(id, { from, text, side: meta.lockedSide });
  },

  async setLockedSide(id: string, side: SideId, _opts?: InboxProviderThreadOpts): Promise<ThreadMeta> {
    return setThreadLockedSide(id, side);
  },
};
