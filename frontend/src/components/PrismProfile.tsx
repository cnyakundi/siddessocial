"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Globe,
  Users,
  Lock,
  Briefcase,
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
import { SIDES, SIDE_THEMES } from "@/src/lib/sides";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

export type PrismFacet = {
  side: SideId;
  displayName: string;
  headline: string;
  bio: string;
  location?: string | null;
  website?: string | null;
  coverImage?: string | null;
  anthem?: { title: string; artist: string } | null;
  pulse?: { label: string; text: string } | null;
  updatedAt?: string | null;
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
  facet?: PrismFacet;
  siders?: number | string | null;
  viewerSidedAs?: SideId | null;
  sharedSets?: string[];
  error?: string;
};

const SIDE_ICON: Record<SideId, React.ComponentType<{ size?: string | number | undefined }>> = {
  public: Globe,
  friends: Users,
  close: Lock,
  work: Briefcase,
};

const COVER: Record<SideId, string> = {
  public: "bg-gradient-to-r from-blue-600 to-blue-400",
  friends: "bg-gradient-to-r from-emerald-600 to-emerald-400",
  close: "bg-gradient-to-r from-rose-600 to-rose-400",
  work: "bg-gradient-to-r from-slate-700 to-slate-500",
};

function initialsFrom(nameOrHandle: string) {
  const s = (nameOrHandle || "").replace(/^@/, "").trim();
  if (!s) return "U";
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return (parts[0][0] || "U").toUpperCase();
  return ((parts[0][0] || "U") + (parts[parts.length - 1][0] || "U")).toUpperCase();
}

function safeWebsiteHref(website: string) {
  const w = (website || "").trim();
  if (!w) return "#";
  if (w.startsWith("http://") || w.startsWith("https://")) return w;
  return "https://" + w;
}

function privacyTruth(viewSide: SideId) {
  if (viewSide === "public") return "Public identity";
  return `Visible to ${SIDES[viewSide].label} Side`;
}

export function SideWithSheet(props: {
  open: boolean;
  onClose: () => void;
  current: SideId | null;
  busy?: boolean;
  onPick: (side: SideId | "public") => Promise<void> | void;
}) {
  const { open, onClose, current, busy, onPick } = props;

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const choices: Array<{ side: SideId; title: string; desc: string }> = [
    { side: "friends", title: "Friends", desc: "Casual, private." },
    { side: "close", title: "Close", desc: "Inner circle." },
    { side: "work", title: "Work", desc: "Professional context." },
  ];

  return (
    <div className="fixed inset-0 z-[98] flex items-end justify-center md:items-center">
      <button type="button" className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} aria-label="Close" />
      <div className="relative w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl shadow-2xl p-6 animate-in slide-in-from-bottom-full duration-200">
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="text-lg font-black text-gray-900">Side</div>
            <div className="text-xs text-gray-500 mt-1">Place this person into a private context.</div>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-gray-100" aria-label="Close">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="space-y-2">
          {choices.map((c) => {
            const t = SIDE_THEMES[c.side];
            const Icon = SIDE_ICON[c.side];
            const active = current === c.side;
            return (
              <button
                key={c.side}
                type="button"
                disabled={!!busy}
                onClick={async () => {
                  try {
                    await onPick(c.side);
                    onClose();
                  } catch {}
                }}
                className={cn(
                  "w-full p-4 rounded-2xl bg-gray-50 hover:bg-gray-100 flex items-center gap-4 text-left border",
                  active ? cn("border-gray-200", t.lightBg) : "border-gray-100"
                )}
              >
                <div className={cn("w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm", t.text)}>
                  <Icon size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-extrabold text-gray-900 flex items-center gap-2">
                    {c.title}
                    {active ? <Check size={16} className={t.text} strokeWidth={3} /> : null}
                  </div>
                  <div className="text-xs text-gray-500">{c.desc}</div>
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
              <div className="text-xs text-gray-500">Return to Public (remove the relationship edge).</div>
            </div>
          </button>
        </div>

        <button type="button" onClick={onClose} className="w-full mt-6 py-3 font-semibold text-gray-500 hover:bg-gray-50 rounded-xl">
          Cancel
        </button>
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
    anthem: { title: string; artist: string };
    pulse: { label: string; text: string };
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
}) {
  const { viewSide, handle, facet, siders, sharedSets, actions } = props;

  const theme = SIDE_THEMES[viewSide];
  const Icon = SIDE_ICON[viewSide];

  const name = facet.displayName || handle || "User";
  const headline = (facet.headline || "").trim();
  const bio = (facet.bio || "").trim();
  const location = (facet.location || "").trim();
  const website = (facet.website || "").trim();
  const coverImage = (facet.coverImage || "").trim();
  const anthem = facet.anthem;
  const pulse = facet.pulse;

  const truth = privacyTruth(viewSide);const isClose = viewSide === "close";

  const showSiders = isClose || (typeof siders !== "undefined" && siders !== null);
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
            {initialsFrom(name)}
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

        {/* Siders + Shared Sets */}
        {(showSiders || (sharedSets && sharedSets.length > 0)) ? (
          <div className="py-4 border-t border-gray-100 flex items-start justify-between gap-4">
            {showSiders ? (
              <div className="flex flex-col">
                <span className="text-lg font-black text-gray-900">{isClose ? "Inner Circle" : String(siders ?? "")}</span>
                <span className="text-xs text-gray-500 font-medium">{isClose ? "Private Set" : "Siders"}</span>
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

export function CopyLinkButton({ href, label }: { href: string; label?: string }) {
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
    <button type="button" onClick={doCopy} className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-extrabold text-sm hover:bg-gray-200 transition-all flex items-center gap-2">
      <Copy size={16} /> {copied ? "Copied" : label || "Copy link"}
    </button>
  );
}

export function SideActionButtons(props: {
  viewerSidedAs: SideId | null;
  onOpenSheet: () => void;
}) {
  const { viewerSidedAs, onOpenSheet } = props;

  if (viewerSidedAs && viewerSidedAs !== "public") {
    const t = SIDE_THEMES[viewerSidedAs];
    return (
      <button
        type="button"
        onClick={onOpenSheet}
        className={cn(
          "flex-1 py-2.5 rounded-xl font-extrabold text-sm text-white shadow-md active:scale-95 transition-all flex items-center justify-center gap-2",
          t.primaryBg
        )}
      >
        Sided: {SIDES[viewerSidedAs].label} <ChevronDown size={16} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpenSheet}
      className="flex-1 py-2.5 rounded-xl font-extrabold text-sm text-white shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900"
    >
      <Plus size={16} /> Side
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

  const sides: SideId[] = ["public", "friends", "close", "work"];

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-black text-gray-900">Preview identities</div>
          <div className="text-xs text-gray-500 mt-1">Only you can toggle. Everyone else sees one identity chosen by relationship.</div>
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
