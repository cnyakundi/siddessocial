import type { SideId } from "@/src/lib/sides";
import type { SetColor } from "@/src/lib/setThemes";
import type { PublicChannelId } from "@/src/lib/publicChannels";
import type { TrustLevel } from "@/src/lib/trustLevels";

// sd_181s: Feed types (no mock data)

export type PostKind = "text" | "image" | "link";

// sd_384_media: attachments
export type MediaAttachment = {
  id: string;
  r2Key: string;
  kind: "image" | "video";
  contentType?: string;
  url: string; // /m/<r2_key>
};



export type EchoOf = {
  id: string;
  author: string;
  handle: string;
  time: string;
  content: string;
  kind: PostKind;
};
export type FeedPost = {
  id: string;
  author: string;
  handle: string;
  time: string;
  content: string;
  kind: PostKind;
  media?: MediaAttachment[];
  tags?: string[];
  publicChannel?: PublicChannelId;

  trustLevel?: TrustLevel;

  // v0 context metadata (for chips)
  setId?: string;
  setLabel?: string;
  setColor?: SetColor;
  context?: "mention";
  hasDoc?: boolean;
  urgent?: boolean;
  // Engagement (DB-backed)
  likeCount?: number;
  likes?: number; // legacy alias
  liked?: boolean;
  replyCount?: number;

  // Echo (real, DB-backed)
  echoCount?: number;
  echoed?: boolean;
  echoOf?: EchoOf | null;

  // Broadcast context (Public-only)
  broadcast?: { id: string; name: string; handle: string } | null;

  // sd_325: author affordances
  canEdit?: boolean;
  canDelete?: boolean;
  editedAt?: number; // ms since epoch
};
