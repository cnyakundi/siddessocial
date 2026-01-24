"use client";

// sd_469c: compose audience guard (web + mobile)


import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  useRouter, useSearchParams } from "next/navigation";

import {
  AlertTriangle,
  Globe,
  Loader2,
  Trash2,
  X,
  FileText,
  Link2,
  Sparkles,
  MapPin,
  Mic,
  CheckSquare,
  ImagePlus,
  Play,
  ChevronDown,
  Lock
} from "lucide-react";
import { useSide } from "@/src/components/SideProvider";
import { enqueuePost, removeQueuedItem } from "@/src/lib/offlineQueue";
import { SIDES, SIDE_ORDER, SIDE_THEMES, isSideId, type SideId } from "@/src/lib/sides";
import { FLAGS } from "@/src/lib/flags";
import type { PublicChannelId } from "@/src/lib/publicChannels";
import { PUBLIC_CHANNELS, labelForPublicChannel, normalizePublicChannel } from "@/src/lib/publicChannels";
import { ComposeSuggestionBar } from "@/src/components/ComposeSuggestionBar";
import type { SetDef, SetId } from "@/src/lib/sets";
import { DEFAULT_SETS } from "@/src/lib/sets";
import { getSetsProvider } from "@/src/lib/setsProvider";
import { SetPickerSheet } from "@/src/components/SetPickerSheet";
import { useLockBodyScroll } from "@/src/hooks/useLockBodyScroll";
import { usePrismAvatar } from "@/src/hooks/usePrismAvatar";
import { toast } from "@/src/lib/toast";
import { getStoredLastPublicTopic, getStoredLastSetForSide } from "@/src/lib/audienceStore";
import { signUpload, uploadToSignedUrl } from "@/src/lib/mediaClient";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

function formatDurationMs(ms?: number): string {
  const n = typeof ms === "number" ? Math.floor(ms) : 0;
  if (!n || n <= 0) return "";
  const total = Math.max(0, Math.round(n / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}


function AvatarMe({ side }: { side: SideId }) {
  const t = SIDE_THEMES[side];
  const { img, initials } = usePrismAvatar(side);

  return (
    <div
      className={cn(
        "w-12 h-12 rounded-full overflow-hidden border-2 flex items-center justify-center font-extrabold shrink-0 select-none",
        t.border,
        img ? "bg-gray-100" : cn(t.lightBg, t.text)
      )}
      aria-hidden="true"
      title="You"
    >
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img} alt="" className="w-full h-full object-cover" />
      ) : (
        initials
      )}
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
  useLockBodyScroll(open);

  // sd_543g_topic_picker_escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[125] flex items-end justify-center md:items-center">
      <button
        type="button"
        aria-label="Close topic picker"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onPointerDown={(e) => {
          e.preventDefault();
          onClose();
        }}
        onClick={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      <div className="relative w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl shadow-2xl p-6 animate-in slide-in-from-bottom-full duration-200">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Topic</h3>
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

  useLockBodyScroll(open);

  // sd_543g_drafts_sheet_escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    setStore(loadDraftStore());
  }, [open]);

  if (!open) return null;

  const entries = SIDE_ORDER.map((s) => ({ side: s, draft: store[s] || null }))
    .filter((x) => Boolean(x.draft)) as Array<{ side: SideId; draft: ComposeDraft }>;

  return (
    <div className="fixed inset-0 z-[140] flex items-end justify-center md:items-center">
      <button
        type="button"
        aria-label="Close drafts"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onPointerDown={(e) => {
          e.preventDefault();
          onClose();
        }}
        onClick={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
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

  // sd_469c: compose audience guard (only confirm when draft exists)
  const hasDraft = (v: string) => v.trim().length > 0;

  const [text, setText] = useState("");
  const textRef = useRef<HTMLTextAreaElement | null>(null);

  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<ComposeError | null>(null);
  const [draftsOpen, setDraftsOpen] = useState(false);

  const setsProvider = useMemo(() => getSetsProvider(), []);
  const [sets, setSets] = useState<SetDef[]>(() => DEFAULT_SETS);
  const [selectedSetId, setSelectedSetId] = useState<SetId | null>(null);
  const [urgent, setUrgent] = useState(false);
  const [publicChannel, setPublicChannel] = useState<PublicChannelId>("general");
  const [setsLoaded, setSetsLoaded] = useState(false);

  const [setPickerOpen, setSetPickerOpen] = useState(false);
  const [topicPickerOpen, setTopicPickerOpen] = useState(false);


  const requestedSide: SideId | null = useMemo(() => {
    const raw = String(searchParams?.get("side") || "").trim().toLowerCase();
    return isSideId(raw) ? (raw as SideId) : null;
  }, [searchParams]);

  const requestedSetId: SetId | null = useMemo(() => {
    const raw = String(searchParams?.get("set") || "").trim();
    return raw ? (raw as SetId) : null;
  }, [searchParams]);

  const requestedTopic: PublicChannelId | null = useMemo(() => {
    const raw = String(searchParams?.get("topic") || "").trim();
    return raw ? (raw as PublicChannelId) : null;
  }, [searchParams]);

  // sd_470c: pulse mode (from query param: ?mode=pulse)
  const requestedMode: string = useMemo(() => {
    const raw = String(searchParams?.get("mode") || "").trim().toLowerCase();
    return raw;
  }, [searchParams]);
  const isPulse = requestedMode === "pulse";

  const isAdvanced = useMemo(() => {
    const raw = String(searchParams?.get("advanced") || "").trim().toLowerCase();
    return raw === "1" || raw === "true" || raw === "yes";
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
  const restoredFromDraftRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;

    const prompt = String(searchParams?.get("prompt") || "").trim();
    if (prompt) {
      restoredFromDraftRef.current = false;
      setText(prompt);
      restoredRef.current = true;
      return;
    }

    try {
      const store = loadDraftStore();
      const d = store[side];
      if (d && d.text && !text.trim()) {
        restoredFromDraftRef.current = true;
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

  // sd_404: apply audience intent from query params (set/topic) once, when the Side matches.
  const intentAppliedRef = useRef(false);
  useEffect(() => {
    if (intentAppliedRef.current) return;
    if (!requestedSetId && !requestedTopic) return;
    if (requestedSide && requestedSide !== side) return;

    const prompt = String(searchParams?.get("prompt") || "").trim();
    const shouldApply = Boolean(prompt) || !(text || "").trim();
    if (!shouldApply) return;

    if (side === "public") {
      if (FLAGS.publicChannels && requestedTopic) {
        setPublicChannel(requestedTopic);
      }
      intentAppliedRef.current = true;
      return;
    }

    if (requestedSetId) {
      if (!setsLoaded) return;
      const ok = (sets || []).some((s) => s.id === requestedSetId);
      if (ok) setSelectedSetId(requestedSetId);
      intentAppliedRef.current = true;
      return;
    }
  }, [requestedSetId, requestedTopic, requestedSide, side, searchParams, text, setsLoaded, sets]);

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

  const close = (opts?: { skipSaveDraft?: boolean; forceFeed?: boolean }) => {
    // Never drop text silently (unless we just successfully posted/queued).
    if (!opts?.skipSaveDraft && (text || "").trim()) saveCurrentDraft();

    // After a successful post/queue, force a fresh feed mount (avoids stale feed illusions).
    if (opts?.forceFeed) {
      router.push(`/siddes-feed?r=${Date.now()}`);
      return;
    }

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


  // sd_403: reset audience on side change (skip initial mount so drafts/links can restore safely)
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    setSelectedSetId(null);
    setUrgent(false);
    setPublicChannel("general");
    setError(null);
  }, [side]);

  // sd_384_media: attachments (R2)
  type MediaDraftItem = {
    id: string;
    name: string;
    kind: "image" | "video";
    previewUrl: string;
    status: "uploading" | "ready" | "failed";
    width?: number;
    height?: number;
    durationMs?: number;
    r2Key?: string;
  };

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [mediaItems, setMediaItems] = useState<MediaDraftItem[]>([]);

  const mediaBusy = mediaItems.some((m) => m.status === "uploading");
  const mediaFailed = mediaItems.some((m) => m.status === "failed");
  const mediaKeys = mediaItems
    .map((m) => (m.status === "ready" ? m.r2Key : null))
    .filter((x): x is string => Boolean(x));

  // sd_555_media_meta: carry width/height/durationMs to backend so feed can render premium media
  const mediaMeta = useMemo(() => {
    const out: Record<string, any> = {};
    for (const m of mediaItems) {
      if (m.status !== "ready" || !m.r2Key) continue;
      const meta: any = {};
      if (typeof m.width === "number" && m.width > 0) meta.w = m.width;
      if (typeof m.height === "number" && m.height > 0) meta.h = m.height;
      if (typeof m.durationMs === "number" && m.durationMs > 0) meta.durationMs = m.durationMs;
      if (Object.keys(meta).length) out[m.r2Key] = meta;
    }
    return out;
  }, [mediaItems]);

  const clearMedia = () => {
    setMediaItems((cur) => {
      for (const m of cur) {
        try {
          if (m.previewUrl) URL.revokeObjectURL(m.previewUrl);
        } catch {
          // ignore
        }
      }
      return [];
    });
  };

  const removeMedia = (id: string) => {
    setMediaItems((cur) => {
      const next = cur.filter((m) => m.id !== id);
      const gone = cur.find((m) => m.id === id);
      if (gone?.previewUrl) {
        try {
          URL.revokeObjectURL(gone.previewUrl);
        } catch {
          // ignore
        }
      }
      return next;
    });
  };

  const pickMedia = () => {
    try {
      fileInputRef.current?.click();
    } catch {
      // ignore
    }
  };

  const addMediaFiles = async (files: FileList | File[]) => {
    const list = Array.from(files as any).filter(
      (f: any): f is File => !!f && typeof f === "object" && typeof f.type === "string"
    );

    const media = list.filter((f) => {
      const t = String(f.type || "");
      return t.startsWith("image/") || t.startsWith("video/");
    });

    if (media.length === 0) {
      toast.error("Pick a photo or video file.");
      return;
    }

    const onlineNow = typeof navigator !== "undefined" ? navigator.onLine : true;
    if (!onlineNow) {
      if (mediaKeys.length) {
        setError({ kind: "network", message: "Media uploads require online." });
        setPosting(false);
        return;
      }

      toast.error("Go online to upload media.");
      return;
    }

    const remaining = Math.max(0, 4 - mediaItems.length);
    if (remaining <= 0) {
      toast.error("Max 4 media items.");
      return;
    }

    const batch = media.slice(0, remaining);

    for (const file of batch) {
      const kind = String(file.type || "").startsWith("video/") ? "video" : "image";
      const id = `m_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      const previewUrl = URL.createObjectURL(file);
      const name = String((file as any).name || (kind === "video" ? "video" : "photo"));

      setMediaItems((cur) => [...cur, { id, name, kind, previewUrl, status: "uploading" }]);

      // sd_555_media_meta: sniff width/height (+ duration for videos) for nicer layouts + overlays
      (async () => {
        try {
          if (kind === "image") {
            const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
              const img = new Image();
              img.onload = () => resolve({ w: (img as any).naturalWidth || 0, h: (img as any).naturalHeight || 0 });
              img.onerror = () => reject(new Error("img_meta_failed"));
              img.src = previewUrl;
            });
            if (dims.w > 0 && dims.h > 0) {
              setMediaItems((cur) => cur.map((m) => (m.id === id ? { ...m, width: dims.w, height: dims.h } : m)));
            }
          } else {
            const meta = await new Promise<{ w: number; h: number; d: number }>((resolve, reject) => {
              const v = document.createElement("video");
              v.preload = "metadata";
              v.muted = true;
              (v as any).playsInline = true;
              v.onloadedmetadata = () => {
                const w = (v as any).videoWidth || 0;
                const h = (v as any).videoHeight || 0;
                const d = Number((v as any).duration || 0);
                resolve({ w, h, d });
              };
              v.onerror = () => reject(new Error("video_meta_failed"));
              v.src = previewUrl;
              try {
                v.load();
              } catch {
                // ignore
              }
            });
            const durationMs = Number.isFinite(meta.d) && meta.d > 0 ? Math.round(meta.d * 1000) : undefined;
            if (meta.w > 0 && meta.h > 0) {
              setMediaItems((cur) =>
                cur.map((m) =>
                  m.id === id ? { ...m, width: meta.w, height: meta.h, durationMs } : m
                )
              );
            } else if (durationMs) {
              setMediaItems((cur) => cur.map((m) => (m.id === id ? { ...m, durationMs } : m)));
            }
          }
        } catch {
          // ignore
        }
      })();

      try {
        const signed = await signUpload(file, kind);
        const url = signed?.upload?.url ? String(signed.upload.url) : "";
        const key = signed?.media?.r2Key ? String(signed.media.r2Key) : "";
        if (!signed?.ok || !url || !key) throw new Error(signed?.error || "sign_failed");

        const ok = await uploadToSignedUrl(url, file, signed?.upload?.headers || undefined);
        if (!ok) throw new Error("upload_failed");

        setMediaItems((cur) => cur.map((m) => (m.id === id ? { ...m, status: "ready", r2Key: key } : m)));
      } catch {
        setMediaItems((cur) => cur.map((m) => (m.id === id ? { ...m, status: "failed" } : m)));
      }
    }
  };


  // Hydration-safe: load sets after mount and when side changes
  useEffect(() => {
    let mounted = true;

    setSetsLoaded(false);
    // Prevent "wrong side" sets flashing during side switches.
    setSets(side === "friends" ? DEFAULT_SETS : []);

    // sd_384_media: attachments never carry across Sides
    clearMedia();

    // sd_384_media: attachments never carry across Sides
    clearMedia();
    setsProvider
      .list({ side })
      .then((items) => {
        if (!mounted) return;
        setSets(items);
        setSetsLoaded(true);
      })
      .catch(() => {
        if (!mounted) return;
        setSetsLoaded(true);
      });

    return () => {
      mounted = false;
    };
  }, [setsProvider, side]);

  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

  const selectedSet = useMemo(() => sets.find((s) => s.id === selectedSetId) ?? null, [sets, selectedSetId]);

  // sd_403: auto-apply audience from link/store (only when not reshuffling a restored draft)
  const autoAudienceAppliedSideRef = useRef<SideId | null>(null);
  useEffect(() => {
    if (autoAudienceAppliedSideRef.current === side) return;

    const hasText = (text || "").trim().length > 0;
    if (hasText && restoredFromDraftRef.current) {
      autoAudienceAppliedSideRef.current = side;
      return;
    }

    if (side === "public") {
      if (FLAGS.publicChannels) {
        const desired = String(requestedTopic || getStoredLastPublicTopic() || "").trim();
        if (desired && PUBLIC_CHANNELS.some((c) => c.id === desired)) {
          setPublicChannel(desired as any);
        }
      }
      autoAudienceAppliedSideRef.current = side;
      return;
    }

    // Private: wait for sets load so UI label matches actual target
    if (!setsLoaded) return;
    if (selectedSetId) {
      autoAudienceAppliedSideRef.current = side;
      return;
    }

    const desiredSet = String(requestedSetId || getStoredLastSetForSide(side) || "").trim();
    if (desiredSet) {
      const found = sets.find((s) => s.id === desiredSet && s.side === side);
      if (found) setSelectedSetId(found.id);
    }

    autoAudienceAppliedSideRef.current = side;
  }, [side, setsLoaded, sets, text, selectedSetId, requestedSetId, requestedTopic]);


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

  const lockTextSimple = side === "public" ? "Everyone" : `${SIDES[side].label} only`;

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

  
const canPost = hasDraft(text) && !posting && !overLimit && !mediaBusy;

  const remaining = maxChars - charCount;
  const showCount = isAdvanced || overLimit || remaining <= 100;


  // sd_398: Quick tools dock (templates + toggles). No mock post types.
  type QuickTool = {
    id: string;
    label: string;
    Icon: React.ComponentType<{ size?: number | string; className?: string }>;
    active?: boolean;
    tone?: "side" | "urgent";
    onClick: () => void;
    title?: string;
  };

    const applyTemplate = (kind: string) => {
    const tmpl = (() => {
      switch (kind) {
        case "thread":
          return "1/ ";
        case "link":
          return "https://";
        case "townhall":
          return "Question: ";
        case "prompt":
          return "Prompt: ";
        case "checkin":
          return "Location: ";
        case "work_update":
          return `Update:
- Status:
- Blockers:
- Next:`;
        case "work_task":
          return `Task:
- Owner:
- Due:
- Next step:`;
        case "close_prompt":
          return "Right now I'm feeling...";
        default:
          return "";
      }
    })();

    if (!tmpl) return;

    setText((prev) => {
      const p = String(prev || "");
      if (!p.trim()) return tmpl;
      return p.replace(/\s+$/g, "") + "\n\n" + tmpl;
    });

    // Best-effort focus back to the editor
    window.setTimeout(() => {
      try {
        textRef.current?.focus();
      } catch {}
    }, 0);
  };

const quickTools = useMemo<QuickTool[]>(() => {
    const out: QuickTool[] = [];

    // Real toggle (stored + sent to API)
    out.push({
      id: "urgent",
      label: urgent ? "Urgent on" : "Urgent",
      Icon: AlertTriangle,
      active: urgent,
      tone: "urgent",
      onClick: () => setUrgent((u) => !u),
      title: urgent ? "Click to remove urgent" : "Mark as urgent",
    });

    // Side-scoped templates (still plain-text posts; no fake post types)
    if (side === "public") {
      out.push({ id: "thread", label: "Thread", Icon: FileText, tone: "side", onClick: () => applyTemplate("thread"), title: "Insert thread starter" });
      out.push({ id: "link", label: "Link", Icon: Link2, tone: "side", onClick: () => applyTemplate("link"), title: "Insert a link" });
      out.push({ id: "townhall", label: "Town Hall Q", Icon: Mic, tone: "side", onClick: () => applyTemplate("townhall"), title: "Insert a question template" });
    } else if (side === "friends") {
      out.push({ id: "prompt", label: "Prompt", Icon: Sparkles, tone: "side", onClick: () => applyTemplate("prompt"), title: "Insert a prompt starter" });
      out.push({ id: "checkin", label: "Check-in", Icon: MapPin, tone: "side", onClick: () => applyTemplate("checkin"), title: "Insert a location" });
    } else if (side === "work") {
      out.push({ id: "update", label: "Update", Icon: FileText, tone: "side", onClick: () => applyTemplate("work_update"), title: "Insert work update format" });
      out.push({ id: "task", label: "Task template", Icon: CheckSquare, tone: "side", onClick: () => applyTemplate("work_task"), title: "Insert task format" });
    } else if (side === "close") {
      out.push({ id: "prompt", label: "Prompt", Icon: Sparkles, tone: "side", onClick: () => applyTemplate("close_prompt"), title: "Insert a gentle prompt" });
    }

    return out;
  }, [side, urgent]);


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
      close({ skipSaveDraft: true, forceFeed: true });
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
          mediaKeys,
          mediaMeta: Object.keys(mediaMeta || {}).length ? mediaMeta : undefined,
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
        close({ skipSaveDraft: true, forceFeed: true });
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
          onClick={() => close()}
        />

        <div
          role="dialog" aria-modal="true" aria-label={title}
          className={cn(
            "relative w-full md:max-w-2xl bg-white overflow-hidden flex flex-col shadow-2xl",
            "rounded-t-3xl md:rounded-3xl",
            "ring-1 ring-white/20",
            error ? "ring-2 ring-red-500" : null,
            "animate-in slide-in-from-bottom-full md:zoom-in-95 duration-200"
          )}
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
        >
                    {/* Header (MVP) */}
          <div className="px-6 md:px-8 py-4 border-b border-gray-100 bg-white flex items-center justify-between">
            <button
              type="button"
              onClick={() => close()}
              className="text-sm font-bold text-gray-700 hover:text-gray-900"
            >
              Cancel
            </button>

            <div className={cn("text-sm font-extrabold", theme.text)}>{SIDES[side].label}</div>

            <button
              type="button"
              onClick={submit}
              disabled={!canPost}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-extrabold text-white inline-flex items-center gap-2 transition-all",
                canPost ? cn(theme.primaryBg, "hover:opacity-90 active:scale-95") : "bg-gray-300 cursor-not-allowed"
              )}
              aria-label="Post"
              title={!canPost ? (overLimit ? `Too long (max ${maxChars})` : posting ? "Posting…" : mediaBusy ? "Wait for uploads" : "Write something first") : "Post"}
            >
              {posting ? <Loader2 size={16} className="animate-spin" /> : null}
              {posting ? "Posting…" : "Post"}
            </button>
          </div>

          {/* Audience row (MVP) */}
          <div className="px-6 md:px-8 pt-3 pb-2 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={openAudience}
              disabled={side === "public" && !FLAGS.publicChannels}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors min-w-0 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={side === "public" ? "Choose topic" : "Choose set"}
              title={side === "public" ? "Topic" : "Set"}
            >
              <span className={cn("w-2 h-2 rounded-full", theme.primaryBg)} aria-hidden="true" />
              <span className="text-sm font-bold text-gray-900 truncate max-w-[260px]">{audienceLabel}</span>
              <ChevronDown size={16} className="text-gray-400 shrink-0" />
            </button>

            <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 shrink-0">
              <Lock size={12} />
              <span>{lockTextSimple}</span>
            </div>
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

          {/* sd_470c: pulse mode hint (Inbox → Pulse opens compose with ?mode=pulse) */}
          {isPulse ? (
            <div className="px-6 md:px-8 pt-4">
              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Pulse</div>
                  <div className="text-sm font-bold text-gray-900 mt-1 truncate">
                    Quick check‑in
                  </div>
                  <div className="text-xs text-gray-500 mt-1 truncate">
                    Short, simple, and context-safe.
                  </div>
                </div>
                <div
                  className={cn(
                    "px-3 py-1.5 rounded-full border text-[10px] font-extrabold uppercase tracking-widest",
                    theme.lightBg,
                    theme.text,
                    theme.border
                  )}
                >
                  {SIDES[side].label}
                </div>
              </div>
            </div>
          ) : null}

          {/* 2) Main editor */}
          <div className="p-6 md:p-8 min-h-[320px] flex flex-col">
            <div className="sr-only">{title}</div>

            <div className="flex gap-5">
              <AvatarMe side={side} />

              <div className="flex-1 min-w-0">
                <textarea
                  ref={textRef}
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    if (error?.kind === "validation") setError(null);
                  }}
                  placeholder={isPulse ? (`Quick check‑in to ${SIDES[side].label}…`) : (side === "public" ? "Share to Public…" : side === "friends" ? "Say something to Friends…" : side === "close" ? "Talk to Close…" : "Note for Work…")}
                  className="w-full h-40 resize-none outline-none text-xl text-gray-900 placeholder:text-gray-300 bg-transparent leading-relaxed"
                  autoFocus
                />

                {/* sd_544b_inline_error */}
                {error ? (
                  <div className="mt-3 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-100 px-3 py-2 rounded-2xl inline-flex items-center gap-2 max-w-full">
                    <AlertTriangle size={12} />
                    <span className="truncate">{error.message}</span>
                  </div>
                ) : null}

                                {/* Suggestions (confidence gated, reversible) */}
                <div className="mt-4 hidden">
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

                {/* sd_398: Quick tools (templates + toggles) */}
                <div className="mt-5 hidden">
                  <div className="flex gap-2 flex-wrap">
                    {quickTools.map((t) => {
                      const isUrgent = t.tone === "urgent";
                      const active = Boolean(t.active);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={t.onClick}
                          aria-pressed={typeof t.active === "boolean" ? t.active : undefined}
                          className={cn(
                            "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-extrabold transition-all border",
                            isUrgent
                              ? active
                                ? "bg-red-50 text-red-700 border-red-100"
                                : "bg-white text-gray-700 border-gray-200 hover:bg-red-50 hover:text-red-700 hover:border-red-100"
                              : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50",
                            !isUrgent && active ? cn(theme.lightBg, theme.text, theme.border) : null
                          )}
                          title={t.title}
                        >
                          <t.Icon size={14} />
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="text-[11px] text-gray-400 mt-2">
                    Tools are templates/toggles - nothing posts automatically.
                  </div>
                </div>

                                {/* Selected context chips (clear fast) */}
                {isAdvanced && selectedSetId && selectedSet && (
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
                )}

                                {/* sd_384_media: selected uploads */}
                {mediaItems.length > 0 ? (
                  <div className="mt-3">
                    <div className="flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-2">
                      {mediaItems.slice(0, 4).map((m) => {
                        const failed = m.status === "failed";
                        const uploading = m.status === "uploading";
                        return (
                          <div
                            key={m.id}
                            className={cn(
                              "relative snap-start shrink-0 w-[78%] max-w-[360px] rounded-3xl overflow-hidden border-2 bg-gray-50",
                              failed ? "border-red-200" : "border-gray-100"
                            )}
                            title={m.name}
                          >
                            {m.previewUrl ? (
                              m.kind === "video" ? (
                                <div className="relative w-full h-56 lg:h-64">
                                  <video
                                    src={m.previewUrl}
                                    className="w-full h-full object-cover"
                                    muted
                                    playsInline
                                    preload="metadata"
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-14 h-14 rounded-full bg-black/35 backdrop-blur flex items-center justify-center">
                                      <Play size={26} className="text-white" />
                    {typeof m.durationMs === "number" && m.durationMs > 0 ? (
                      <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/45 text-white text-xs font-semibold">
                        {formatDurationMs(m.durationMs)}
                      </div>
                    ) : null}
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={m.previewUrl} alt="" className="w-full h-56 lg:h-64 object-cover" />
                              )
                            ) : (
                              <div className="w-full h-56 lg:h-64 flex items-center justify-center text-xs font-bold text-gray-400">
                                Media
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={() => removeMedia(m.id)}
                              className="absolute top-2 right-2 w-10 h-10 rounded-full bg-black/45 text-white flex items-center justify-center hover:bg-black/60"
                              aria-label="Remove media"
                              title="Remove"
                            >
                              <X size={18} />
                            </button>

                            {(uploading || failed) && (
                              <div
                                className={cn(
                                  "absolute inset-0 flex items-center justify-center text-sm font-extrabold",
                                  failed ? "bg-red-500/40 text-white" : "bg-black/35 text-white"
                                )}
                              >
                                {uploading ? "Uploading…" : "Failed"}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

</div>
            </div>
          </div>

          {/* 3) Footer (MVP) */}
          <div className="px-6 md:px-8 py-4 bg-white border-t border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={pickMedia}
                disabled={posting || mediaBusy || !isOnline || mediaItems.length >= 4}
                className={cn(
                  "w-10 h-10 rounded-full border flex items-center justify-center transition-colors",
                  posting || mediaBusy || !isOnline || mediaItems.length >= 4
                    ? "border-gray-200 text-gray-300 bg-white cursor-not-allowed"
                    : "border-gray-200 text-gray-700 bg-white hover:bg-gray-50"
                )}
                aria-label="Add photo"
                title={!isOnline ? "Go online to upload" : mediaItems.length >= 4 ? "Max 4 media" : "Add photo"}
              >
                <ImagePlus size={18} />
              </button>

              {isAdvanced ? (
                <button
                  type="button"
                  onClick={() => setDraftsOpen(true)}
                  className="text-xs font-bold text-gray-500 hover:text-gray-900 transition-colors"
                >
                  Drafts
                </button>
              ) : null}

              {isAdvanced ? (
                <button
                  type="button"
                  onClick={() => setUrgent((u) => !u)}
                  aria-pressed={urgent}
                  className={cn(
                    "text-xs font-extrabold px-3 py-1.5 rounded-full border transition-colors",
                    urgent
                      ? "bg-red-50 text-red-700 border-red-100 hover:opacity-90"
                      : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                  )}
                >
                  {urgent ? "Urgent on" : "Urgent"}
                </button>
              ) : null}
            </div>

            {showCount ? (
              <span className={cn("text-[10px] font-mono", overLimit ? "text-red-600 font-bold" : "text-gray-400")}>
                {charCount} / {maxChars}
              </span>
            ) : null}
          </div>


        </div>
      </div>
      {/* sd_384_media: hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = e.currentTarget.files;
          if (files && files.length) {
            void addMediaFiles(files);
          }
          e.currentTarget.value = "";
        }}
      />


      {/* Drafts */}
      <DraftsSheet
        open={draftsOpen}
        onClose={() => setDraftsOpen(false)}
        onRestore={(restoreSide, d) => {
          // Restore in-place: switch side safely, then fill.
          const apply = () => {
            setText(d.text || "");
            setSelectedSetId(d.setId ?? null);
            setUrgent(Boolean(d.urgent));
            setPublicChannel((d.publicChannel as any) || "general");
            setError(null);
          };

          if (restoreSide !== side) {
            setSide(restoreSide, { afterConfirm: apply });
            return;
          }

          apply();
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
        title="Set"
        allLabel={`All ${SIDES[side].label}`}
      />

      <TopicPickerSheet
        open={topicPickerOpen}
        onClose={() => setTopicPickerOpen(false)}
        value={publicChannel}
        onPick={(next) => setPublicChannel(next)}
      />

            {/* Public confirm (above everything) */}
      {publicConfirmOpen && (
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

            {pendingPublicText && (
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs text-gray-700 mb-4">
                “{pendingPublicText}”
              </div>
            )}

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
      )}
    </>
  );
}


// sd_555_media_meta: applied
