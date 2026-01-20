"use client";

import React, { useEffect, useState } from "react";
import { flushQueue, loadQueue, countQueued, queueChangedEventName } from "@/src/lib/offlineQueue";

export function QueueIndicator() {
  const [count, setCount] = useState(0);
  const [flushing, setFlushing] = useState(false);

  useEffect(() => {
    const refresh = () => setCount(countQueued());
    refresh();

    const onChanged = () => refresh();
    const evt = queueChangedEventName();
    window.addEventListener(evt, onChanged);

    const onOnline = async () => {
      refresh();
      if (countQueued() === 0) return;
      setFlushing(true);
      try {
        await flushQueue();
      } finally {
        setFlushing(false);
        refresh();
      }
    };

    window.addEventListener("online", onOnline);

    return () => {
      window.removeEventListener(evt, onChanged);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  if (count === 0 && !flushing) return null;

  const posts = loadQueue().filter((x) => x.kind === "post").length;
  const replies = loadQueue().filter((x) => x.kind === "reply").length;

  return (
    <div className="fixed top-20 right-3 z-[120]">
      <div className="bg-white border border-gray-200 shadow-lg rounded-2xl px-4 py-3 max-w-xs">
        <div className="text-sm font-bold text-gray-900">{flushing ? "Sending…" : "Queued"}</div>
        <div className="text-xs text-gray-500 mt-1">
          {flushing
            ? "Back online — sending queued items now."
            : `${count} item${count === 1 ? "" : "s"} queued • ${posts} posts • ${replies} replies`}
        </div>
        {!flushing ? (
          <button
            type="button"
            className="mt-3 px-3 py-2 rounded-full bg-gray-900 text-white text-xs font-bold hover:opacity-90"
            onClick={async () => {
              setFlushing(true);
              try {
                await flushQueue();
              } finally {
                setFlushing(false);
                setCount(countQueued());
              }
            }}
          >
            Send now
          </button>
        ) : null}
      </div>
    </div>
  );
}
