// DEV-ONLY INBOX FIXTURES
//
// This file exists for harness + UI development.
// The real Siddes inbox is DB-backed (backend_stub provider) and does NOT import this file.
//
// IMPORTANT:
//   Do NOT wire this into real user paths.

import type { InboxThread } from "@/src/lib/inboxTypes";

// A tiny deterministic fixture set that includes required fields like `lockedSide` and `updatedAt`.
// Used only when developers explicitly import it for UI work.
export const MOCK_THREADS: InboxThread[] = [
  {
    id: "t_fixture_friends",
    title: "Nia",
    participant: { displayName: "Nia", initials: "N", avatarSeed: "seed_fixture_nia" },
    lockedSide: "friends",
    last: "You: see you soon",
    time: "5m",
    unread: 2,
    updatedAt: Date.now() - 5 * 60 * 1000,
  },
  {
    id: "t_fixture_close",
    title: "Close Vault",
    participant: { displayName: "Close Vault", initials: "CV", avatarSeed: "seed_fixture_close" },
    lockedSide: "close",
    last: "Them: got it",
    time: "1d",
    unread: 0,
    updatedAt: Date.now() - 24 * 60 * 60 * 1000,
  },
  {
    id: "t_fixture_work",
    title: "Project Pulse",
    participant: { displayName: "Project Pulse", initials: "PP", avatarSeed: "seed_fixture_work" },
    lockedSide: "work",
    last: "You: shipping today",
    time: "2h",
    unread: 1,
    updatedAt: Date.now() - 2 * 60 * 60 * 1000,
  },
];

export function getMockInboxThreads(): InboxThread[] {
  return MOCK_THREADS;
}
