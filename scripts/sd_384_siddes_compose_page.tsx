"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ChevronDown, Globe, Loader2, Trash2, X } from "lucide-react";
import { useSide } from "@/src/components/SideProvider";
import { enqueuePost, removeQueuedItem } from "@/src/lib/offlineQueue";
import { SIDES, SIDE_ORDER, SIDE_THEMES, isSideId, type SideId } from "@/src/lib/sides";
import { FLAGS } from "@/src/lib/flags";
import type { PublicChannelId } from "@/src/lib/publicChannels";
import { PUBLIC_CHANNELS, labelForPublicChannel } from "@/src/lib/publicChannels";
import { ComposeSuggestionBar } from "@/src/components/ComposeSuggestionBar";
import type { SetDef, SetId } from "@/src/lib/sets";
import { DEFAULT_SETS } from "@/src/lib/sets";
import { getSetsProvider } from "@/src/lib/setsProvider";
import { SetPickerSheet } from "@/src/components/SetPickerSheet";
import { toast } from "@/src/lib/toast";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

function AvatarMe({ sideLabel }: { sideLabel: string }) {
  const seed = sideLabel.slice(0, 1).toUpperCase();
  return (
    <div
      className="w-12 h-12 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center font-extrabold text-gray-700 shrink-0"
      aria-hidden="true"
      title="You"
    >
      {seed}
    </div>
  );
}

function TopicPickerSheet({
  open,
  onClose,
  value,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  value: PublicChannelId;
  onPick: (next: PublicChannelId) => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[125] flex items-end justify-center md:items-center">
      <button
        type="button"
        aria-label="Close topic picker"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl shadow-2xl p-6 animate-in slide-in-from-bottom-full duration-200">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Choose Topic</h3>
            <div className="text-xs text-gray-500 mt-1">Public posts land in a topic stream.</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-2">
          {PUBLIC_CHANNELS.map((c) => {
            const active = value === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onPick(c.id);
                  onClose();
                }}
                className={cn(
                  "w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between gap-3",
                  active ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white hover:bg-gray-50"
                )}
                title={c.desc}
              >
                <div className="min-w-0">
                  <div className={cn("font-bold truncate", active ? "text-white" : "text-gray-900")}>{c.label}</div>
                  <div className={cn("text-[11px] truncate", active ? "text-white/80" : "text-gray-500")}>{c.desc}</div>
                </div>
                {active ? <span className="w-2.5 h-2.5 rounded-full bg-white" /> : <span className="w-2.5 h-2.5 rounded-full bg-gray-300" />}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full mt-3 py-3 font-semibold text-gray-500 hover:bg-gray-50 rounded-xl"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

type ComposeDraft = {
  text: string;
  setId: SetId | null;
  urgent: boolean;
  publicChannel: PublicChannelId;
  updatedAt: number;
};

type DraftStore = Partial<Record<SideId, ComposeDraft>>;
const DRAFTS_KEY = "sd.compose.drafts.v1";

function loadDraftStore(): DraftStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(DRAFTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as DraftStore;
  } catch {
    return {};
  }
}

function saveDraftStore(store: DraftStore) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DRAFTS_KEY, JSON.stringify(store));
  } catch {
    // ignore
  }
}

function saveDraft(side: SideId, draft: ComposeDraft) {
  const store = loadDraftStore();
  store[side] = draft;
  saveDraftStore(store);
}

function clearDraft(side: SideId) {
  const store = loadDraftStore();
  if (store[side]) {
    delete store[side];
    saveDraftStore(store);
  }
}

function DraftsSheet({
  open,
  onClose,
  onRestore,
}: {
  open: boolean;
  onClose: () => void;
  onRestore: (side: SideId, draft: ComposeDraft) => void;
}) {
  const [store, setStore] = useState<DraftStore>({});

  useEffect(() => {
    if (!open) return;
    setStore(loadDraftStore());
  }, [open]);

  if (!open) return null;

  const entries = SIDE_ORDER.map((s) => ({ side: s, draft: store[s] || null }))
    .filter((x) => Boolean(x.draft)) as Array<{ side: SideId; draft: ComposeDraft }>;

  return (
    <div className="fixed inset-0 z-[140] flex items-end justify-center md:items-center">
      <button type="button" className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-label="Close drafts" />
      <div className="relative w-full max-w-lg bg-white rounded-t-3xl md:rounded-3xl shadow-2xl p-6 animate-in slide-in-from-bottom-full duration-200">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Drafts</h3>
            <div className="text-xs text-gray-500 mt-1">Drafts are stored locally on this device.</div>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-gray-100" aria-label="Close">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {entries.length === 0 ? (
          <div className="text-sm text-gray-500">No drafts yet.</div>
        ) : (
          <div className="space-y-3">
            {entries.map(({ side, draft }) => {
              const t = SIDE_THEMES[side];
              const snippet = (draft.text || "").trim().slice(0, 120);
              const stamp = new Date(draft.updatedAt || Date.now()).toLocaleString();
              return (
                <div key={side} className="rounded-2xl border border-gray-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className={cn("inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-extrabold", t.lightBg, t.border, t.text)}>
                      <span className={cn("w-2 h-2 rounded-full", t.primaryBg)} aria-hidden="true" />
                      {SIDES[side].label}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        clearDraft(side);
                        setStore(loadDraftStore());
                      }}
                      className="p-2 rounded-full hover:bg-gray-50 text-gray-500"
                      aria-label={`Delete ${SIDES[side].label} draft`}
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="mt-3 text-sm text-gray-800 whitespace-pre-wrap">{snippet}{draft.text.length > snippet.length ? "…" : ""}</div>
                  <div className="mt-2 text-[11px] text-gray-400">Updated: {stamp}</div>

                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onRestore(side, draft);
                        onClose();
                      }}
                      className={cn("flex-1 px-4 py-2 rounded-full text-sm font-extrabold text-white hover:opacity-90", t.primaryBg)}
                    >
                      Restore
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 rounded-full border border-gray-200 text-gray-800 font-bold hover:bg-gray-50"
                    >
                      Close
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <button type="button" onClick={onClose} className="w-full mt-4 py-3 font-semibold text-gray-500 hover:bg-gray-50 rounded-xl">
          Done
        </button>
      </div>
    </div>
  );
}

type ComposeError = {
  kind: "validation" | "restricted" | "network" | "server" | "unknown";
  message: string;
};

export default function SiddesComposePage() {
  // sd_211_compose_no_reload
  const { side, setSide } = useSide();
  const router = useRouter();
  const searchParams = useSearchParams();

  const theme = SIDE_THEMES[side];
  const title = side === "work" ? "New Update" : "New Post";

  const [text, setText] = useState("");
  const textRef = useRef<HTMLTextAreaElement | null>(null);

  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<ComposeError | null>(null);
  const [draftsOpen, setDraftsOpen] = useState(false);

  const requestedSide: SideId | null = useMemo(() => {
    const raw = String(searchParams?.get("side") || "").trim().toLowerCase();
    return isSideId(raw) ? (raw as SideId) : null;
  }, [searchParams]);

  // Best-effort focus: some mobile browsers ignore autoFocus; try again after mount.
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

  // Restore prompt/draft once.
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;

    const prompt = String(searchParams?.get("prompt") || "").trim();
    if (prompt) {
      setText(prompt);
      restoredRef.current = true;
      return;
    }

    try {
      const store = loadDraftStore();
      const d = store[side];
      if (d && d.text && !text.trim()) {
        setText(d.text);
        setPosting(false);
        // Restore meta best-effort.
        setSelectedSetId(d.setId ?? null);
        setUrgent(Boolean(d.urgent));
        setPublicChannel((d.publicChannel as any) || "general");
      }
    } catch {
      // ignore
    }

    restoredRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, side]);

  // Public warning: dismissible per-session
  const PUBLIC_WARN_KEY = "sd.compose.publicWarn.dismissed";
  const [showPublicWarn, setShowPublicWarn] = useState(false);

  useEffect(() => {
    if (side !== "public") {
      setShowPublicWarn(false);
      return;
    }
    try {
      const dismissed = typeof window !== "undefined" && window.sessionStorage.getItem(PUBLIC_WARN_KEY) === "1";
      setShowPublicWarn(!dismissed);
    } catch {
      setShowPublicWarn(true);
    }
  }, [side]);

  const dismissPublicWarn = () => {
    try {
      window.sessionStorage.setItem(PUBLIC_WARN_KEY, "1");
    } catch {
      // ignore
    }
    setShowPublicWarn(false);
  };

  const saveCurrentDraft = () => {
    const t = (text || "").trim();
    if (!t) return;
    try {
      saveDraft(side, {
        text: t,
        setId: selectedSetId,
        urgent: Boolean(urgent),
        publicChannel,
        updatedAt: Date.now(),
      });
    } catch {
      // ignore
    }
  };

  const close = () => {
    // Never drop text silently.
    if ((text || "").trim()) saveCurrentDraft();

    // Prefer history back (feels like dismissing a sheet). Fall back to feed.
    try {
      if (typeof window !== "undefined" && window.history.length > 1) {
        router.back();
        return;
      }
    } catch {
      // ignore
    }
    router.push("/siddes-feed");
  };

  // Audience lock + public confirm (context safety)
  const SKIP_PUBLIC_CONFIRM_KEY = "sd.publicConfirm.skip";
  const [publicConfirmOpen, setPublicConfirmOpen] = useState(false);
  const [publicConfirmDontAsk, setPublicConfirmDontAsk] = useState(false);
  const [pendingPublicText, setPendingPublicText] = useState<string | null>(null);

  const setsProvider = useMemo(() => getSetsProvider(), []);
  const [sets, setSets] = useState<SetDef[]>(() => DEFAULT_SETS);
  const [selectedSetId, setSelectedSetId] = useState<SetId | null>(null);
  const [urgent, setUrgent] = useState(false);
  const [publicChannel, setPublicChannel] = useState<PublicChannelId>("general");

  const [setPickerOpen, setSetPickerOpen] = useState(false);
  const [topicPickerOpen, setTopicPickerOpen] = useState(false);

  // Hydration-safe: load sets after mount and when side changes
  useEffect(() => {
    let mounted = true;

    setSelectedSetId(null);
    setUrgent(false);
    // Prevent "wrong side" sets flashing during side switches.
    setSets(side === "friends" ? DEFAULT_SETS : []);
    setsProvider
      .list({ side })
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
  }, [setsProvider, side]);

  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

  const selectedSet = useMemo(() => sets.find((s) => s.id === selectedSetId) ?? null, [sets, selectedSetId]);

  const audienceLabel =
    side === "public"
      ? FLAGS.publicChannels
        ? labelForPublicChannel(publicChannel)
        : "All Topics"
      : selectedSet
        ? selectedSet.label
        : `All ${SIDES[side].label}`;

  const lockLabel =
    side === "public"
      ? `Public • ${FLAGS.publicChannels ? labelForPublicChannel(publicChannel) : "All Topics"}`
      : `${SIDES[side].label} • ${selectedSet ? selectedSet.label : `All ${SIDES[side].label}`}`;

  function shouldConfirmPublic(): boolean {
    if (side !== "public") return false;
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(SKIP_PUBLIC_CONFIRM_KEY) !== "1";
    } catch {
      return true;
    }
  }

  const maxChars = side === "public" ? 800 : 5000;
  const charCount = text.length;
  const overLimit = charCount > maxChars;

  const canPost = text.trim().length > 0 && !posting && !overLimit;

  async function postNow(raw: string) {
    const t = (raw || "").trim();
    if (!t) return;
    if (posting) return;

    if (t.length > maxChars) {
      setError({ kind: "validation", message: `Too long. Max ${maxChars} characters.` });
      saveCurrentDraft();
      return;
    }

    setPosting(true);
    setError(null);

    const meta = {
      setId: selectedSetId,
      urgent,
      publicChannel: side === "public" && FLAGS.publicChannels ? publicChannel : null,
    };

    const reset = () => {
      setText("");
      setUrgent(false);
      setSelectedSetId(null);
      setError(null);
      clearDraft(side);
    };

    const onlineNow = typeof navigator !== "undefined" ? navigator.onLine : true;

    // Offline: queue and show undo.
    if (!onlineNow) {
      const queued = enqueuePost(side, t, meta);
      reset();
      setPosting(false);
      toast.undo(`Queued: ${SIDES[side].label}`, () => removeQueuedItem(queued.id));
      close();
      return;
    }

    const clientKey = `ui_${Date.now()}`;
    try {
      const res = await fetch("/api/post", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          side,
          text: t,
          setId: selectedSetId,
          urgent,
          publicChannel: side === "public" && FLAGS.publicChannels ? publicChannel : null,
          client_key: clientKey,
        }),
      });

      if (res.ok) {
        const msg =
          `Posted: ${SIDES[side].label}` +
          (selectedSet ? ` • Set: ${selectedSet.label}` : "") +
          (side === "public" && FLAGS.publicChannels ? ` • Topic: ${labelForPublicChannel(publicChannel)}` : "") +
          (urgent ? " • Urgent" : "");
        reset();
        setPosting(false);
        toast.success(msg);
        close();
        return;
      }

      const j = await res.json().catch(() => null);
      const code = j && typeof j.error === "string" ? j.error : "request_failed";

      // Never destroy text on failure. Save draft and show an inline error.
      saveCurrentDraft();

      if (res.status === 400) {
        if (code === "too_long" && j && typeof j.max === "number") {
          setError({ kind: "validation", message: `Too long. Max ${j.max} characters.` });
        } else if (code === "empty_text") {
          setError({ kind: "validation", message: "Write something first." });
        } else {
          setError({ kind: "validation", message: "Couldn’t post — please check your text and try again." });
        }
        setPosting(false);
        return;
      }

      if (res.status === 401) {
        setError({ kind: "restricted", message: "Login required to post." });
        setPosting(false);
        try {
          const next = encodeURIComponent("/siddes-compose");
          router.push(`/login?next=${next}`);
        } catch {
          // ignore
        }
        return;
      }

      if (res.status === 403) {
        // Trust gates + restricted writes land here.
        const hint = j && typeof j.error === "string" ? String(j.error) : "restricted";
        if (hint === "public_trust_low" && j && typeof j.min_trust === "number") {
          setError({ kind: "restricted", message: `Public posting requires Trust L${j.min_trust}+.` });
        } else if (hint === "rate_limited" && j && typeof j.retry_after_ms === "number") {
          const sec = Math.max(1, Math.round(Number(j.retry_after_ms) / 1000));
          setError({ kind: "restricted", message: `Slow down — try again in ${sec}s.` });
        } else {
          setError({ kind: "restricted", message: "Restricted: you can’t post here." });
        }
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
      return;
    } catch {
      saveCurrentDraft();
      setError({ kind: "network", message: "Network error — draft saved. Try again." });
      setPosting(false);
      return;
    }
  }

  async function confirmPublicPost() {
    const t = (pendingPublicText || text).trim();
    setPublicConfirmOpen(false);
    setPendingPublicText(null);

    if (publicConfirmDontAsk) {
      try {
        window.localStorage.setItem(SKIP_PUBLIC_CONFIRM_KEY, "1");
      } catch {
        // ignore
      }
    }

    await postNow(t);
  }

  async function submit() {
    const t = text.trim();
    if (!t) return;

    if (overLimit) {
      setError({ kind: "validation", message: `Too long. Max ${maxChars} characters.` });
      saveCurrentDraft();
      return;
    }

    if (side === "public" && shouldConfirmPublic()) {
      setPendingPublicText(t);
      setPublicConfirmOpen(true);
      return;
    }

    await postNow(t);
  }

  const openAudience = () => {
    if (side === "public") {
      if (!FLAGS.publicChannels) return;
      setTopicPickerOpen(true);
      return;
    }
    setSetPickerOpen(true);
  };

  const reqBanner = requestedSide && requestedSide !== side ? (
    <div className={cn("px-6 py-2 border-b flex items-center justify-between", SIDE_THEMES[requestedSide].lightBg, SIDE_THEMES[requestedSide].border)}>
      <div className={cn("text-[11px] font-bold", SIDE_THEMES[requestedSide].text)}>
        This compose link targets <span className="font-extrabold">{SIDES[requestedSide].label}</span>. Enter it to post safely.
      </div>
      <button
        type="button"
        onClick={() => setSide(requestedSide)}
        className={cn(
          "px-3 py-1.5 rounded-full text-xs font-extrabold text-white hover:opacity-90",
          SIDE_THEMES[requestedSide].primaryBg
        )}
      >
        Enter {SIDES[requestedSide].label}
      </button>
    </div>
  ) : null;

  return (
    <>
      {/* Compose overlay (mobile bottom-sheet, desktop modal) */}
      <div className="fixed inset-0 z-[99] flex items-end justify-center md:items-center">
        <button
          type="button"
          aria-label="Close compose"
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={close}
        />

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
          {/* 1) Safety header */}
          <div className={cn("px-6 py-4 border-b flex items-center justify-between", theme.lightBg, theme.border)}>
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() => toast.info("Side is locked here. Use Suggestions to switch safely.")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-extrabold transition-colors",
                  "bg-white/70",
                  theme.border,
                  theme.text
                )}
                aria-label={`Posting in ${SIDES[side].label}`}
                title={SIDES[side].privacyHint}
              >
                <span className={cn("w-2 h-2 rounded-full", theme.primaryBg)} aria-hidden="true" />
                {SIDES[side].label} Side
              </button>

              <button
                type="button"
                onClick={openAudience}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-gray-200 bg-white/70 text-xs font-extrabold text-gray-700 hover:bg-white min-w-0"
                aria-label={`Audience: ${audienceLabel}`}
                title={side === "public" ? "Choose a topic" : "Choose a set"}
              >
                <span className="truncate max-w-[180px]">{audienceLabel}</span>
                <ChevronDown size={12} className="text-gray-400" />
              </button>

              {urgent ? (
                <button
                  type="button"
                  onClick={() => setUrgent(false)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full border text-xs font-extrabold bg-red-50 text-red-700 border-red-100 hover:opacity-90"
                  aria-label="Urgent on"
                  title="Click to remove Urgent"
                >
                  Urgent ✕
                </button>
              ) : null}
            </div>

            <button
              type="button"
              onClick={close}
              className="p-2 rounded-full hover:bg-white/60"
              aria-label="Close"
              title="Close"
            >
              <X size={18} className="text-gray-600" />
            </button>
          </div>

          {reqBanner}

          {/* Public warning (dismissible per session) */}
          {side === "public" && showPublicWarn ? (
            <div className={cn("px-6 py-2 border-b flex items-center justify-between", theme.lightBg, theme.border)}>
              <div className={cn("flex items-center gap-2 text-[11px] font-medium", theme.text)}>
                <Globe size={12} />
                <span>{SIDES.public.privacyHint}. Post carefully.</span>
              </div>
              <button type="button" onClick={dismissPublicWarn} className={cn("text-[10px] font-extrabold hover:underline", theme.text)}>
                Got it
              </button>
            </div>
          ) : null}

          {/* 2) Main editor */}
          <div className="p-8 min-h-[320px] flex flex-col">
            <div className="text-sm font-bold text-gray-900 mb-4">{title}</div>

            <div className="flex gap-5">
              <AvatarMe sideLabel={SIDES[side].label} />

              <div className="flex-1 min-w-0">
                <textarea
                  ref={textRef}
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    if (error?.kind === "validation") setError(null);
                  }}
                  placeholder={side === "work" ? "Log update, blocker, or task…" : "What’s happening?"}
                  className="w-full h-40 resize-none outline-none text-xl text-gray-900 placeholder:text-gray-300 bg-transparent leading-relaxed"
                  autoFocus
                />

                {/* Suggestions (confidence gated, reversible) */}
                <div className="mt-4">
                  <ComposeSuggestionBar
                    text={text}
                    currentSide={side}
                    sets={sets}
                    selectedSetId={selectedSetId}
                    urgent={urgent}
                    onApplySide={(s) => setSide(s)}
                    onToggleSet={(id) => setSelectedSetId((cur) => (cur === id ? null : (id as any)))}
                    onToggleUrgent={() => setUrgent((u) => !u)}
                  />
                </div>

                {/* Selected context chips (clear fast) */}
                {selectedSetId && selectedSet ? (
                  <div className="flex gap-2 flex-wrap mt-2">
                    <button
                      type="button"
                      className="px-3 py-1 rounded-full text-xs font-extrabold bg-orange-50 text-orange-700 border border-orange-100 hover:opacity-90"
                      onClick={() => setSelectedSetId(null)}
                      title="Click to clear set"
                    >
                      Set: {selectedSet.label} ✕
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {/* 3) Footer */}
          <div className="px-8 py-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
            <div className="flex items-center gap-4 min-w-0">
              <span className={cn("text-[10px] font-mono", overLimit ? "text-red-600 font-bold" : "text-gray-400")}>{charCount} / {maxChars}</span>

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
                onClick={() => setDraftsOpen(true)}
                className="text-xs font-bold text-gray-500 hover:text-gray-900 transition-colors"
              >
                Drafts
              </button>

              <button
                type="button"
                onClick={submit}
                disabled={!canPost}
                className={cn(
                  "px-8 py-3 rounded-full text-white text-sm font-extrabold shadow-lg shadow-gray-200 transition-all inline-flex items-center gap-2",
                  canPost ? cn(theme.primaryBg, "hover:opacity-90 active:scale-95") : "bg-gray-300 cursor-not-allowed"
                )}
                aria-label="Post"
                title={!canPost ? (overLimit ? `Too long (max ${maxChars})` : posting ? "Posting…" : "Write something first") : "Post"}
              >
                {posting ? <Loader2 size={16} className="animate-spin" /> : null}
                {posting ? "Posting…" : "Post"}
              </button>
            </div>
          </div>

          {process.env.NODE_ENV !== "production" ? (
            <p className="px-8 pb-6 text-xs text-gray-400">Compose Intelligence v1: confidence-gated, explainable, reversible.</p>
          ) : null}
        </div>
      </div>

      {/* Drafts */}
      <DraftsSheet
        open={draftsOpen}
        onClose={() => setDraftsOpen(false)}
        onRestore={(restoreSide, d) => {
          // Restore in-place: switch side safely, then fill.
          if (restoreSide !== side) setSide(restoreSide);
          setText(d.text || "");
          setSelectedSetId(d.setId ?? null);
          setUrgent(Boolean(d.urgent));
          setPublicChannel((d.publicChannel as any) || "general");
          setError(null);
        }}
      />

      {/* Audience sheets */}
      <SetPickerSheet
        open={setPickerOpen}
        onClose={() => setSetPickerOpen(false)}
        sets={sets}
        activeSet={selectedSetId}
        onPick={(next) => setSelectedSetId(next)}
        onNewSet={() => router.push("/siddes-sets?create=1")}
        title="Choose Audience"
        allLabel={`All ${SIDES[side].label}`}
      />

      <TopicPickerSheet
        open={topicPickerOpen}
        onClose={() => setTopicPickerOpen(false)}
        value={publicChannel}
        onPick={(next) => setPublicChannel(next)}
      />

      {/* Public confirm (above everything) */}
      {publicConfirmOpen ? (
        <div className="fixed inset-0 z-[120] flex items-end justify-center md:items-center">
          <button
            type="button"
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setPublicConfirmOpen(false)}
            aria-label="Close public confirm"
          />
          <div className="relative w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl shadow-2xl p-6 animate-in slide-in-from-bottom-full duration-200">
            <div className="flex items-center justify-between mb-3">
              <div className={cn("font-bold", SIDE_THEMES.public.text)}>Post to Public?</div>
              <button
                type="button"
                onClick={() => setPublicConfirmOpen(false)}
                className="p-2 rounded-full hover:bg-gray-100"
                aria-label="Close"
              >
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            <div className="text-sm text-gray-700 mb-3">
              Public means <span className="font-bold">anyone</span> can see this. You can delete later.
            </div>

            <div className="mb-4">
              <span
                className={cn(
                  "text-[10px] px-2 py-1 rounded-full border font-black uppercase tracking-widest",
                  SIDE_THEMES.public.lightBg,
                  SIDE_THEMES.public.text,
                  SIDE_THEMES.public.border
                )}
              >
                Public: {SIDES.public.privacyHint}
              </span>
            </div>

            {pendingPublicText ? (
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs text-gray-700 mb-4">
                “{pendingPublicText}”
              </div>
            ) : null}

            <label className="flex items-center gap-2 text-xs text-gray-600 mb-4 select-none">
              <input
                type="checkbox"
                className="accent-gray-900"
                checked={publicConfirmDontAsk}
                onChange={(e) => setPublicConfirmDontAsk(e.target.checked)}
              />
              Don’t ask again
            </label>

            <div className="flex gap-2">
              <button
                type="button"
                className="flex-1 px-4 py-2 rounded-full border border-gray-200 text-gray-800 font-bold hover:bg-gray-50"
                onClick={() => setPublicConfirmOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="flex-1 px-4 py-2 rounded-full bg-gray-900 text-white font-bold hover:opacity-90"
                onClick={confirmPublicPost}
              >
                Post Public
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
