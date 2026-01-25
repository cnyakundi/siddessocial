import type { SideId } from "@/src/lib/sides";

// sd_181t: Inbox types (no mock data)
//
// sd_546: Thread items include participant identity hints for deterministic avatar variation.
// - participant.avatarSeed is used client-side ONLY for styling variation.
// - lockedSide remains the authoritative Side lock for the thread.
//
// Contract note:
// - updatedAt is **milliseconds since epoch** (number), per docs/INBOX_BACKEND_CONTRACT.md

export type InboxParticipant = {
  displayName?: string | null;
  initials?: string | null;
  avatarSeed?: string | null;
  userId?: string | null;
  handle?: string | null;
};

export type InboxThread = {
  id: string;
  title: string;
  participant?: InboxParticipant | null;
  lockedSide: SideId;
  last: string;
  time: string;
  unread: number;
  updatedAt: number;

  // Local-only: pinned threads (stored in localStorage)
  pinned?: boolean;
};


// sd_556_inbox_types: applied
