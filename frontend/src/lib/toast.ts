"use client";

export type ToastVariant = "info" | "success" | "error";

export type ToastItem = {
  id: string;
  message: string;
  variant: ToastVariant;
  createdAt: number;
  durationMs: number;
  actionLabel?: string;
  onAction?: (() => void) | null;
};

type ToastOptions = {
  variant?: ToastVariant;
  durationMs?: number;
  actionLabel?: string;
  onAction?: (() => void) | null;
};

const EVT = "sd.toast.v1";

function hasWindow(): boolean {
  return typeof window !== "undefined" && typeof window.dispatchEvent === "function";
}

function makeId(): string {
  return `toast_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function emit(item: ToastItem) {
  if (!hasWindow()) return;
  try {
    window.dispatchEvent(new CustomEvent(EVT, { detail: item }));
  } catch {
    // ignore
  }
}

type ToastFn = ((message: string, opts?: ToastOptions) => void) & {
  info: (message: string, opts?: Omit<ToastOptions, "variant">) => void;
  success: (message: string, opts?: Omit<ToastOptions, "variant">) => void;
  error: (message: string, opts?: Omit<ToastOptions, "variant">) => void;
  undo: (message: string, onUndo: () => void) => void;
  eventName: () => string;
};

export const toast = ((message: string, opts?: ToastOptions) => {
  if (!message) return;
  const item: ToastItem = {
    id: makeId(),
    message,
    variant: opts?.variant ?? "info",
    createdAt: Date.now(),
    durationMs: opts?.durationMs ?? 4200,
    actionLabel: opts?.actionLabel,
    onAction: opts?.onAction ?? null,
  };
  emit(item);
}) as ToastFn;

toast.info = (message, opts) => toast(message, { ...opts, variant: "info" });
toast.success = (message, opts) => toast(message, { ...opts, variant: "success" });
toast.error = (message, opts) => toast(message, { ...opts, variant: "error" });

toast.undo = (message, onUndo) =>
  toast(message, {
    variant: "info",
    durationMs: 8000,
    actionLabel: "Undo",
    onAction: onUndo,
  });

toast.eventName = () => EVT;
