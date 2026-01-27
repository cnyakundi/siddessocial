"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "@/src/lib/toast";
import { signUpload, uploadToSignedUrl } from "@/src/lib/mediaClient";

export type MediaDraftItem = {
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

export function formatDurationMs(ms?: number): string {
  const n = typeof ms === "number" ? Math.floor(ms) : 0;
  if (!n || n <= 0) return "";
  const total = Math.max(0, Math.round(n / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function detectMediaKind(file: File): "image" | "video" | null {
  const t = String((file as any).type || "").toLowerCase();
  if (t.startsWith("image/")) return "image";
  if (t.startsWith("video/")) return "video";

  const name = String((file as any).name || "");
  const m = name.match(/\.([a-z0-9]{1,8})$/i);
  const ext = m ? m[1].toLowerCase() : "";
  if (!ext) return null;

  const IMG = new Set(["jpg", "jpeg", "png", "gif", "webp", "avif", "heic", "heif", "bmp", "tif", "tiff"]);
  const VID = new Set(["mp4", "mov", "m4v", "webm", "ogg", "ogv", "avi", "mkv", "3gp"]);
  if (IMG.has(ext)) return "image";
  if (VID.has(ext)) return "video";
  return null;
}

export function useComposeMedia() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [mediaItems, setMediaItems] = useState<MediaDraftItem[]>([]);

  const mediaBusy = mediaItems.some((m) => m.status === "uploading");

  const mediaKeys = useMemo(
    () =>
      mediaItems
        .map((m) => (m.status === "ready" ? m.r2Key : null))
        .filter((x): x is string => Boolean(x)),
    [mediaItems]
  );

  // Carry width/height/duration to backend so feed can render premium media.
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

  const clearMedia = useCallback(() => {
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
  }, []);

  const removeMedia = useCallback((id: string) => {
    setMediaItems((cur) => {
      const next = cur.filter((m) => m.id !== id);
      const removed = cur.find((m) => m.id === id);
      if (removed?.previewUrl) {
        try {
          URL.revokeObjectURL(removed.previewUrl);
        } catch {
          // ignore
        }
      }
      return next;
    });
  }, []);

  const pickMedia = useCallback(() => {
    const el = fileInputRef.current;
    if (!el) return;
    try {
      el.click();
    } catch {
      // ignore
    }
  }, []);

  const addMediaFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files as any).filter(
        (f: any): f is File => !!f && typeof f === "object" && (typeof (f as any).type === "string" || typeof (f as any).name === "string")
      );

      const picked: Array<{ file: File; kind: "image" | "video" }> = [];
      for (const f of list) {
        const kind = detectMediaKind(f);
        if (kind === "image" || kind === "video") picked.push({ file: f, kind });
      }

      if (picked.length === 0) {
        toast.error("Pick a photo or video file.");
        return;
      }

      const onlineNow = typeof navigator !== "undefined" ? navigator.onLine : true;
      if (!onlineNow) {
        toast.error("Go online to upload media.");
        return;
      }

      const remaining = Math.max(0, 4 - mediaItems.length);
      if (remaining <= 0) {
        toast.error("Max 4 media items.");
        return;
      }

      const batch = picked.slice(0, remaining);

      for (const item of batch) {
        const file = item.file;
        const kind = item.kind;
        const id = `m_${Date.now()}_${Math.random().toString(16).slice(2)}`;
        const previewUrl = URL.createObjectURL(file);
        const name = String((file as any).name || (kind === "video" ? "video" : "photo"));

        setMediaItems((cur) => [...cur, { id, name, kind, previewUrl, status: "uploading" }]);

        // Best-effort meta sniff.
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
                  cur.map((m) => (m.id === id ? { ...m, width: meta.w, height: meta.h, durationMs } : m))
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
    },
    [mediaItems.length]
  );

  return {
    fileInputRef,
    mediaItems,
    mediaBusy,
    mediaKeys,
    mediaMeta,
    pickMedia,
    addMediaFiles,
    removeMedia,
    clearMedia,
  };
}
