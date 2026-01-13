"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSide } from "@/src/components/SideProvider";
import { enqueuePost } from "@/src/lib/offlineQueue";
import { SIDES } from "@/src/lib/sides";
import { FLAGS } from "@/src/lib/flags";
import { PUBLIC_CHANNELS, type PublicChannelId } from "@/src/lib/publicChannels";
import { ComposeSuggestionBar } from "@/src/components/ComposeSuggestionBar";
import { DEFAULT_SETS, type SetDef } from "@/src/lib/sets";
import { getSetsProvider } from "@/src/lib/setsProvider";

export default function SiddesComposePage() {
  const { side, setSide } = useSide();
  const [text, setText] = useState("");

  const setsProvider = useMemo(() => getSetsProvider(), []);
  const [sets, setSets] = useState<SetDef[]>(() => DEFAULT_SETS);
  
  // Hydration-safe: only read localStorage / fetch after mount.
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
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [urgent, setUrgent] = useState(false);
  const [publicChannel, setPublicChannel] = useState<PublicChannelId>("general");

  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

  const selectedSet = useMemo(() => sets.find((s) => s.id === selectedSetId) ?? null, [sets, selectedSetId]);

  async function submit() {
    const t = text.trim();
    if (!t) return;

    if (!isOnline) {
      enqueuePost(side, t, { setId: selectedSetId, urgent, publicChannel: side === "public" && FLAGS.publicChannels ? publicChannel : null });
      setText("");
      setUrgent(false);
      setSelectedSetId(null);
      alert(`Queued (offline): ${SIDES[side].label}`);
      return;
    }

    setText("");
    alert(
      `Posted (stub): ${SIDES[side].label}` +
        (selectedSet ? ` • Set: ${selectedSet.label}` : "") +
        (side === "public" && FLAGS.publicChannels ? ` • Channel: ${PUBLIC_CHANNELS.find((c) => c.id === publicChannel)?.label ?? "General"}` : "") +
        (urgent ? " • Urgent" : "")
    );
    setUrgent(false);
    setSelectedSetId(null);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <Link href="/siddes-feed" className="text-sm font-bold text-gray-700 hover:underline">
            ← Feed
          </Link>
          <Link href="/siddes-notifications" className="text-sm font-bold text-gray-700 hover:underline">
            Notifications
          </Link>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <div className="text-sm font-bold text-gray-900 mb-2">
            Compose • {SIDES[side].label}
          </div>

          <ComposeSuggestionBar
            text={text}
            currentSide={side}
            sets={sets}
            selectedSetId={selectedSetId}
            urgent={urgent}
            onApplySide={(s) => setSide(s)}
            onToggleSet={(id) => setSelectedSetId((cur) => (cur === id ? null : id))}
            onToggleUrgent={() => setUrgent((u) => !u)}
          />

          {selectedSetId || urgent ? (
            <div className="flex gap-2 flex-wrap mb-3">
              {selectedSet ? (
                <button
                  type="button"
                  className="px-3 py-1 rounded-full text-xs font-bold bg-orange-50 text-orange-700 border border-orange-100 hover:opacity-90"
                  onClick={() => setSelectedSetId(null)}
                  title="Click to clear set"
                >
                  Set: {selectedSet.label} ✕
                </button>
              ) : null}
              {urgent ? (
                <button
                  type="button"
                  className="px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-100 hover:opacity-90"
                  onClick={() => setUrgent(false)}
                  title="Click to remove urgent"
                >
                  Urgent ✕
                </button>
              ) : null}
            </div>
          ) : null}

          {FLAGS.publicChannels && side === "public" ? (
            <div className="mb-3">
              <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Channel</div>
              <div className="flex gap-2 flex-wrap">
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
            </div>
          ) : null}

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What’s happening?"
            className="w-full h-32 resize-none outline-none text-base text-gray-900 placeholder:text-gray-400"
          />

          <div className="mt-3 flex items-center justify-between">
            <div className="text-xs text-gray-500">{isOnline ? "Online" : "Offline (will queue)"}</div>

            <button
              type="button"
              onClick={submit}
              className="px-5 py-2 rounded-full bg-gray-900 text-white font-bold hover:opacity-90"
            >
              Post
            </button>
          </div>
        </div>

        <p className="text-xs text-gray-400 mt-4">
          Compose Intelligence v1: confidence-gated, explainable, reversible.
        </p>
      </div>
    </div>
  );
}
