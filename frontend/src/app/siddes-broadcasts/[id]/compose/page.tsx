"use client";
export const dynamic = "force-dynamic";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronDown, Globe, Loader2, X } from "lucide-react";

import { useSide } from "@/src/components/SideProvider";
import { enqueuePost, removeQueuedItem } from "@/src/lib/offlineQueue";
import { SIDE_THEMES, SIDES } from "@/src/lib/sides";
import { toast } from "@/src/lib/toast";

type Broadcast = { id: string; name: string; handle: string };

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

async function safeJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

type ComposeError = {
  kind: "validation" | "restricted" | "network" | "server" | "unknown";
  message: string;
};

type BroadcastDraft = { text: string; updatedAt: number };
const DRAFT_KEY = "sd.compose.broadcast.drafts.v1";

function loadDraft(id: string): BroadcastDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const store = JSON.parse(raw) as Record<string, BroadcastDraft>;
    const d = store && typeof store === "object" ? store[id] : null;
    if (!d || typeof d.text !== "string") return null;
    return d;
  } catch {
    return null;
  }
}

function saveDraft(id: string, draft: BroadcastDraft) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    const store = raw ? (JSON.parse(raw) as Record<string, BroadcastDraft>) : {};
    store[id] = draft;
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
  } catch {
    // ignore
  }
}

function clearDraft(id: string) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    const store = JSON.parse(raw) as Record<string, BroadcastDraft>;
    if (store && typeof store === "object" && store[id]) {
      delete store[id];
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    }
  } catch {
    // ignore
  }
}

function AvatarMe() {
  return (
    <div
      className="w-12 h-12 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center font-extrabold text-gray-700 shrink-0"
      aria-hidden="true"
      title="You"
    >
      Y
    </div>
  );
}

export default function BroadcastComposePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const id = params?.id;

  const { side, setSide } = useSide();

  const theme = SIDE_THEMES.public;
  const textRef = useRef<HTMLTextAreaElement | null>(null);

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const [requestedPublic, setRequestedPublic] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    if (side === "public") return;
    if (requestedPublic) return;
    setRequestedPublic(true);
    setSide("public", { afterCancel: () => router.replace("/siddes-feed") });
  }, [hydrated, side, requestedPublic, setSide, router]);

  const [broadcast, setBroadcast] = useState<Broadcast | null>(null);
  const [canWrite, setCanWrite] = useState<boolean | null>(null);

  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<ComposeError | null>(null);

  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

  // Focus
  useEffect(() => {
    const focus = () => {
      const el = textRef.current;
      if (!el) return;
      try {
        // @ts-ignore
        el.focus({ preventScroll: true });
      } catch {
        try {
          el.focus();
        } catch {
          // ignore
        }
      }
    };
    focus();
    const t = setTimeout(focus, 80);
    return () => clearTimeout(t);
  }, []);

  // Load broadcast + writer permission (public only)
  useEffect(() => {
    if (!hydrated || side !== "public") return;
    let mounted = true;

    fetch(`/api/broadcasts/${encodeURIComponent(id)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!mounted) return;
        setBroadcast(d?.item || null);
      })
      .catch(() => {
        if (!mounted) return;
        setBroadcast(null);
      });

    fetch(`/api/broadcasts/${encodeURIComponent(id)}/writers`, { cache: "no-store" })
      .then(async (r) => {
        await safeJson(r);
        if (!mounted) return;
        setCanWrite(!!r.ok);
      })
      .catch(() => {
        if (!mounted) return;
        setCanWrite(false);
      });

    return () => {
      mounted = false;
    };
  }, [id, hydrated, side]);

  // Restore draft once when hydrated
  const restoredRef = useRef(false);
  useEffect(() => {
    if (!hydrated) return;
    if (restoredRef.current) return;
    const d = loadDraft(id);
    if (d && d.text && !text.trim()) setText(d.text);
    restoredRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, id]);

  const maxChars = 800;
  const charCount = text.length;
  const overLimit = charCount > maxChars;
  const canPost = text.trim().length > 0 && !posting && !overLimit && canWrite !== null;

  const lockLabel = useMemo(() => {
    const name = broadcast?.name || "Broadcast";
    return `Public • ${name}`;
  }, [broadcast]);

  const saveCurrentDraft = () => {
    const t = (text || "").trim();
    if (!t) return;
    saveDraft(id, { text: t, updatedAt: Date.now() });
  };

  const close = () => {
    if ((text || "").trim()) saveCurrentDraft();
    try {
      if (typeof window !== "undefined" && window.history.length > 1) {
        router.back();
        return;
      }
    } catch {
      // ignore
    }
    router.push(`/siddes-broadcasts/${encodeURIComponent(id)}`);
  };

  async function postNow(raw: string) {
    const t = (raw || "").trim();
    if (!t) return;
    if (posting) return;

    if (t.length > maxChars) {
      setError({ kind: "validation", message: `Too long. Max ${maxChars} characters.` });
      saveCurrentDraft();
      return;
    }

    if (canWrite === false) {
      setError({ kind: "restricted", message: "Writers only — you can’t post updates here." });
      saveCurrentDraft();
      return;
    }

    setPosting(true);
    setError(null);

    const reset = () => {
      setText("");
      setError(null);
      clearDraft(id);
    };

    const onlineNow = typeof navigator !== "undefined" ? navigator.onLine : true;

    // Offline: queue and close.
    if (!onlineNow) {
      const queued = enqueuePost("public", t, { setId: id, urgent: false, publicChannel: null });
      reset();
      setPosting(false);
      toast.undo(`Queued: ${broadcast?.name || "Broadcast update"}`, () => removeQueuedItem(queued.id));
      close();
      return;
    }

    try {
      const res = await fetch("/api/post", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ side: "public", setId: id, text: t, client_key: `bc_${Date.now()}` }),
      });

      if (res.ok) {
        reset();
        setPosting(false);
        toast.success(`Posted to ${broadcast?.name || "Broadcast"}`);
        router.push(`/siddes-broadcasts/${encodeURIComponent(id)}`);
        return;
      }

      const j = await safeJson(res);
      const code = j && typeof j.error === "string" ? j.error : "request_failed";

      // Never destroy text on failure.
      saveCurrentDraft();

      if (res.status === 400) {
        if (code === "too_long" && typeof j.max === "number") {
          setError({ kind: "validation", message: `Too long. Max ${j.max} characters.` });
        } else if (code === "empty_text") {
          setError({ kind: "validation", message: "Write something first." });
        } else {
          setError({ kind: "validation", message: "Couldn’t post — check your text." });
        }
        setPosting(false);
        return;
      }

      if (res.status === 401) {
        setError({ kind: "restricted", message: "Login required to post." });
        setPosting(false);
        try {
          const next = encodeURIComponent(`/siddes-broadcasts/${encodeURIComponent(id)}/compose`);
          router.push(`/login?next=${next}`);
        } catch {
          // ignore
        }
        return;
      }

      if (res.status === 403) {
        if (code === "broadcast_write_forbidden") {
          setError({ kind: "restricted", message: "Writers only — you can’t post updates here." });
        } else if (code === "public_trust_low" && typeof j.min_trust === "number") {
          setError({ kind: "restricted", message: `Public posting requires Trust L${j.min_trust}+.` });
        } else if (code === "rate_limited" && typeof j.retry_after_ms === "number") {
          const sec = Math.max(1, Math.round(Number(j.retry_after_ms) / 1000));
          setError({ kind: "restricted", message: `Slow down — try again in ${sec}s.` });
        } else {
          setError({ kind: "restricted", message: "Restricted: you can’t post here." });
        }
        setPosting(false);
        return;
      }

      if (res.status === 503) {
        if (code === "broadcast_unavailable") setError({ kind: "server", message: "Broadcasts are unavailable right now. Try again." });
        else setError({ kind: "server", message: "Service unavailable — try again." });
        setPosting(false);
        return;
      }

      if (res.status >= 500) {
        setError({ kind: "server", message: "Server error — draft saved. Try again." });
        setPosting(false);
        return;
      }

      setError({ kind: "unknown", message: "Couldn’t post — draft saved. Try again." });
      setPosting(false);
    } catch {
      saveCurrentDraft();
      setError({ kind: "network", message: "Network error — draft saved. Try again." });
      setPosting(false);
    }
  }

  async function submit() {
    const t = text.trim();
    if (!t) return;
    if (overLimit) {
      setError({ kind: "validation", message: `Too long. Max ${maxChars} characters.` });
      saveCurrentDraft();
      return;
    }
    await postNow(t);
  }

  if (hydrated && side !== "public") {
    return <div className="min-h-screen bg-gray-50" />;
  }

  if (canWrite === false) {
    return (
      <div className="max-w-xl mx-auto px-4 py-10">
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <div className="text-xl font-black text-gray-900">Writers only</div>
          <div className="text-sm text-gray-500 mt-2">You don't have permission to post updates to this broadcast.</div>
          <button
            type="button"
            onClick={() => router.push(`/siddes-broadcasts/${encodeURIComponent(id)}`)}
            className="inline-block mt-5 text-sm font-bold text-blue-600 hover:underline"
          >
            Back to broadcast
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[99] flex items-end justify-center md:items-center">
      <button type="button" aria-label="Close compose" className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={close} />

      <div
        className={cn(
          "relative w-full md:max-w-2xl bg-white overflow-hidden flex flex-col shadow-2xl",
          "rounded-t-3xl md:rounded-3xl",
          "ring-1 ring-white/20",
          error ? "ring-2 ring-red-500" : null,
          "animate-in slide-in-from-bottom-full md:zoom-in-95 duration-200"
        )}
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
      >
        {/* Safety header */}
        <div className={cn("px-6 py-4 border-b flex items-center justify-between", theme.lightBg, theme.border)}>
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-extrabold bg-white/70",
                theme.border,
                theme.text
              )}
              title={SIDES.public.privacyHint}
            >
              <span className={cn("w-2 h-2 rounded-full", theme.primaryBg)} aria-hidden="true" />
              Public Side
            </span>

            <span className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-blue-100 bg-white/70 text-xs font-extrabold text-gray-800 min-w-0">
              <Globe size={12} className="text-blue-600" />
              <span className="truncate max-w-[210px]">{broadcast?.name || "Broadcast"}</span>
              <ChevronDown size={12} className="text-gray-300" />
            </span>
          </div>

          <button type="button" onClick={close} className="p-2 rounded-full hover:bg-white/60" aria-label="Close" title="Close">
            <X size={18} className="text-gray-600" />
          </button>
        </div>

        {/* Public warning */}
        <div className={cn("px-6 py-2 border-b flex items-center justify-between", theme.lightBg, theme.border)}>
          <div className={cn("flex items-center gap-2 text-[11px] font-medium", theme.text)}>
            <Globe size={12} />
            <span>{SIDES.public.privacyHint}. This update is visible to everyone.</span>
          </div>
        </div>

        {/* Editor */}
        <div className="p-8 min-h-[320px] flex flex-col">
          <div className="text-sm font-bold text-gray-900 mb-4">New broadcast update</div>

          <div className="flex gap-5">
            <AvatarMe />
            <div className="flex-1 min-w-0">
              <textarea
                ref={textRef}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  if (error?.kind === "validation") setError(null);
                }}
                placeholder="Write an update…"
                className="w-full h-40 resize-none outline-none text-xl text-gray-900 placeholder:text-gray-300 bg-transparent leading-relaxed"
                autoFocus
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
          <div className="flex items-center gap-4 min-w-0">
            <span className={cn("text-[10px] font-mono", overLimit ? "text-red-600 font-bold" : "text-gray-400")}>
              {charCount} / {maxChars}
            </span>

            <span className="hidden sm:inline text-[10px] font-bold text-gray-400">{isOnline ? "Online" : "Offline (queue)"}</span>

            {error ? (
              <span className="flex items-center gap-1.5 text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded max-w-[360px] truncate">
                <AlertTriangle size={12} />
                <span className="truncate">{error.message}</span>
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex text-[10px] font-bold text-gray-400 items-center gap-1.5">
              <span className={cn("w-1.5 h-1.5 rounded-full", theme.primaryBg)} aria-hidden="true" />
              <span className="truncate max-w-[240px]">Posting to {lockLabel}</span>
            </div>

            <button
              type="button"
              onClick={submit}
              disabled={!canPost}
              className={cn(
                "px-8 py-3 rounded-full text-white text-sm font-extrabold shadow-lg shadow-gray-200 transition-all inline-flex items-center gap-2",
                canPost ? cn(theme.primaryBg, "hover:opacity-90 active:scale-95") : "bg-gray-300 cursor-not-allowed"
              )}
              aria-label="Post update"
              title={!canPost ? (overLimit ? `Too long (max ${maxChars})` : posting ? "Posting…" : "Write something first") : "Post update"}
            >
              {posting ? <Loader2 size={16} className="animate-spin" /> : null}
              {posting ? "Posting…" : "Post update"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
