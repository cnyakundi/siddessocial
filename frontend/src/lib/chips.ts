import { AtSign, FileText, AlertCircle, Users, Hash } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { FeedPost } from "@/src/lib/mockFeed";
import { getSetTheme, type SetColor } from "@/src/lib/setThemes";
import { FLAGS } from "@/src/lib/flags";
import { labelForPublicChannel, type PublicChannelId } from "@/src/lib/publicChannels";

export type ChipId = "set" | "mention" | "doc" | "urgent" | "channel";

export type Chip = {
  id: ChipId;
  label: string;
  icon: LucideIcon;
  className: string;
};

export type ChipBuildContext = {
  // viewer-private set membership label
  set?: { id: string; label: string; color: SetColor };

  // lightweight context signals
  mentionedYou?: boolean;
  doc?: boolean;
  urgent?: boolean;

  // Public Side: channel tag
  publicChannel?: PublicChannelId;
};

/**
 * chipsFromPost
 *
 * Extract chip-relevant context from a feed item. This is *purely* presentational
 * and should never be used as an access-control decision.
 */
export function chipsFromPost(post: FeedPost): ChipBuildContext {
  return {
    set: post.setId
      ? {
          id: post.setId,
          label: post.setLabel ?? "Set",
          color: (post.setColor ?? "orange") as any,
        }
      : undefined,
    mentionedYou: post.context === "mention",
    doc: Boolean(post.hasDoc) || post.kind === "link",
    urgent: Boolean(post.urgent) || (post.tags?.includes("urgent") ?? false),
    publicChannel: post.publicChannel,
  };
}

const CHANNEL_TO_COLOR: Record<PublicChannelId, SetColor> = {
  general: "slate",
  tech: "blue",
  politics: "purple",
  personal: "rose",
};

export function buildChips(ctx: ChipBuildContext): Chip[] {
  const out: Chip[] = [];

  if (FLAGS.publicChannels && ctx.publicChannel) {
    const t = getSetTheme(CHANNEL_TO_COLOR[ctx.publicChannel] ?? "slate");
    out.push({
      id: "channel",
      label: labelForPublicChannel(ctx.publicChannel),
      icon: Hash,
      className: `border ${t.bg} ${t.text} ${t.border}`,
    });
  }

  if (ctx.set) {
    const t = getSetTheme(ctx.set.color);
    out.push({
      id: "set",
      label: ctx.set.label,
      icon: Users,
      className: `border ${t.bg} ${t.text} ${t.border}`,
    });
  }

  if (ctx.mentionedYou) {
    out.push({
      id: "mention",
      label: "Mention",
      icon: AtSign,
      className: "bg-blue-50 text-blue-700 border border-blue-100",
    });
  }

  if (ctx.doc) {
    out.push({
      id: "doc",
      label: "Doc",
      icon: FileText,
      className: "bg-slate-100 text-slate-700 border border-slate-200",
    });
  }

  if (ctx.urgent) {
    out.push({
      id: "urgent",
      label: "Urgent",
      icon: AlertCircle,
      className: "bg-red-50 text-red-700 border border-red-100",
    });
  }

  return out;
}
