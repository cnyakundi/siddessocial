"use client";

import { FLAGS } from "@/src/lib/flags";

type PrefetchOpts = {
  decode?: boolean;
};

type Task = { url: string; decode: boolean };

const seen: Set<string> = (globalThis as any).__SD_MEDIA_PREFETCH_SEEN__ || new Set();
(globalThis as any).__SD_MEDIA_PREFETCH_SEEN__ = seen;

let active = 0;
const MAX_ACTIVE = 2;
const queue: Task[] = [];

function isFastScroll(): boolean {
  try {
    return Boolean((globalThis as any).__SD_FAST_SCROLL__);
  } catch {
    return false;
  }
}

function scheduleIdle(fn: () => void) {
  try {
    const ric = (window as any).requestIdleCallback as ((cb: () => void, opts?: any) => number) | undefined;
    if (typeof ric === "function") {
      ric(fn, { timeout: 1200 });
      return;
    }
  } catch {}
  try { window.setTimeout(fn, 180); } catch {}
}

function canPrefetch(): boolean {
  try {
    if (!FLAGS || (FLAGS as any).mediaPrefetch === false) return false;
    if (typeof window === "undefined") return false;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return false;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return false;

    const nav: any = navigator as any;
    const conn = nav?.connection || nav?.mozConnection || nav?.webkitConnection;
    if (conn?.saveData) return false;

    const et = String(conn?.effectiveType || "").toLowerCase();
    if (et.includes("2g") || et.includes("slow-2g")) return false;

    return true;
  } catch {
    return false;
  }
}

function normalize(url: string): string {
  const u = String(url || "").trim();
  if (!u) return "";
  // Avoid giant tokens in key; but keep enough to dedupe.
  // (Public tokens are stable; private tokens are short-lived but still useful for immediate reuse.)
  return u.length > 2000 ? u.slice(0, 2000) : u;
}

function pushTask(t: Task) {
  if (!t.url) return;
  if (seen.has(t.url)) return;
  seen.add(t.url);
  queue.push(t);
  pump();
}

function pump() {
  if (!canPrefetch()) {
    queue.length = 0;
    return;
  }
  while (active < MAX_ACTIVE && queue.length) {
    const t = queue.shift()!;
    active++;
    run(t)
      .catch(() => {})
      .finally(() => {
        active = Math.max(0, active - 1);
        // Keep pumping until drained.
        if (queue.length) pump();
      });
  }
}

async function run(t: Task): Promise<void> {
  const url = t.url;
  if (!url) return;

  await new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };

    try {
      const img = new Image();
      try { (img as any).decoding = "async"; } catch {}
      try { (img as any).fetchPriority = "low"; } catch {}

      const timer = window.setTimeout(() => finish(), 8000);

      img.onload = () => {
        const done = () => {
          try { window.clearTimeout(timer); } catch {}
          finish();
        };

        // Decode can be expensive. If user is flinging fast, defer decode to idle time.
        try {
          if (t.decode && typeof (img as any).decode === "function") {
            if (isFastScroll()) {
              scheduleIdle(() => {
                try { (img as any).decode?.().catch(() => {}); } catch {}
              });
              done();
              return;
            }
            (img as any).decode().catch(() => {}).finally(done);
            return;
          }
        } catch {}

        done();
      };

      img.onerror = () => {
        try { window.clearTimeout(timer); } catch {}
        finish();
      };

      img.src = url;
    } catch {
      finish();
    }
  });
}

export function prefetchImages(urls: string[], opts: PrefetchOpts = {}): number {
  if (!canPrefetch()) return 0;

  const decode = opts.decode !== false;
  const arr = Array.isArray(urls) ? urls : [];
  const clean: string[] = [];
  let queued = 0;

  for (const raw of arr) {
    const u = normalize(raw);
    if (!u) continue;
    clean.push(u);
    if (clean.length >= 4) break; // hard cap per call
  }

  for (const u of clean) {
    pushTask({ url: u, decode });
    queued++;
  }

  return queued;
}
