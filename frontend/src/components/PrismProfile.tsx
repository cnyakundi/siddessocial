"use client";

/* eslint-disable @next/next/no-img-element */

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
Globe,
  Users,
  Lock,
  
  Heart,Briefcase,
  Shield,
  MapPin,
  Link as LinkIcon,
  Music,
  PlayCircle,
  Mic,
  Plus,
  ChevronDown,
  X,
  Check,
  Copy,
  Pencil,
} from "lucide-react";
import type { SideId } from "@/src/lib/sides";
import { SIDE_ORDER, SIDES, SIDE_THEMES } from "@/src/lib/sides";
import type { FeedPost } from "@/src/lib/feedTypes";
import { signUpload, uploadToSignedUrl, commitUpload } from "@/src/lib/mediaClient";
function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

// sd_932: restore PrismProfile local helpers (initials, website normalization, privacy label, cover gradients)

function initialsFrom(name: string): string {
  const s = String(name || "").trim();
  if (!s) return "U";
  const words = s.split(/\s+/).filter(Boolean);
  const a = (words[0]?.[0] || "").toUpperCase();
  const b =
    words.length > 1
      ? (words[words.length - 1]?.[0] || "").toUpperCase()
      : (words[0]?.[1] || "").toUpperCase();
  const out = (a + b).trim();
  return out || a || "U";
}

function safeWebsiteHref(website: string) {
  const w = (website || "").trim();
  if (!w) return "#";
  if (w.startsWith("http://") || w.startsWith("https://")) return w;
  return "https://" + w;
}

function privacyTruth(side: SideId): string {
  try {
    const meta = (SIDES as any)?.[side];
    if (meta && meta.privacyHint) return String(meta.privacyHint);
    if (meta && meta.isPrivate) return "Restricted";
    return "Visible";
  } catch {
    return "Visible";
  }
}

// Tailwind-safe static cover gradients (PrismProfile fallback)
const COVER: Record<SideId, string> = {
  public: "bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600",
  friends: "bg-gradient-to-br from-emerald-500 via-teal-500 to-emerald-600",
  close: "bg-gradient-to-br from-rose-500 via-pink-500 to-rose-600",
  work: "bg-gradient-to-br from-slate-700 via-slate-800 to-black",
};

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}
export type PrismFacet = {
  side: SideId;
  displayName: string;
  headline: string;
  bio: string;
  location?: string | null;
  website?: string | null;
  coverImage?: string | null;
  avatarImage?: string | null;
  anthem?: { title: string; artist: string } | null;
  pulse?: { label: string; text: string } | null;
  updatedAt?: string | null;
  avatarMediaKey?: string | null;
};
export type PrismOwnerPayload = {
  ok: boolean;
  user?: { id: number; username: string; handle: string };
  items?: PrismFacet[];
  error?: string;
};
export type ProfileViewPayload = {
  ok: boolean;
  user?: { id: number; username: string; handle: string };
  viewSide?: SideId;
  requestedSide?: SideId;
  allowedSides?: SideId[];
  viewerAuthed?: boolean;
  isOwner?: boolean;
  viewerFollowsPublic?: boolean;
  publicFollowers?: number | null;
  publicFollowing?: number | null;
facet?: PrismFacet;
  siders?: number | string | null;
  viewerSidedAs?: SideId | null;
  sharedSets?: string[];
  posts?: {
    side: SideId;
    count: number;
    items: FeedPost[];
    nextCursor?: string | null;
    hasMore?: boolean;
    serverTs?: number;
  };
  error?: string;
};
const SIDE_ICON: Record<SideId, React.ComponentType<React.SVGProps<SVGSVGElement> & { size?: string | number }>> = {
  public: Globe,
  friends: Users,
  close: Heart,
  work: Briefcase,
};


export function PrismSideTabs(props: {
  active: SideId;
  allowedSides: SideId[];
  onPick: (side: SideId) => void;
  onLockedPick?: (side: SideId) => void;
}) {
  const { active, allowedSides, onPick, onLockedPick } = props;
  const items: SideId[] = SIDE_ORDER;

  return (
    <div className="mt-4">
      <div className="text-xs text-gray-500 font-semibold mb-2">Side = who this is for.</div>

      {/* Prism Switch (segmented control) */}
      <div className="flex p-1.5 bg-gray-100/80 backdrop-blur rounded-[24px] border border-white shadow-sm">
        {items.map((side) => {
          const t = SIDE_THEMES[side];
          const Icon = SIDE_ICON[side];
          const isActive = active === side;
          const isAllowed = Array.isArray(allowedSides) ? allowedSides.includes(side) : side === "public";
          const locked = !isAllowed && !isActive;

          return (
            <button hidden
              key={side}
              type="button"
              onClick={() => {
                if (locked) {
                  onLockedPick?.(side);
                  return;
                }
                onPick(side);
              }}
              className={cn(
                "flex-1 flex flex-col items-center py-2.5 rounded-[18px] transition-all duration-300",
                isActive ? "bg-white shadow-[0_4px_12px_rgba(0,0,0,0.06)] text-gray-900 scale-[1.02]" : "text-gray-400 hover:text-gray-700",
                locked ? "opacity-70" : ""
              )}
              aria-disabled={locked}
              aria-label={SIDES[side].label}
              title={SIDES[side].privacyHint}
            >
              <span className="relative">
                <Icon size={18} className={cn(isActive ? t.text : "")} />
                {locked ? (
                  <span className="absolute -top-2 -right-2 bg-white rounded-full p-0.5 shadow-sm border border-gray-200">
                    <Lock size={12} className="text-gray-500" />
                  </span>
                ) : null}
              </span>
              <span className="text-[9px] font-black mt-1 uppercase tracking-tighter italic">{SIDES[side].label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SideWithSheet(props: {
  open: boolean;
  onClose: () => void;
  current: SideId | null;
  busy?: boolean;
  onPick: (side: SideId | "public") => Promise<void> | void;
}) {
  const { open, onClose, current, busy, onPick } = props;

  const [confirmSide, setConfirmSide] = useState<SideId | null>(null);

  useEffect(() => {
    if (!open) {
      setConfirmSide(null);
      return;
    }
    setConfirmSide(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (confirmSide) {
        setConfirmSide(null);
        return;
      }
      onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, confirmSide]);

  if (!open) return null;

  const closeUpgradeLocked = !(current === "friends" || current === "close");

  const choices: Array<{ side: SideId; title: string; desc: string; requiresConfirm?: boolean }> = [
    { side: "friends", title: "Friends", desc: "They can view your Friends identity + Friends posts." },
    {
      side: "close",
      title: "Close",
      desc: "Inner Circle. They can view your Close identity + Close posts.",
      requiresConfirm: true,
    },
    {
      side: "work",
      title: "Work",
      desc: "Colleagues & clients. They can view your Work identity + Work posts.",
      requiresConfirm: true,
    },
  ];

  const confirmCopy: Record<
    SideId,
    { title: string; body: string; confirmLabel: string }
  > = {
    public: {
      title: "Confirm",
      body: "",
      confirmLabel: "Confirm",
    },
    friends: {
      title: "Confirm",
      body: "",
      confirmLabel: "Confirm",
    },
    close: {
      title: "Confirm Inner Circle access",
      body:
        "You are about to place this person into your Close (Inner Circle) Side. This grants them access to your Close identity and Close posts. This does not change what you can see of them.",
      confirmLabel: "Grant Inner Circle access",
    },
    work: {
      title: "Confirm Work access",
      body:
        "You are about to place this person into your Work Side. This grants them access to your Work identity and Work posts. This does not change what you can see of them.",
      confirmLabel: "Grant Work access",
    },
  };

  async function commitPick(side: SideId) {
    await onPick(side);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[98] flex items-end justify-center md:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={() => {
          if (confirmSide) {
            setConfirmSide(null);
            return;
          }
          onClose();
        }}
        aria-label="Close"
      />
      <div className="relative w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl shadow-2xl p-6 animate-in slide-in-from-bottom-full duration-200">
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="text-lg font-black text-gray-900">{confirmSide ? confirmCopy[confirmSide].title : "Side"}</div>
            <div className="text-xs text-gray-500 mt-1">
              {confirmSide
                ? "Double-check the direction."
                : "You are choosing what they can access of you. This does not change what you can access of them."}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (confirmSide) {
                setConfirmSide(null);
                return;
              }
              onClose();
            }}
            className="p-2 rounded-full hover:bg-gray-100"
            aria-label="Close"
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {confirmSide ? (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl border border-gray-200 bg-gray-50">
              <div className="flex items-start gap-3">
                <div className={cn("w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm", SIDE_THEMES[confirmSide].text)}>
                  {React.createElement(SIDE_ICON[confirmSide], { size: 18 })}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-extrabold text-gray-900">{SIDES[confirmSide].label}</div>
                  <div className="text-xs text-gray-600 mt-1">{confirmCopy[confirmSide].body}</div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                disabled={!!busy}
                onClick={async () => {
                  try {
                    await commitPick(confirmSide);
                  } catch {}
                }}
                className={cn(
                  "flex-1 py-3 rounded-xl font-extrabold text-sm text-white shadow-md active:scale-95 transition-all",
                  SIDE_THEMES[confirmSide].primaryBg,
                  busy ? "opacity-80 cursor-not-allowed" : ""
                )}
              >
                {confirmCopy[confirmSide].confirmLabel}
              </button>
              <button
                type="button"
                onClick={() => setConfirmSide(null)}
                className="px-4 py-3 rounded-xl bg-white border border-gray-200 text-gray-800 font-extrabold text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>

            <div className="text-[11px] text-gray-500">
              Tip: You can undo anytime using <span className="font-bold">Un-side</span>.
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {choices.map((c) => {
              const t = SIDE_THEMES[c.side];
              const Icon = SIDE_ICON[c.side];
              const active = current === c.side;
              const closeLockedByUpgrade = c.side === "close" && closeUpgradeLocked;
              return (
                <button
                  key={c.side}
                  type="button"
                  disabled={!!busy || closeLockedByUpgrade}
                  onClick={async () => {
                    if (closeLockedByUpgrade) return;
                    if (c.requiresConfirm) {
                      setConfirmSide(c.side);
                      return;
                    }
                    try {
                      await commitPick(c.side);
                    } catch {}
                  }}
                  className={cn(
                    "w-full p-4 rounded-2xl bg-gray-50 hover:bg-gray-100 flex items-center gap-4 text-left border",
                    active ? cn("border-gray-200", t.lightBg) : "border-gray-100",
                    closeLockedByUpgrade ? "opacity-60 cursor-not-allowed hover:bg-gray-50" : ""
                  )}
                >
                  <div className={cn("w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm", t.text)}>
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-extrabold text-gray-900 flex items-center gap-2">
                      {c.title}
                      {active ? <Check size={16} className={t.text} strokeWidth={3} /> : null}
                      {c.requiresConfirm ? (
                        <span className="ml-auto text-[10px] px-2 py-1 rounded-full bg-white border border-gray-200 text-gray-700 font-black">
                          Confirm
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-gray-500">
                      {c.desc}
                      {closeLockedByUpgrade ? " (Friends first)" : ""}
                    </div>
                  </div>
                </button>
              );
            })}

            <button
              type="button"
              disabled={!!busy}
              onClick={async () => {
                try {
                  await onPick("public");
                  onClose();
                } catch {}
              }}
              className="w-full p-4 rounded-2xl bg-white hover:bg-gray-50 flex items-center gap-4 text-left border border-gray-200"
            >
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-700 shadow-sm">
                <X size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-extrabold text-gray-900">Un-side</div>
                <div className="text-xs text-gray-500">Remove the edge. They only see your Public identity.</div>
              </div>
            </button>
          </div>
        )}

        {!confirmSide ? (
          <button
            type="button"
            onClick={onClose}
            className="w-full mt-6 py-3 font-semibold text-gray-500 hover:bg-gray-50 rounded-xl"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </div>
  );
}
export function PrismFacetEditSheet(props: {
  open: boolean;
  onClose: () => void;
  side: SideId;
  facet: PrismFacet | null;
  onSave: (patch: {
    side: SideId;
    displayName: string;
    headline: string;
    bio: string;
    location: string;
    website: string;
    coverImage: string;
    avatarImage: string;
    anthem: { title: string; artist: string };
    pulse: { label: string; text: string };
    avatarMediaKey?: string;
  }) => Promise<void>;
}) {
  const { open, onClose, side, facet, onSave } = props;
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [website, setWebsite] = useState("");
  const [coverImage, setCoverImage] = useState<string>("" );
  const [avatarMediaKey, setAvatarMediaKey] = useState<string>("");
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const [avatarBusy, setAvatarBusy] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [avatarImage, setAvatarImage] = useState<string>("" );
  const [anthemTitle, setAnthemTitle] = useState("");
  const [anthemArtist, setAnthemArtist] = useState("");
  const [pulseLabel, setPulseLabel] = useState("");
  const [pulseText, setPulseText] = useState("");
  useEffect(() => {
    if (!open) return;
    setErr(null);
    setDisplayName(String(facet?.displayName || ""));
    setHeadline(String(facet?.headline || ""));
    setBio(String(facet?.bio || ""));
    setLocation(String(facet?.location || ""));
    setWebsite(String(facet?.website || ""));
    setCoverImage(String((facet as any)?.coverImage || ""));
    setAvatarMediaKey(String((facet as any)?.avatarMediaKey || ""));
    setAvatarPreview(String((facet as any)?.avatarImage || ""));
    setAvatarImage(String((facet as any)?.avatarImage || ""));
    setAnthemTitle(String(facet?.anthem?.title || ""));
    setAnthemArtist(String(facet?.anthem?.artist || ""));
    setPulseLabel(String(facet?.pulse?.label || ""));
    setPulseText(String(facet?.pulse?.text || ""));
  }, [open, facet]);
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  const theme = SIDE_THEMES[side];
  const saveNow = async () => {
    setErr(null);
    setSaving(true);
    try {
      await onSave({
        side,
        displayName: displayName.trim(),
        headline: headline.trim(),
        bio,
        location: location.trim(),
        website: website.trim(),
        coverImage: coverImage.trim(),
        avatarImage: avatarImage.trim(),
        anthem: { title: anthemTitle.trim(), artist: anthemArtist.trim() },
        pulse: { label: pulseLabel.trim(), text: pulseText.trim() },
      });
      onClose();
    } catch (e: any) {
      setErr(e?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="fixed inset-0 z-[99] flex items-end justify-center md:items-center">
      <button type="button" className="absolute inset-0 bg-black/40" onClick={onClose} aria-label="Close" />
      <div className="relative w-full md:max-w-lg bg-white rounded-t-3xl md:rounded-3xl shadow-2xl border border-gray-200 max-h-[92vh] overflow-y-auto">
        <div className="px-4 pt-4 pb-3 border-b border-gray-100">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-black text-gray-900">Edit {SIDES[side].label} identity</div>
              <div className="text-[11px] text-gray-500">This edits only this Side’s profile facet.</div>
            </div>
            <button type="button" onClick={onClose} className="p-2 rounded-full border border-gray-200 bg-white text-gray-700 hover:bg-gray-50" aria-label="Close">
              <X size={16} />
            </button>
          </div>
        </div>
        {err ? (
          <div className="px-4 pt-4">
            <div className="p-3 rounded-2xl border border-red-200 bg-red-50 text-red-700 text-sm">
              <div className="font-bold">Error</div>
              <div className="text-xs mt-1">{err}</div>
            </div>
          </div>
        ) : null}
        <div className="px-4 py-4 space-y-4">
        {/* Avatar photo (upload) */}
        <div className="p-4 rounded-2xl border border-gray-200 bg-white flex items-center gap-4">
          <div
            className={cn(
              "w-16 h-16 rounded-full bg-gray-100 overflow-hidden border-2 border-white shadow-sm flex items-center justify-center font-black text-lg select-none ring-2",
              theme.ring
            )}
          >
            {avatarPreview ? (
              <img src={avatarPreview} alt="Avatar preview" className="w-full h-full object-cover" />
            ) : (
              initialsFrom(displayName || (facet?.displayName || "You"))
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-gray-900">Avatar photo</div>
            <div className="text-[11px] text-gray-500 mt-1">Upload a face/photo for this Side only.</div>
            <div className="text-[11px] text-gray-400 mt-1">Safety: this does not change your other personas.</div>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              aria-hidden="true"
              tabIndex={-1}
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
                e.target.value = "";
                if (!file) return;
                setErr(null);
                setAvatarBusy(true);
                try {
                  const localPreview = URL.createObjectURL(file);
                  setAvatarPreview(localPreview);
                  const signed = await signUpload(file, "image");
                  const putUrl = String(signed?.upload?.url || "");
                  const key = String(signed?.media?.r2Key || "");
                  if (!signed?.ok || !putUrl || !key) throw new Error(signed?.error || "sign_failed");
                  const ok = await uploadToSignedUrl(putUrl, file, signed?.upload?.headers || undefined);
                  if (!ok) throw new Error("upload_failed");
                  const committed = await commitUpload(key, {
                    isPublic: side === "public",
                    postId: "prism_avatar:" + side,
                  });
                  if (!committed?.ok) throw new Error(committed?.error || "commit_failed");
                  setAvatarMediaKey(key);
                  await onSave({ side, avatarMediaKey: key } as any);
                } catch (err) {
                  setErr(errorMessage(err) || "Avatar upload failed.");
                } finally {
                  setAvatarBusy(false);
                }
              }}
            />
            <button
              type="button"
              disabled={avatarBusy}
              onClick={() => avatarInputRef.current?.click()}
              className={cn(
                "px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest border transition-all",
                avatarBusy ? "bg-gray-100 text-gray-300 border-gray-200 cursor-not-allowed" : "bg-white text-gray-900 border-gray-200 hover:bg-gray-50"
              )}
            >
              {avatarBusy ? "Uploading…" : "Upload"}
            </button>
            <button
              type="button"
              disabled={avatarBusy || !avatarMediaKey}
              onClick={async () => {
                setErr(null);
                setAvatarBusy(true);
                try {
                  setAvatarMediaKey("");
                  setAvatarPreview("");
                  await onSave({ side, avatarMediaKey: "" } as any);
                } catch (err) {
                  setErr(errorMessage(err) || "Remove failed.");
                } finally {
                  setAvatarBusy(false);
                }
              }}
              className={cn(
                "px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest border transition-all",
                (!avatarMediaKey || avatarBusy) ? "bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed" : "bg-gray-50 text-gray-500 border-gray-200 hover:text-gray-900"
              )}
            >
              Remove
            </button>
          </div>
        </div>
          <div>
            <div className="text-sm font-bold text-gray-900 mb-1">Display name</div>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900" />
          </div>
          <div>
            <div className="text-sm font-bold text-gray-900 mb-1">Headline</div>
            <input value={headline} onChange={(e) => setHeadline(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900" />
          </div>
          <div>
            <div className="text-sm font-bold text-gray-900 mb-1">Bio</div>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900" />
            <div className="text-[11px] text-gray-500 mt-1">Keep it calm. No cross-Side leakage.</div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="text-sm font-bold text-gray-900 mb-1">Location</div>
              <input value={location} onChange={(e) => setLocation(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
            <div>
              <div className="text-sm font-bold text-gray-900 mb-1">Website</div>
              <input value={website} onChange={(e) => setWebsite(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
          <div>
            <div className="text-sm font-bold text-gray-900 mb-1">Avatar image URL</div>
            <input
              value={avatarImage}
              onChange={(e) => setAvatarImage(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
            <div className="text-[11px] text-gray-500 mt-1">Optional. Used for your Side-aware avatar (Me button). Scoped to this identity.</div>
          </div>
          <div>
            <div className="text-sm font-bold text-gray-900 mb-1">Cover image URL</div>
            <input
              value={coverImage}
              onChange={(e) => setCoverImage(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
            <div className="text-[11px] text-gray-500 mt-1">Optional. Scoped to this identity.</div>
          </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="text-sm font-bold text-gray-900 mb-1">Anthem title</div>
              <input value={anthemTitle} onChange={(e) => setAnthemTitle(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
            <div>
              <div className="text-sm font-bold text-gray-900 mb-1">Anthem artist</div>
              <input value={anthemArtist} onChange={(e) => setAnthemArtist(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
          </div>
          <div>
            <div className="text-sm font-bold text-gray-900 mb-1">Pulse label</div>
            <input value={pulseLabel} onChange={(e) => setPulseLabel(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900" />
          </div>
          <div>
            <div className="text-sm font-bold text-gray-900 mb-1">Pulse text</div>
            <textarea value={pulseText} onChange={(e) => setPulseText(e.target.value)} rows={3} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={saving} className="flex-1 py-3 rounded-xl font-extrabold text-gray-700 border border-gray-200 hover:bg-gray-50">
              Cancel
            </button>
            <button type="button" onClick={saveNow} disabled={saving} className={cn("flex-1 py-3 rounded-xl font-extrabold text-white hover:opacity-95", theme.primaryBg)}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
export function PrismIdentityCard(props: {
  viewSide: SideId;
  handle: string;
  facet: PrismFacet;
  siders?: number | string | null;
  sharedSets?: string[];
  actions?: React.ReactNode;
  variant?: "hero" | "clean";
}) {
  const { viewSide, handle, facet, sharedSets, actions, variant = "hero" } = props;
  const theme = SIDE_THEMES[viewSide];
  const Icon = SIDE_ICON[viewSide];
  const name = facet.displayName || handle || "User";
  const avatarUrl = String((facet as any)?.avatarImage || "").trim();
  const headline = (facet.headline || "").trim();
  const bio = (facet.bio || "").trim();
  const location = (facet.location || "").trim();
  const website = (facet.website || "").trim();
  const coverImage = (facet.coverImage || "").trim();
  const avatarImage = (String((facet as any)?.avatarImage || "") || "").trim();
  const anthem = facet.anthem;
  const pulse = facet.pulse;
  const truth = privacyTruth(viewSide);
  const isClose = viewSide === "close";
  const showAccessStat = isClose;

  if (variant === "clean") {
    return (
      <div className="w-full">
        <div className="flex flex-col items-center text-center pt-8 pb-6">
          <div
            className={cn(
              "w-28 h-28 rounded-full bg-gray-100 overflow-hidden shadow-sm flex items-center justify-center font-black text-2xl select-none ring-2",
              theme.ring
            )}
            aria-hidden="true"
            title={name}
          >
            {avatarImage ? <img src={avatarImage} alt="" className="w-full h-full object-cover" /> : initialsFrom(name)}
          </div>

          <h1 className="mt-5 text-2xl font-black text-gray-900 tracking-tight">{name}</h1>
          <div className="text-sm text-gray-500 font-semibold mt-1">{handle}</div>

          <div
            className={cn(
              "mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-extrabold uppercase tracking-wider",
              theme.lightBg,
              theme.border,
              theme.text
            )}
          >
            <Icon size={12} />
            {SIDES[viewSide].label} identity
          </div>

          {headline ? <div className="mt-3 text-sm font-semibold text-gray-700">{headline}</div> : null}

          <p className={cn("mt-4 text-[15px] leading-relaxed max-w-md", bio ? "text-gray-700" : "text-gray-400")}>
            {bio || "No bio yet."}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 mt-4 text-xs text-gray-500 font-medium">
            {location ? (
              <div className="flex items-center gap-1">
                <MapPin size={14} /> {location}
              </div>
            ) : null}
            {website ? (
              <a
                href={safeWebsiteHref(website)}
                target="_blank"
                rel="noreferrer"
                className={cn("flex items-center gap-1 font-extrabold hover:underline", theme.text)}
              >
                <LinkIcon size={14} /> {website}
              </a>
            ) : null}
            <div className="flex items-center gap-1 text-gray-500 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
              <Shield size={10} /> {truth}
            </div>
          </div>

          {actions ? <div className="mt-6 w-full max-w-sm">{actions}</div> : null}

          {sharedSets && sharedSets.length > 0 ? (
            <div className="mt-6 w-full max-w-md">
              <div className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-2">Shared Sets</div>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {sharedSets.slice(0, 8).map((s) => (
                  <span
                    key={s}
                    className="px-2 py-1 rounded-full bg-gray-100 text-[10px] font-extrabold text-gray-700 border border-gray-200"
                  >
                    {s}
                  </span>
                ))}
                {sharedSets.length > 8 ? (
                  <span className="px-2 py-1 rounded-full bg-gray-50 text-[10px] font-extrabold text-gray-500 border border-gray-200">
                    +{sharedSets.length - 8}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden border", theme.border)}>
      {/* Cover */}
      <div
        className={cn("h-44 w-full relative", coverImage ? "bg-gray-900 bg-cover bg-center" : COVER[viewSide])}
        style={coverImage ? ({ backgroundImage: `url(${coverImage})` } as any) : undefined}
      >
        <div className="absolute inset-0 bg-black/10" />
        <div className="absolute top-4 right-4">
          <div className="px-3 py-1.5 bg-white/90 backdrop-blur rounded-full text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
            <Icon size={12} />
            <span className={cn(theme.text)}>{SIDES[viewSide].label} identity</span>
          </div>
        </div>
      </div>
      <div className="px-6 relative pb-6">
        {/* Avatar */}
        <div className="relative -mt-10 mb-4 inline-block">
          <div
            className={cn(
              "w-24 h-24 rounded-full border-4 border-white bg-gray-100 overflow-hidden shadow-md flex items-center justify-center font-black text-xl select-none ring-2",
              theme.ring
            )}
            aria-hidden="true"
            title={name}
          >
            {avatarImage ? (
              <img src={avatarImage} alt="" className="w-full h-full object-cover" />
            ) : (
              initialsFrom(name)
            )}
          </div>
          <div className={cn("absolute bottom-1 right-1 w-8 h-8 rounded-full border-[3px] border-white flex items-center justify-center text-white shadow-sm", theme.primaryBg)}>
            <Icon size={14} />
          </div>
        </div>
        {/* Identity */}
        <div className="mb-4">
          <h1 className="text-2xl font-black text-gray-900 tracking-tight leading-tight">{name}</h1>
          <div className="text-sm text-gray-500 font-semibold mt-1">{handle}</div>
          {headline ? <div className="text-sm text-gray-700 font-semibold mt-2">{headline}</div> : null}
        </div>
        {/* Anthem */}
        {anthem && (anthem.title || anthem.artist) ? (
          <div className="mb-5 flex items-center gap-3 p-2 bg-gray-50 rounded-xl border border-gray-100 max-w-xs">
            <div className={cn("p-2 rounded-full text-white", theme.primaryBg)}>
              <Music size={14} />
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="text-xs font-extrabold text-gray-900 truncate">{anthem.title || "Anthem"}</div>
              <div className="text-[10px] text-gray-500 truncate">{anthem.artist || ""}</div>
            </div>
            <PlayCircle size={20} className="text-gray-300" />
          </div>
        ) : null}
        {/* Bio */}
        <div className="mb-5">
          <p className={cn("text-sm leading-relaxed", bio ? "text-gray-800" : "text-gray-400")}>{bio || "No bio yet."}</p>
          <div className="flex flex-wrap gap-y-2 gap-x-4 text-xs text-gray-500 font-medium mt-3">
            {location ? (
              <div className="flex items-center gap-1">
                <MapPin size={14} /> {location}
              </div>
            ) : null}
            {website ? (
              <a
                href={safeWebsiteHref(website)}
                target="_blank"
                rel="noreferrer"
                className={cn("flex items-center gap-1", theme.text, "font-extrabold hover:underline")}
              >
                <LinkIcon size={14} /> {website}
              </a>
            ) : null}
            <div className="flex items-center gap-1 text-gray-500 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
              <Shield size={10} /> {truth}
            </div>
          </div>
        </div>
        {/* Actions */}
        {actions ? <div className="mb-6">{actions}</div> : null}
        {/* Pulse */}
        {pulse && (pulse.label || pulse.text) ? (
          <div className="mb-6">
            <div className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-2">
              {viewSide === "public" ? "Recent Town Hall" : "Recent Pulse"}
            </div>
            <div className={cn("p-4 rounded-2xl bg-gray-50 border-l-4", theme.accentBorder)}>
              <div className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Mic size={10} /> {pulse.label || (viewSide === "public" ? "Town Hall" : "Pulse")}
              </div>
              <div className="text-sm font-extrabold text-gray-900">{pulse.text ? `“${pulse.text}”` : ""}</div>
            </div>
          </div>
        ) : null}
        {/* Access + Shared Sets */}
        {(showAccessStat || (sharedSets && sharedSets.length > 0)) ? (
          <div className="py-4 border-t border-gray-100 flex items-start justify-between gap-4">
            {showAccessStat ? (
              <div className="flex flex-col">
                <span className="text-lg font-black text-gray-900">Close Vault</span>
                <span className="text-xs text-gray-500 font-medium">Private Set</span>
              </div>
            ) : (
              <div />
            )}

            {sharedSets && sharedSets.length > 0 ? (
              <div className="flex flex-col items-end">
                <div className="text-xs font-extrabold text-gray-900 mb-2">Shared Sets</div>
                <div className="flex gap-1.5 flex-wrap justify-end">
                  {sharedSets.slice(0, 5).map((s) => (
                    <span key={s} className="px-2 py-1 rounded-md bg-gray-100 text-[10px] font-extrabold text-gray-700 border border-gray-200">
                      {s}
                    </span>
                  ))}
                  {sharedSets.length > 5 ? (
                    <span className="px-2 py-1 rounded-md bg-gray-50 text-[10px] font-extrabold text-gray-500 border border-gray-200">+{sharedSets.length - 5}</span>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
export function CopyLinkButton({ href, label, messageHref }: { href: string; label?: string; messageHref?: string | null }) {
  const [copied, setCopied] = useState(false);
  const doCopy = async () => {
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // best-effort
    }
  };
  return (
    <>
      <button type="button" onClick={doCopy} className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-extrabold text-sm hover:bg-gray-200 transition-all flex items-center gap-2">
        <Copy size={16} /> {copied ? "Copied" : label || "Copy link"}
      </button>
      {messageHref ? (
        <Link href={messageHref} className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-extrabold text-sm hover:bg-gray-200 transition-all flex items-center gap-2">
          Message
        </Link>
      ) : null}
    </>
  );
}
export function SideActionButtons(props: {
  viewerSidedAs: SideId | null;
  onOpenSheet: () => void;
}) {
  const { viewerSidedAs, onOpenSheet } = props;

  // Design canon:
  // - Unsided -> "Add Friend" (clear CTA, opens sheet to choose Friends/Close/Work)
  // - Sided -> show the Side label only (no "Sided:" prefix)
  const sided = viewerSidedAs && viewerSidedAs !== "public" ? viewerSidedAs : null;

  if (sided) {
    const t = SIDE_THEMES[sided];
    return (
      <button
        type="button"
        onClick={onOpenSheet}
        className={cn(
          "flex-1 h-11 rounded-2xl font-extrabold text-sm text-white shadow-md active:scale-95 transition-all flex items-center justify-center gap-2",
          t.primaryBg
        )}
        aria-label={`Sided: ${SIDES[sided].label}`}
        title={`Sided: ${SIDES[sided].label}`}
      >
        {SIDES[sided].label} <ChevronDown size={16} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpenSheet}
      className="flex-1 h-11 rounded-2xl font-extrabold text-sm bg-gray-100 text-gray-900 hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
      aria-label="Add Friend"
      title="Add Friend"
    >
      <Plus size={16} /> Add Friend
    </button>
  );
}

export function EditFacetButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex-1 py-2.5 rounded-xl font-extrabold text-sm text-white shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 bg-gray-900 hover:bg-black">
      <Pencil size={16} /> Edit
    </button>
  );
}
export function OwnerTopRow(props: { username: string; previewSide: SideId; setPreviewSide: (s: SideId) => void }) {
  const { username, previewSide, setPreviewSide } = props;
  const sides: SideId[] = SIDE_ORDER;
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-black text-gray-900">Preview Side identities</div>
          <div className="text-xs text-gray-500 mt-1">Only you can toggle. Everyone else sees the identity your relationship grants.</div>
        </div>
        <Link href={`/u/${encodeURIComponent(username)}`} className="px-3 py-2 rounded-xl text-sm font-extrabold border border-gray-200 bg-white hover:bg-gray-50">
          View as others
        </Link>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {sides.map((s) => {
          const t = SIDE_THEMES[s];
          const active = s === previewSide;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setPreviewSide(s)}
              className={cn(
                "px-3 py-1.5 rounded-full text-[11px] font-extrabold border transition-colors",
                active ? cn(t.lightBg, t.text, "border-gray-200") : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
              )}
            >
              {SIDES[s].label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
