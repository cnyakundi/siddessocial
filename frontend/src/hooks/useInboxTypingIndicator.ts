"use client";

import { useEffect, useRef, useState } from "react";

/**
 * useInboxTypingIndicator (sd_795)
 * - Polling-based typing indicator (no websockets yet).
 * - Sends "typing: true" pings while composing (throttled ~1s).
 * - Sends "typing: false" once when cleared.
 * - Polls other side every ~1.5s while visible.
 */
export function useInboxTypingIndicator(opts: { threadId: string; restricted: boolean; text: string }) {
  const threadId = String(opts?.threadId || "").trim();
  const restricted = Boolean(opts?.restricted);
  const text = String(opts?.text || "");

  const [otherTyping, setOtherTyping] = useState(false);
  const pingRef = useRef<number>(0);
  const emptySentRef = useRef<boolean>(true);

  // Send typing pings while composing.
  useEffect(() => {
    if (restricted) return;
    if (!threadId) return;
    if (typeof window === "undefined") return;

    const has = text.trim().length > 0;
    const now = Date.now();

    // When cleared, send one "typing: false" to end the indicator quickly.
    if (!has) {
      if (!emptySentRef.current) {
        emptySentRef.current = true;
        fetch("/api/inbox/typing", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ threadId, typing: false }),
        }).catch(() => {});
      }
      return;
    }

    emptySentRef.current = false;

    if (now - pingRef.current < 1100) return;
    pingRef.current = now;

    fetch("/api/inbox/typing", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ threadId, typing: true }),
    }).catch(() => {});
  }, [threadId, restricted, text]);

  // Poll whether the other participant is typing.
  useEffect(() => {
    if (restricted) {
      setOtherTyping(false);
      return;
    }
    if (!threadId) {
      setOtherTyping(false);
      return;
    }
    if (typeof window === "undefined") return;

    let stopped = false;

    const tick = async () => {
      if (stopped) return;
      try {
        if (typeof document !== "undefined" && document.visibilityState !== "visible") return;

        const res = await fetch(`/api/inbox/typing?threadId=${encodeURIComponent(threadId)}`, { cache: "no-store" });
        if (!res.ok) return;

        const j = (await res.json().catch(() => ({}))) as any;
        if (j?.restricted) {
          setOtherTyping(false);
          return;
        }
        setOtherTyping(Boolean(j?.typing));
      } catch {
        // ignore
      }
    };

    void tick();
    const t = window.setInterval(() => void tick(), 1500);

    const onWake = () => void tick();
    window.addEventListener("focus", onWake);
    document.addEventListener("visibilitychange", onWake);

    return () => {
      stopped = true;
      try {
        window.clearInterval(t);
      } catch {}
      window.removeEventListener("focus", onWake);
      document.removeEventListener("visibilitychange", onWake);
    };
  }, [threadId, restricted]);

  return otherTyping;
}
