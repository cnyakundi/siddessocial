"use client";

import type { RefObject } from "react";
import { useEffect, useRef } from "react";

type Args = {
  open: boolean;
  containerRef: RefObject<HTMLElement | null>;
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Optional: if provided, Escape will call this. */
  onClose?: () => void;
};

function getFocusable(container: HTMLElement): HTMLElement[] {
  const nodes = Array.from(
    container.querySelectorAll<HTMLElement>(
      [
        'a[href]',
        'button:not([disabled])',
        'textarea:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
      ].join(",")
    )
  );

  // Filter out elements that are visually hidden or not actually focusable.
  return nodes.filter((el) => {
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    if (el.hasAttribute("disabled")) return false;
    return true;
  });
}

/**
 * useDialogA11y
 * - Captures prior focus when a dialog opens
 * - Moves focus into the dialog (initialFocusRef or first focusable)
 * - Traps Tab/Shift+Tab within the dialog while open
 * - Restores focus on close/unmount
 * - Optionally closes on Escape (if onClose provided)
 */
export function useDialogA11y({ open, containerRef, initialFocusRef, onClose }: Args) {
  const prevFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    if (typeof document === "undefined") return;

    prevFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const container = containerRef.current;
    if (!container) return;

    const focusInitial = () => {
      const initial = initialFocusRef?.current;
      const fallback = getFocusable(container)[0];
      const target = (initial || fallback || container) as HTMLElement;
      try {
        target.focus();
      } catch {}
    };

    const t = window.setTimeout(focusInitial, 0);

    const onKeyDown = (e: KeyboardEvent) => {
      if (!open) return;

      if (e.key === "Escape" && onClose) {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key !== "Tab") return;

      const focusables = getFocusable(container);
      if (!focusables.length) {
        e.preventDefault();
        try {
          container.focus();
        } catch {}
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (!active || active === first || active === container) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKeyDown);

      // Fallback focus restore on unmount/route-change
      const prev = prevFocusRef.current;
      if (prev && typeof document !== "undefined" && document.contains(prev)) {
        try {
          prev.focus();
        } catch {}
      }
    };
  }, [open, containerRef, initialFocusRef, onClose]);

  useEffect(() => {
    if (open) return;
    if (typeof document === "undefined") return;
    const prev = prevFocusRef.current;
    if (prev && document.contains(prev)) {
      try {
        prev.focus();
      } catch {}
    }
  }, [open]);
}
