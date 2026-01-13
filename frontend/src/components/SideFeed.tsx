"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { useSide } from "@/src/components/SideProvider";
import { SIDES, type SideId } from "@/src/lib/sides";
import { PostCard } from "@/src/components/PostCard";
import { SetsChipsRow } from "@/src/components/SetsChipsRow";
import { ImportSetSheet } from "@/src/components/ImportSetSheet";
import { DEFAULT_SETS, type SetDef, type SetId } from "@/src/lib/sets";
import { getSetsProvider } from "@/src/lib/setsProvider";
import { getLastSeenId, setLastSeenId } from "@/src/lib/lastSeen";
import { getFeedProvider, type FeedItem } from "@/src/lib/feedProvider";
import { FLAGS } from "@/src/lib/flags";
import { EVT_PUBLIC_CALM_UI_CHANGED, loadPublicCalmUi, savePublicCalmUi, type PublicCalmUiState } from "@/src/lib/publicCalmUi";
import { PUBLIC_CHANNELS, type PublicChannelId } from "@/src/lib/publicChannels";
import { EVT_PUBLIC_SIDING_CHANGED, loadPublicSiding, type PublicSidingState } from "@/src/lib/publicSiding";
import {
  EVT_PUBLIC_TRUST_DIAL_CHANGED,
  loadPublicTrustMode,
  minTrustForMode,
  savePublicTrustMode,
  type PublicTrustMode,
} from "@/src/lib/publicTrustDial";

function EmptyState({ side, activeSet }: { side: SideId; activeSet?: SetId | null }) {
  return (
    <div className="text-center py-16">
      <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
        <Sparkles size={32} />
      </div>
      <p className="text-gray-500 text-sm mb-2">{activeSet ? "No posts in this Set yet." : "It’s quiet here…"}</p>
      <p className="text-gray-400 text-xs">
        This is the {SIDES[side].label} Side. Later we’ll seed and personalize this feed.
      </p>
    </div>
  );
}

function Divider() {
  return (
    <div className="flex items-center gap-4 my-6 opacity-70" data-testid="new-since-divider">
      <div className="h-px bg-gray-300 flex-1" />
      <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">New since last visit</span>
      <div className="h-px bg-gray-300 flex-1" />
    </div>
  );
}

export function SideFeed() {
  const { side } = useSide();
  const [activeSet, setActiveSet] = useState<SetId | null>(null);
  const [publicChannel, setPublicChannel] = useState<"all" | PublicChannelId>("all");
  const [trustMode, setTrustMode] = useState<PublicTrustMode>("standard");
  const [importOpen, setImportOpen] = useState(false);

  // Public Granular Siding state (hydration-safe: loaded after mount)
  const [publicSiding, setPublicSiding] = useState<PublicSidingState | null>(null);

  // Public Visual Calm (counts) state (hydration-safe: loaded after mount)
  const [publicCalm, setPublicCalm] = useState<PublicCalmUiState | null>(null);

  const setsProvider = useMemo(() => getSetsProvider(), []);
  const [sets, setSets] = useState<SetDef[]>(() => DEFAULT_SETS);

  const provider = useMemo(() => getFeedProvider(), []);
  const [rawPosts, setRawPosts] = useState<FeedItem[]>([]);

  useEffect(() => {
    let mounted = true;
    provider.list(side).then((items) => {
      if (!mounted) return;
      setRawPosts(items);
    });
    return () => {
      mounted = false;
    };
  }, [side, provider]);

  // Hydration-safe Sets load: only read localStorage / fetch after mount.
  useEffect(() => {
    let mounted = true;
    setsProvider
      .list({ side: "friends" })
      .then((items) => {
        if (!mounted) return;
        setSets(items);
      })
      .catch(() => {
        // ignore
      });
    return () => {
      mounted = false;
    };
  }, [setsProvider]);

  // Hydration-safe: only read localStorage after mount.
  useEffect(() => {
    if (!FLAGS.publicChannels) return;
    try {
      setPublicSiding(loadPublicSiding());
      const onChanged = () => setPublicSiding(loadPublicSiding());
      window.addEventListener(EVT_PUBLIC_SIDING_CHANGED, onChanged);
      return () => window.removeEventListener(EVT_PUBLIC_SIDING_CHANGED, onChanged);
    } catch {
      return;
    }
  }, []);

  // Hydration-safe: Trust Dial preference (localStorage) after mount.
  useEffect(() => {
    if (!FLAGS.publicTrustDial) return;
    try {
      setTrustMode(loadPublicTrustMode());
      const onChanged = () => setTrustMode(loadPublicTrustMode());
      window.addEventListener(EVT_PUBLIC_TRUST_DIAL_CHANGED, onChanged);
      return () => window.removeEventListener(EVT_PUBLIC_TRUST_DIAL_CHANGED, onChanged);
    } catch {
      return;
    }
  }, []);

  // Hydration-safe: Visual Calm preference (localStorage) after mount.
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

  const applyTrustMode = (m: PublicTrustMode) => {
    setTrustMode(m);
    savePublicTrustMode(m);
  };

  const countsShown = publicCalm?.showCounts ?? false;

  const toggleCounts = () => {
    const next = { showCounts: !countsShown };
    setPublicCalm(next);
    savePublicCalmUi(next);
  };

  const calmHideCounts = side === "public" && FLAGS.publicCalmUi && !countsShown;

  const posts = useMemo(() => {
    let out = rawPosts;

    // Friends: viewer-private Set filter
    if (side === "friends" && activeSet) {
      out = out.filter((p: any) => p.setId === activeSet);
    }

    // Public: Trust Dial (under-the-hood trust bands)
    if (side === "public" && FLAGS.publicTrustDial) {
      const min = minTrustForMode(trustMode);
      out = out.filter((p: any) => {
        const lvl = typeof p.trustLevel === "number" ? p.trustLevel : 1;
        return lvl >= min;
      });
    }

    // Public: Granular Siding (per-author channel prefs)
    // Safe default: no prefs => allow all.
    if (side === "public" && FLAGS.publicChannels && publicSiding) {
      out = out.filter((p: any) => {
        const key = (p.handle || "").toString();
        if (!key) return true;

        const rec = (publicSiding as any).byKey?.[key];
        if (!rec) return true;

        const ch = ((p.publicChannel || "general") as any).toString();
        const allowed = Array.isArray(rec.channels) ? rec.channels : [];
        return allowed.includes(ch);
      });
    }

    // Public: opt-in global channel filter row (prevents context collapse)
    if (side === "public" && FLAGS.publicChannels && publicChannel !== "all") {
      out = out.filter((p: any) => (p.publicChannel || "general") === publicChannel);
    }

    return out;
  }, [rawPosts, side, activeSet, publicChannel, publicSiding, trustMode]);

  const lastSeenId = useMemo(() => getLastSeenId(side), [side]);
  const dividerIndex = useMemo(() => {
    if (!lastSeenId) return posts.length ? 0 : -1;
    const idx = posts.findIndex((p) => p.id === lastSeenId);
    if (idx === -1) return posts.length ? 0 : -1;
    return idx;
  }, [posts, lastSeenId]);

  useEffect(() => {
    if (!rawPosts.length) return;
    const top = rawPosts[0];
    const t = window.setTimeout(() => setLastSeenId(side, top.id), 500);
    return () => window.clearTimeout(t);
  }, [side, rawPosts]);

  const addSetToState = (s: SetDef) => {
    setSets((prev) => [s, ...prev.filter((x) => x.id !== s.id)]);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Feed</h1>
        <p className="text-sm text-gray-500">
          {SIDES[side].label} • {SIDES[side].desc} • <span className="text-gray-400">Source: {provider.name}</span>
        </p>
      </div>

      {side === "public" && FLAGS.publicTrustDial ? (
        <div className="mb-3 flex gap-2 flex-wrap items-center">
          <span className="text-xs font-bold text-gray-500 mr-1">Dial</span>

          <button
            type="button"
            onClick={() => applyTrustMode("calm")}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border hover:opacity-90 ${
              trustMode === "calm" ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-200"
            }`}
            title="Calm: trusted-only (signal)"
          >
            Calm
          </button>

          <button
            type="button"
            onClick={() => applyTrustMode("standard")}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border hover:opacity-90 ${
              trustMode === "standard" ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-200"
            }`}
            title="Standard: hide obvious low-trust noise"
          >
            Standard
          </button>

          <button
            type="button"
            onClick={() => applyTrustMode("arena")}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border hover:opacity-90 ${
              trustMode === "arena" ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-200"
            }`}
            title="Arena: everything (noise)"
          >
            Arena
          </button>

          {FLAGS.publicCalmUi ? (
            <button
              type="button"
              onClick={toggleCounts}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border hover:opacity-90 ${
                countsShown ? "bg-white text-gray-700 border-gray-200" : "bg-gray-900 text-white border-gray-900"
              }`}
              title="Visual Calm: hide engagement numbers until hover/tap"
            >
              Counts: {countsShown ? "Shown" : "Hidden"}
            </button>
          ) : null}
        </div>
      ) : null}

      {side === "public" && FLAGS.publicCalmUi && !FLAGS.publicTrustDial ? (
        <div className="mb-3 flex gap-2 flex-wrap items-center">
          <span className="text-xs font-bold text-gray-500 mr-1">Calm UI</span>
          <button
            type="button"
            onClick={toggleCounts}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border hover:opacity-90 ${
              countsShown ? "bg-white text-gray-700 border-gray-200" : "bg-gray-900 text-white border-gray-900"
            }`}
            title="Visual Calm: hide engagement numbers until hover/tap"
          >
            Counts: {countsShown ? "Shown" : "Hidden"}
          </button>
        </div>
      ) : null}

      {side === "public" && FLAGS.publicChannels ? (
        <div className="mb-3 flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setPublicChannel("all")}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border hover:opacity-90 ${
              publicChannel === "all" ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-200"
            }`}
          >
            All
          </button>

          {PUBLIC_CHANNELS.map((c) => {
            const active = publicChannel === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setPublicChannel(c.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border hover:opacity-90 ${
                  active ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-200"
                }`}
                title={c.desc}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      ) : null}

      {side === "friends" ? (
        <div className="mb-3">
          <SetsChipsRow sets={sets} activeSet={activeSet} onSetChange={setActiveSet} onNewSet={() => setImportOpen(true)} />
        </div>
      ) : null}

      {posts.length ? (
        posts.map((p, i) => (
          <React.Fragment key={p.id}>
            {dividerIndex === i ? <Divider /> : null}
            <PostCard post={p as any} side={side} calmHideCounts={calmHideCounts} />
          </React.Fragment>
        ))
      ) : (
        <EmptyState side={side} activeSet={activeSet} />
      )}

      <div className="mt-8 p-8 rounded-2xl text-center border border-dashed border-gray-200 bg-gray-50">
        <p className="text-gray-500 mb-3 font-medium">You’re all caught up.</p>
        <button type="button" className="text-sm font-bold text-gray-900 hover:underline" onClick={() => alert("Composer comes later.")}>
          Create Post
        </button>
      </div>

      <ImportSetSheet
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onFinish={({ name, members }) => {
          void (async () => {
            const s = await setsProvider.create({ side: "friends", label: name, members });
            addSetToState(s);
            setActiveSet(s.id);
            alert(`Created Set "${s.label}" with ${s.members.length} members.`);
          })();
        }}
        onCreateSuggested={({ label, color, members }) => {
          void (async () => {
            const s = await setsProvider.create({ side: "friends", label, members, color });
            addSetToState(s);
          })();
        }}
      />
    </div>
  );
}
