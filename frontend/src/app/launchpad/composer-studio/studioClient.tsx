"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ChevronDown,
  Globe,
  Image as ImageIcon,
  Link as LinkIcon,
  Loader2,
  Mic,
  Plus,
  RefreshCw,
  Type,
  Users,
  Lock,
  Briefcase,
  X,
  type LucideIcon,
} from "lucide-react";

import type { SideId } from "@/src/lib/sides";
import { SIDE_ORDER, SIDES, SIDE_THEMES } from "@/src/lib/sides";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

// Studio-only: "design tools" map (not production capabilities).
type StudioTool = { id: string; label: string; icon: LucideIcon };
const STUDIO_TOOLS: Record<SideId, StudioTool[]> = {
  public: [
    { id: "text", label: "Text", icon: Type },
    { id: "link", label: "Link", icon: LinkIcon },
    { id: "townhall", label: "Town Hall", icon: Mic },
  ],
  friends: [
    { id: "text", label: "Text", icon: Type },
    { id: "photo", label: "Photo", icon: ImageIcon },
    { id: "prompt", label: "Prompt", icon: RefreshCw },
  ],
  close: [
    { id: "text", label: "Text", icon: Type },
    { id: "voice", label: "Voice", icon: Mic },
  ],
  work: [
    { id: "update", label: "Update", icon: Type },
    { id: "file", label: "File", icon: LinkIcon },
  ],
};

function SideIcon({ side, size = 14 }: { side: SideId; size?: number }) {
  const icon =
    side === "public" ? Globe : side === "friends" ? Users : side === "close" ? Lock : Briefcase;
  const Icon = icon;
  return <Icon size={size} />;
}

function WebComposerStudio({
  side,
  status,
  onClose,
}: {
  side: SideId;
  status: "idle" | "busy" | "error";
  onClose: () => void;
}) {
  const theme = SIDE_THEMES[side];
  const isPublic = side === "public";

  const [activeTool, setActiveTool] = useState<string>("text");
  const [text, setText] = useState<string>("");

  const maxChars = isPublic ? 800 : 5000;
  const charCount = text.length;
  const overLimit = charCount > maxChars;

  const canPost = text.trim().length > 0 && status !== "busy" && !overLimit;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div
        className={cn(
          "w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col relative animate-in zoom-in-95 duration-200 ring-1 ring-white/20",
          status === "error" ? "ring-2 ring-red-500" : null
        )}
      >
        {/* Safety header */}
        <div className={cn("px-6 py-4 border-b flex items-center justify-between", theme.lightBg, theme.border)}>
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn("flex items-center gap-2 px-3 py-1.5 bg-white rounded-full border text-xs font-extrabold shadow-sm", theme.text, theme.border)}>
              <SideIcon side={side} size={14} />
              {isPublic ? "Public Side" : `Audience: ${SIDES[side].label} (Locked)`}
            </div>

            {!isPublic ? (
              <button
                type="button"
                className="flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-gray-900 transition-colors px-2 py-1 rounded hover:bg-white/60"
              >
                to <span className="underline decoration-dashed decoration-gray-400 underline-offset-4">Gym Crew</span>{" "}
                <ChevronDown size={12} />
              </button>
            ) : (
              <button
                type="button"
                className="flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-gray-900 transition-colors px-2 py-1 rounded hover:bg-white/60"
              >
                Topic <span className="underline decoration-dashed decoration-gray-400 underline-offset-4">General</span>{" "}
                <ChevronDown size={12} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/60 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Editor */}
        <div className="p-8 min-h-[320px] flex flex-col">
          <div className="flex gap-5">
            <div className="w-12 h-12 rounded-full bg-gray-100 shrink-0 border border-gray-200 flex items-center justify-center font-extrabold text-gray-700">
              Y
            </div>

            <div className="flex-1 flex flex-col">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="What's on your mind?"
                className="w-full text-xl text-gray-900 placeholder-gray-300 outline-none resize-none h-40 bg-transparent leading-relaxed"
                autoFocus
              />

              {/* Toolbar below input */}
              <div className="flex gap-2 mt-5">
                {STUDIO_TOOLS[side].map((tool) => {
                  const isActive = activeTool === tool.id;
                  const ToolIcon = tool.icon;
                  return (
                    <button
                      key={tool.id}
                      type="button"
                      onClick={() => setActiveTool(tool.id)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all duration-200 border",
                        isActive ? cn(theme.lightBg, theme.text, theme.border, "scale-105") : "bg-white border-transparent text-gray-400 hover:bg-gray-50 hover:text-gray-700"
                      )}
                    >
                      <ToolIcon size={14} />
                      {tool.label}
                    </button>
                  );
                })}
                <span className="ml-auto text-[10px] font-bold text-gray-300 self-center">
                  Studio tools (dev-only)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
          <div className="flex items-center gap-4 min-w-0">
            <span className={cn("text-[10px] font-mono", overLimit ? "text-red-600 font-bold" : "text-gray-400")}>
              {charCount} / {maxChars}
            </span>

            {status === "error" ? (
              <span className="flex items-center gap-1.5 text-xs font-extrabold text-red-700 bg-red-50 border border-red-100 px-2 py-1 rounded-full">
                <AlertTriangle size={12} /> Failed to post (studio)
              </span>
            ) : null}
          </div>

          <div className="flex gap-3 items-center">
            <button type="button" className="text-xs font-extrabold text-gray-500 hover:text-gray-900 transition-colors">
              Drafts
            </button>
            <button
              type="button"
              disabled={!canPost}
              className={cn(
                "px-8 py-3 rounded-full text-white text-sm font-extrabold shadow-lg shadow-gray-200 transition-all flex items-center gap-2",
                canPost ? cn(theme.primaryBg, "hover:opacity-90 hover:scale-[1.02] active:scale-95") : "bg-gray-300 cursor-not-allowed"
              )}
            >
              {status === "busy" ? <Loader2 size={16} className="animate-spin" /> : null}
              {status === "busy" ? "Posting…" : "Post"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ComposerStudioClient() {
  const [open, setOpen] = useState(true);
  const [side, setSide] = useState<SideId>("work");
  const [status, setStatus] = useState<"idle" | "busy" | "error">("idle");

  const theme = useMemo(() => SIDE_THEMES[side], [side]);

  return (
    <main
      className="min-h-screen bg-gray-100 p-8"
      style={{
        backgroundImage: "radial-gradient(#cbd5e1 1px, transparent 1px)",
        backgroundSize: "24px 24px",
      }}
    >
      <div className="mx-auto max-w-5xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-2xl font-black text-gray-900">Composer Studio</div>
            <div className="mt-1 text-sm text-gray-600 max-w-2xl">
              Dev-only playground to iterate on the Web Composer look & feel without shipping mock tools into production routes.
              In production, only real tools should appear.
            </div>

            <div className="mt-3 text-xs text-gray-500">
              Back to{" "}
              <Link href="/launchpad" className="font-bold hover:underline">
                Launchpad
              </Link>
            </div>
          </div>

          <div className={cn("rounded-2xl border bg-white shadow-sm p-3", theme.border)}>
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Controls</div>

            <div className="mt-2 flex flex-wrap gap-2">
              {SIDE_ORDER.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setSide(s);
                    setStatus("idle");
                    setOpen(true);
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition-all",
                    side === s ? cn(SIDE_THEMES[s].primaryBg, "text-white") : "text-gray-400 hover:bg-gray-100"
                  )}
                >
                  {SIDES[s].label}
                </button>
              ))}
            </div>

            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => setStatus("idle")} className="px-2 py-1 bg-gray-100 rounded text-[10px] font-mono">
                Idle
              </button>
              <button type="button" onClick={() => setStatus("busy")} className="px-2 py-1 bg-gray-100 rounded text-[10px] font-mono">
                Busy
              </button>
              <button type="button" onClick={() => setStatus("error")} className="px-2 py-1 bg-red-100 text-red-700 rounded text-[10px] font-mono">
                Error
              </button>

              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className={cn("ml-auto px-3 py-2 rounded-lg text-white text-xs font-extrabold inline-flex items-center gap-2", open ? "bg-gray-900" : cn(theme.primaryBg))}
                title={open ? "Close composer" : "Open composer"}
              >
                {open ? <X size={16} /> : <Plus size={16} />}
                {open ? "Close" : "Open"}
              </button>
            </div>
          </div>
        </div>

        {/* Fake background context */}
        <div className="mt-8 grid grid-cols-3 gap-4 opacity-50 pointer-events-none select-none">
          <div className="h-20 bg-white rounded-2xl shadow-sm border border-gray-200 col-span-3" />
          <div className="h-96 bg-white rounded-2xl shadow-sm border border-gray-200 col-span-2" />
          <div className="h-96 bg-white rounded-2xl shadow-sm border border-gray-200" />
        </div>
      </div>

      {open ? <WebComposerStudio side={side} status={status} onClose={() => setOpen(false)} /> : null}
    </main>
  );
}

