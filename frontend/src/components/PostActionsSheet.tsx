"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useLockBodyScroll } from "@/src/hooks/useLockBodyScroll";
import { useDialogA11y } from "@/src/hooks/useDialogA11y";

import { Ban, MessageCircle, EyeOff, Flag, Link2, Share2, X, Pencil, Trash2, Copy, VolumeX, User, Repeat } from "lucide-react";
import type { FeedPost } from "@/src/lib/feedTypes";
import type { SideId } from "@/src/lib/sides";
import { toast } from "@/src/lib/toast";

async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    return true;
  } catch {
    return false;
  }
}

export function PostActionsSheet({
  open,
  onClose,
  post,
  side,
  onOpen,
  onEcho,
  onHide,
  onEdit,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  post: FeedPost | null;
  side?: SideId;
  onOpen: () => void;
  onEcho?: () => void;
  onHide: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  useLockBodyScroll(open && Boolean(post) && mounted);

  const router = useRouter();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  useDialogA11y({ open: open && Boolean(post) && mounted, containerRef: panelRef, initialFocusRef: closeBtnRef, onClose });

  if (!open || !post || !mounted) return null;

  const relUrl = `/siddes-post/${post.id}`;
  const absUrl =
    typeof window !== "undefined" ? `${window.location.origin}${relUrl}` : relUrl;

  const isPublic = side === "public";


  const doOpen = () => {
    onOpen();
    onClose();
  };

  const doEcho = () => {
    if (!onEcho) return;
    onClose();
    // Open the Echo sheet after the actions sheet closes (avoids overlay stacking).
    setTimeout(() => {
      try { onEcho(); } catch {}
    }, 0);
  };

  const doViewProfile = () => {
    const raw = String((post as any)?.handle || "").trim();
    const u = raw.replace(/^@/, "").split(/\s+/)[0];
    if (!u) {
      toast.error("Could not open profile.");
      onClose();
      return;
    }
    router.push(`/u/${encodeURIComponent(u)}`);
    onClose();
  };

  const doCopyLink = async () => {
    const ok = await copyText(absUrl);
    const msg = ok
      ? isPublic
        ? "Link copied."
        : "Internal link copied (requires access)."
      : "Could not copy link.";
    toast[ok ? "success" : "error"](msg);
    onClose();
  };

  const doCopyText = async () => {
    const body = String((post as any)?.content ?? post.content ?? "").trim();
    if (!body) {
      toast.error("Nothing to copy.");
      onClose();
      return;
    }
    const ok = await copyText(body);
    toast[ok ? "success" : "error"](ok ? "Text copied." : "Could not copy text.");
    onClose();
  };

  const doShare = async () => {
    if (!isPublic) {
      await doCopyLink();
      return;
    }
    try {
      if (typeof navigator !== "undefined" && (navigator as any).share) {
        await (navigator as any).share({
          title: "Siddes",
          text: (post.content || "").slice(0, 140),
          url: absUrl,
        });
        toast.success("Shared.");
        onClose();
        return;
      }
    } catch {}
    await doCopyLink();
  };


  const doReport = async () => {
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetType: "post", targetId: post.id, reason: "other" }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j || j.ok !== true) {
        const msg = res.status === 429 ? "Slow down." : "Could not report.";
        throw new Error(msg);
      }
      toast.success("Reported. Thank you.");
      onClose();
    } catch (e) {
      toast.error((e as any)?.message || "Could not report.");
    }
  };

  
  const doMute = async () => {
    const who = String((post as any)?.handle || "").trim();
    if (!who) {
      toast.error("Can't mute unknown user.");
      return;
    }
    if (typeof window !== "undefined" && !window.confirm(`Mute ${who}? You won't see their posts in your feed.`)) {
      return;
    }
    try {
      const res = await fetch("/api/mutes", {
        method: "POST",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target: who }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j || j.ok !== true) {
        const msg = res.status === 429 ? "Slow down." : "Could not mute.";
        throw new Error(msg);
      }
      toast.success(`Muted ${who}.`);
      onClose();
    } catch (e) {
      toast.error((e as any)?.message || "Could not mute.");
    }
  };

const doBlock = async () => {
    const who = String((post as any)?.handle || "").trim();
    if (!who) {
      toast.error("Can't block unknown user.");
      return;
    }
    if (typeof window !== "undefined" && !window.confirm(`Block ${who}? You won't see each other.`)) {
      return;
    }
    try {
      const res = await fetch("/api/blocks", {
        method: "POST",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target: who }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j || j.ok !== true) {
        const msg = res.status === 429 ? "Slow down." : "Could not block.";
        throw new Error(msg);
      }
      toast.success(`Blocked ${who}.`);
      onClose();
    } catch (e) {
      toast.error((e as any)?.message || "Could not block.");
    }
  };


  const canEdit = Boolean((post as any)?.canEdit);
  const canDelete = Boolean((post as any)?.canDelete);

  const doEdit = () => {
    if (!onEdit) return;
    onEdit();
    onClose();
  };

  const doDelete = () => {
    if (!onDelete) return;
    if (typeof window !== "undefined" && !window.confirm("Delete this post? This cannot be undone.")) return;
    onDelete();
    onClose();
  };
  const doHide = () => {
    onHide();
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[999] flex items-end justify-center md:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onPointerDown={(e) => {
          // Do NOT preventDefault here — iOS PWA can suppress the click.
          e.stopPropagation();
        }}
        onTouchStart={(e) => {
          e.stopPropagation();
          onClose();
}}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }}
        aria-label="Close actions"
      />

      <div ref={panelRef} role="dialog" aria-modal="true" tabIndex={-1} aria-labelledby="post-actions-title" className="relative w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl shadow-2xl p-6 animate-in slide-in-from-bottom-full duration-200 max-h-[85dvh] md:max-h-[80vh] overflow-y-auto overscroll-contain">
        <div className="flex items-center justify-between mb-5">
          <div className="min-w-0">
            <div id="post-actions-title" className="text-sm font-extrabold text-gray-900 truncate">
              Post options
            </div>
            <div className="text-xs text-gray-500 truncate">
              {post.author} {post.handle}
            </div>
          </div>
          <button
            type="button"
            ref={closeBtnRef}
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100"
            aria-label="Close"
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={doOpen}
            className="w-full p-4 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center gap-4 text-left"
          >
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-gray-800 shadow-sm">
              <MessageCircle size={18} />
            </div>
            <div>
              <div className="font-bold text-gray-900">Open thread</div>
              <div className="text-xs text-gray-500">View the full conversation</div>
            </div>
          </button>

          {/* sd_544c_echo_entry */}
          {isPublic && onEcho ? (
            <button
              type="button"
              onClick={doEcho}
              className="w-full p-4 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center gap-4 text-left"
            >
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-gray-800 shadow-sm">
                <Repeat size={18} />
              </div>
              <div>
                <div className="font-bold text-gray-900">Echo</div>
                <div className="text-xs text-gray-500">Echo or Quote Echo</div>
              </div>
            </button>
          ) : null}


          <button
            type="button"
            onClick={doViewProfile}
            className="w-full p-4 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center gap-4 text-left"
          >
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-gray-800 shadow-sm">
              <User size={18} />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-gray-900">View profile</div>
              <div className="text-xs text-gray-500 truncate">Open @{String((post as any)?.handle || "").replace(/^@/, "")}</div>
            </div>
          </button>
          <button
            type="button"
            onClick={doCopyLink}
            className="w-full p-4 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center gap-4 text-left"
          >
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-gray-800 shadow-sm">
              <Link2 size={18} />
            </div>
            <div>
              <div className="font-bold text-gray-900">{isPublic ? "Copy link" : "Copy link"}</div>
              <div className="text-xs text-gray-500">{isPublic ? "Share anywhere" : "Only people with access can open"}</div>
            </div>
          </button>

          <button
            type="button"
            onClick={doCopyText}
            className="w-full p-4 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center gap-4 text-left"
          >
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-gray-800 shadow-sm">
              <Copy size={18} />
            </div>
            <div>
              <div className="font-bold text-gray-900">Copy text</div>
              <div className="text-xs text-gray-500">Copy the post body</div>
            </div>
          </button>
          {isPublic ? (


          <button
            type="button"
            onClick={doShare}
            className="w-full p-4 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center gap-4 text-left"
          >
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-gray-800 shadow-sm">
              <Share2 size={18} />
            </div>
            <div>
              <div className="font-bold text-gray-900">Share</div>
              <div className="text-xs text-gray-500">Use your device share menu</div>
            </div>
          </button>
          ) : null}

          {canEdit && onEdit ? (
            <button
              type="button"
              onClick={doEdit}
              className="w-full p-4 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center gap-4 text-left"
            >
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-gray-800 shadow-sm">
                <Pencil size={18} />
              </div>
              <div>
                <div className="font-bold text-gray-900">Edit post</div>
                <div className="text-xs text-gray-500">Fix mistakes (time-limited on Public)</div>
              </div>
            </button>
          ) : null}

          {canDelete && onDelete ? (
            <button
              type="button"
              onClick={doDelete}
              className="w-full p-4 rounded-xl bg-rose-50 hover:bg-rose-100 flex items-center gap-4 text-left border border-rose-200"
            >
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-rose-700 shadow-sm border border-rose-200">
                <Trash2 size={18} />
              </div>
              <div>
                <div className="font-bold text-rose-700">Delete post</div>
                <div className="text-xs text-rose-700/80">Remove permanently</div>
              </div>
            </button>
          ) : null}

          <button
            type="button"
            onClick={doHide}
            className="w-full p-4 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center gap-4 text-left"
          >
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-gray-700 shadow-sm">
              <EyeOff size={18} />
            </div>
            <div>
              <div className="font-bold text-gray-900">Hide</div>
              <div className="text-xs text-gray-500">Remove from your view</div>
            </div>
          </button>

          <button
            type="button"
            onClick={doReport}
            className="w-full p-4 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center gap-4 text-left"
          >
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-gray-800 shadow-sm">
              <Flag size={18} />
            </div>
            <div>
              <div className="font-bold text-gray-900">Report post</div>
              <div className="text-xs text-gray-500">Flag abuse or spam</div>
            </div>
          </button>

          
          <button
            type="button"
            onClick={doMute}
            className="w-full p-4 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center gap-4 text-left"
          >
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-gray-800 shadow-sm">
              <VolumeX size={18} />
            </div>
            <div>
              <div className="font-bold text-gray-900">Mute user</div>
              <div className="text-xs text-gray-500">Hide their posts from your feed</div>
            </div>
          </button>

<button
            type="button"
            onClick={doBlock}
            className="w-full p-4 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center gap-4 text-left"
          >
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-gray-800 shadow-sm">
              <Ban size={18} />
            </div>
            <div>
              <div className="font-bold text-gray-900">Block user</div>
              <div className="text-xs text-gray-500">Hide each other</div>
            </div>
          </button>

        </div>
      </div>
    </div>
    , document.body
  );
}
