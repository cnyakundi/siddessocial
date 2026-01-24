"use client";

/**
 * Minimal toast bus.
 * - Safe no-op if nothing is listening.
 * - Allows components to emit lightweight toasts without pulling in deps.
 */

export type ToastKind = "info" | "success" | "warning" | "error";

export type ToastEvent = {
  id: string;
  kind: ToastKind;
  message: string;
  createdAt: number;
};

const listeners = new Set<(t: ToastEvent) => void>();

function makeId() {
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function emit(kind: ToastKind, message: string) {
  const evt: ToastEvent = { id: makeId(), kind, message, createdAt: Date.now() };

  for (const fn of Array.from(listeners)) {
    try {
      fn(evt);
    } catch {}
  }

  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(new CustomEvent("sd:toast", { detail: evt }));
    } catch {}
  }
}

export const toast = {
  info(message: string) {
    emit("info", message);
  },
  success(message: string) {
    emit("success", message);
  },
  warning(message: string) {
    emit("warning", message);
  },
  error(message: string) {
    emit("error", message);
  },
};

export function subscribeToasts(fn: (t: ToastEvent) => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
