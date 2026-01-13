"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Briefcase,
  Check,
  Globe,
  Lock,
  Settings,
  Shield,
  SlidersHorizontal,
  Users,
  Mail,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";
import { useSide } from "@/src/components/SideProvider";
import { SIDES, SIDE_THEMES, type SideId } from "@/src/lib/sides";
import { FLAGS } from "@/src/lib/flags";
import { EVT_PUBLIC_CALM_UI_CHANGED, loadPublicCalmUi, type PublicCalmUiState } from "@/src/lib/publicCalmUi";
import { isPublicSiding, togglePublicSiding } from "@/src/lib/publicSiding";
import { PublicChannelPrefsSheet } from "@/src/components/PublicChannelPrefsSheet";
import { PinnedStack } from "@/src/components/PinnedStack";
import { PublicSlate } from "@/src/components/PublicSlate";


import { getUser } from "@/src/lib/mockUsers";
import { MOCK_POSTS } from "@/src/lib/mockFeed";
import { PostCard } from "@/src/components/PostCard";
import { SET_THEMES } from "@/src/lib/setThemes";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

function AvatarXL() {
  return (
    <div className="w-20 h-20 rounded-full bg-gray-200 border border-gray-100 flex items-center justify-center text-gray-400">
      <span className="text-lg font-bold">U</span>
    </div>
  );
}

const SIDE_ICON: Record<SideId, LucideIcon> = {
  public: Globe,
  friends: Users,
  close: Shield,
  work: Briefcase,
};

export function ProfileView({
  userId,
  onBack,
}: {
  userId: string;
  onBack?: () => void;
}) {
  const { side: appSide } = useSide();
  const user = useMemo(() => getUser(userId), [userId]);
  const isSelf = user.id === "me";

  // Default to current app side ON FIRST RENDER only
  const [profileSide, setProfileSide] = useState<SideId>(appSide);

  // Public Granular Siding (local) — hydration-safe: read localStorage after mount.
  const [following, setFollowing] = useState(false);
  const [tuneOpen, setTuneOpen] = useState(false);

  // Public Visual Calm (counts) — hydration-safe: read localStorage after mount.
  const [publicCalm, setPublicCalm] = useState<PublicCalmUiState | null>(null);

  useEffect(() => {
    if (isSelf) return;
    if (!FLAGS.publicChannels) return;
    // Client-only read
    setFollowing(isPublicSiding(user.handle));
  }, [isSelf, user.handle]);


  useEffect(() => {
    if (!FLAGS.publicCalmUi) return;
    try {
      setPublicCalm(loadPublicCalmUi());
      const onChanged = () => setPublicCalm(loadPublicCalmUi());
      window.addEventListener(EVT_PUBLIC_CALM_UI_CHANGED, onChanged);
      return () => window.removeEventListener(EVT_PUBLIC_CALM_UI_CHANGED, onChanged);
    } catch {
      return;
    }
  }, []);

  const canGranularSiding = FLAGS.publicChannels && profileSide === "public" && !isSelf;

  const onToggleFollow = () => {
    const next = togglePublicSiding(user.handle);
    setFollowing(next);
    if (next && canGranularSiding) setTuneOpen(true);
  };

  const hasAccess = user.access[profileSide];
  const theme = SIDE_THEMES[profileSide];

  const calmHideCounts = profileSide === "public" && FLAGS.publicCalmUi && !(publicCalm?.showCounts);

  const posts = useMemo(() => {
    const all = MOCK_POSTS[profileSide] ?? [];
    return all.filter((p) => p.handle === user.handle);
  }, [profileSide, user.handle]);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="p-2 hover:bg-gray-100 rounded-full"
          aria-label="Back"
        >
          <ArrowLeft size={20} className="text-gray-600" />
        </button>

        <div className="font-bold text-lg text-gray-900 flex items-center gap-2">
          {user.name}
          {user.badges?.includes("Verified") ? (
            <Check size={16} className="text-blue-500" />
          ) : null}
        </div>
      </div>

      <div className="p-4">
        {/* Identity header */}
        <div className="flex justify-between items-start mb-4">
          <AvatarXL />

          <div className="flex gap-2 mt-2">
            {isSelf ? (
              <>
                <button className="px-4 py-2 rounded-full bg-gray-100 text-gray-700 font-bold text-sm">
                  Edit
                </button>
                <button
                  className="p-2 rounded-full bg-gray-100 text-gray-700"
                  aria-label="Settings"
                >
                  <Settings size={20} />
                </button>
              </>
            ) : (
              <>
                {canGranularSiding ? (
                  <>
                    <button
                      type="button"
                      onClick={onToggleFollow}
                      className={cn(
                        "px-6 py-2 rounded-full font-bold text-white text-sm shadow-sm inline-flex items-center justify-center gap-2",
                        following ? "bg-gray-900" : theme.primaryBg
                      )}
                    >
                      {following ? (
                        <>
                          <Check size={16} strokeWidth={2.5} />
                          Following
                        </>
                      ) : (
                        "Follow"
                      )}
                    </button>

                    {following ? (
                      <button
                        type="button"
                        className="p-2 rounded-full border border-gray-200 text-gray-700 hover:bg-gray-50"
                        aria-label="Tune public channels"
                        onClick={() => setTuneOpen(true)}
                        title="Granular Siding (Channels)"
                      >
                        <SlidersHorizontal size={20} />
                      </button>
                    ) : null}
                  </>
                ) : (
                  <button
                    className={cn(
                      "px-6 py-2 rounded-full font-bold text-white text-sm shadow-sm",
                      theme.primaryBg
                    )}
                  >
                    Follow
                  </button>
                )}

                <button
                  className="p-2 rounded-full border border-gray-200 text-gray-700"
                  aria-label="Message"
                >
                  <Mail size={20} />
                </button>
                <button
                  className="p-2 rounded-full border border-gray-200 text-gray-700"
                  aria-label="More"
                >
                  <MoreHorizontal size={20} />
                </button>
              </>
            )}
          </div>
        </div>

        <div className="mb-3">
          <h1 className="text-2xl font-bold leading-tight text-gray-900">{user.name}</h1>
          <div className="text-gray-500 text-sm">{user.handle}</div>
        </div>

        {/* Viewer-private Set labels (no leakage; these are your labels) */}
        {!isSelf && user.sets?.length ? (
          <div className="flex gap-2 mb-2 flex-wrap">
            {user.sets.map((s) => {
              const t = SET_THEMES[s.color] ?? SET_THEMES.orange;
              return (
                <span
                  key={s.id}
                  className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border inline-flex items-center gap-1",
                    t.bg,
                    t.text,
                    t.border
                  )}
                >
                  <Users size={10} />
                  {s.label}
                </span>
              );
            })}
          </div>
        ) : null}

        {/* Trust signals */}
        {user.badges?.length ? (
          <div className="flex gap-2 mb-3 flex-wrap">
            {user.badges.map((b) => (
              <span
                key={b}
                className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1"
              >
                {b.includes("Work") ? <Briefcase size={10} /> : null}
                {b}
              </span>
            ))}
          </div>
        ) : null}

        <p className="text-gray-800 mb-3">{user.bio}</p>

        {/* Chips */}
        {user.chips?.length ? (
          <div className="flex gap-2 mb-4 flex-wrap">
            {user.chips.map((c) => (
              <span
                key={c}
                className="text-xs bg-gray-50 text-gray-600 px-2 py-1 rounded-lg font-medium"
              >
                {c}
              </span>
            ))}
          </div>
        ) : null}

        {/* Relationship context */}
        {!isSelf && user.relationship ? (
          <div className="text-xs text-gray-500 mb-6 inline-flex items-center gap-1">
            <Users size={12} />
            {user.relationship}
          </div>
        ) : null}

        {/* Side strip (no counts to avoid leakage) */}
        <div className="flex gap-1 bg-gray-50 p-1 rounded-xl mb-6 overflow-x-auto no-scrollbar">
          {(Object.keys(SIDE_ICON) as SideId[]).map((s) => {
            const Icon = SIDE_ICON[s];
            const isActive = profileSide === s;
            const accessible = user.access[s];
            const st = SIDE_THEMES[s];

            return (
              <button
                key={s}
                type="button"
                onClick={() => setProfileSide(s)}
                className={cn(
                  "flex-1 min-w-[72px] flex flex-col items-center justify-center py-2 rounded-lg transition-all",
                  isActive ? "bg-white shadow-sm" : "hover:bg-gray-100 opacity-80"
                )}
              >
                <div className="relative">
                  <Icon size={18} className={cn(isActive ? st.text : "text-gray-500")} />
                  {!accessible ? (
                    <span className="absolute -top-1 -right-1 bg-white rounded-full">
                      <Lock size={10} className="text-gray-400" />
                    </span>
                  ) : null}
                </div>
                <span
                  className={cn(
                    "text-[10px] font-bold mt-1",
                    isActive ? st.text : "text-gray-400"
                  )}
                >
                  {SIDES[s].label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Content area */}
        {hasAccess ? (
          <div>
            {/* Pinned (optional) */}
            {profileSide === "public" && FLAGS.publicSlate ? (
              <>
                <PinnedStack items={user.pinnedStack ?? []} />

                {/* Legacy single pinned card (fallback when no stack exists) */}
                {!user.pinnedStack?.length && user.pinned ? (
                  <div
                    className={cn(
                      "mb-4 p-3 rounded-xl border flex items-center gap-3",
                      theme.border,
                      theme.lightBg
                    )}
                  >
                    <div className="text-xs font-bold uppercase tracking-wider text-gray-500">
                      Pinned
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-sm text-gray-900">
                        {user.pinned.title}
                      </div>
                    </div>
                  </div>
                ) : null}

                <PublicSlate targetHandle={user.handle} />
              </>
            ) : user.pinned ? (
              <div
                className={cn(
                  "mb-4 p-3 rounded-xl border flex items-center gap-3",
                  theme.border,
                  theme.lightBg
                )}
              >
                <div className="text-xs font-bold uppercase tracking-wider text-gray-500">
                  Pinned
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-sm text-gray-900">
                    {user.pinned.title}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="flex items-center gap-2 mb-4">
              <span className={cn("font-bold text-sm", theme.text)}>Posts</span>
              <span className="text-sm text-gray-400 px-2">Replies</span>
              <span className="text-sm text-gray-400 px-2">Media</span>
            </div>

            {posts.length ? (
              posts.map((p) => <PostCard key={p.id} post={p} side={profileSide} calmHideCounts={calmHideCounts} />)
            ) : (
              <div className="py-12 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                <p className="text-gray-400 text-sm">
                  No posts in {SIDES[profileSide].label} yet.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="py-16 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
            <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-3 text-gray-400">
              <Lock size={24} />
            </div>
            <h3 className="font-bold text-gray-900 mb-1">Private Content</h3>
            <p className="text-sm text-gray-500 px-8">
              You must be in {user.name.split(" ")[0]}'s {SIDES[profileSide].label} to see these posts.
            </p>
            {!isSelf ? (
              <button className="mt-4 px-4 py-2 rounded-full text-xs font-bold border border-gray-300 text-gray-700 hover:bg-white">
                Request Access
              </button>
            ) : null}
          </div>
        )}
      </div>

      {canGranularSiding ? (
        <PublicChannelPrefsSheet
          open={tuneOpen}
          onClose={() => setTuneOpen(false)}
          authorKey={user.handle}
          authorLabel={user.name}
        />
      ) : null}
    </div>
  );
}
