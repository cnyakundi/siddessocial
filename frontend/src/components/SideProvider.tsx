"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  ACTIVE_SIDE_STORAGE_KEY,
  getStoredActiveSide,
  setStoredActiveSide,
  setStoredLastNonPublicSide,
} from "@/src/lib/sideStore";
import type { SideId } from "@/src/lib/sides";
import { nextSide } from "@/src/lib/sides";
import { PublicEnterConfirmSheet } from "@/src/components/PublicEnterConfirmSheet";

type SideSwitchOptions = {
  afterConfirm?: () => void;
  afterCancel?: () => void;
};

type SideLock = { enabled: boolean; side: SideId | null; reason: string | null };

type SideContextValue = {
  side: SideId;
  /**
   * Side-safe switching gateway.
   * - entering Public requires explicit confirm (unless already in Public)
   * - callers may pass afterConfirm/afterCancel hooks
   */
  setSide: (side: SideId, opts?: SideSwitchOptions) => void;
  cycleSide: (dir?: 1 | -1) => void;
  /** Route-level side lock (threads/sets). */
  sideLock: SideLock;
  setSideLock: (lock: { side: SideId; reason?: string }) => void;
  clearSideLock: () => void;
};

const SideContext = createContext<SideContextValue | null>(null);

// sd_714_public_enter_confirm_once: reduce repeated Public-entry friction (confirm once per session).
const PUBLIC_ENTER_CONFIRM_MARK = "__sd_public_enter_confirm_v1";

export function SideProvider({ children }: { children: React.ReactNode }) {
  const [side, setSideState] = useState<SideId>("friends");
  const [sideLock, setSideLockState] = useState<SideLock>({ enabled: false, side: null, reason: null });

  // Public entry confirm (centralized)
  const [confirmPublic, setConfirmPublic] = useState(false);
  const [publicFromSide, setPublicFromSide] = useState<SideId>("friends");
  const [pendingAfterConfirm, setPendingAfterConfirm] = useState<null | (() => void)>(null);
  const [pendingAfterCancel, setPendingAfterCancel] = useState<null | (() => void)>(null);

  useEffect(() => {
    const stored = getStoredActiveSide();
    if (stored) {
      setSideState(stored);
      if (stored !== "public") setStoredLastNonPublicSide(stored);
    }
  }, []);

  const setSideImmediate = (s: SideId) => {
    setSideState(s);
    setStoredActiveSide(s);
    if (s !== "public") setStoredLastNonPublicSide(s);
  };

  // sd_782_fix_post_detail_freeze_side_lock: avoid infinite render loops on pages that set a route-level side lock
  // (e.g., /siddes-post/[id], /siddes-sets/[id]).
  // We make setters stable (useCallback) && no-op when the lock is unchanged.
  const setSideLock = useCallback((lock: { side: SideId; reason?: string }) => {
    const next: SideLock = { enabled: true, side: lock.side, reason: lock.reason || null };
    setSideLockState((prev) =>
      prev.enabled == next.enabled && prev.side == next.side && prev.reason == next.reason
      ? prev
      : next
    );
  }, []);

  const clearSideLock = useCallback(() => {
    setSideLockState((prev) => (prev.enabled ? { enabled: false, side: null, reason: null } : prev));
  }, []);

  const setSide = (next: SideId, opts?: SideSwitchOptions) => {
    const afterConfirm = opts?.afterConfirm;
    const afterCancel = opts?.afterCancel;

    // Route lock: block switching away from locked side.
    if (sideLock.enabled && sideLock.side && next !== sideLock.side) {
      if (afterCancel) afterCancel();
      return;
    }

    // Threshold moment: entering Public must be deliberate.
    if (next === "public" && side !== "public") {
      // sd_714_public_enter_confirm_once: confirm only once per session to reduce dangerous friction.
      try {
        const marked = window.sessionStorage.getItem(PUBLIC_ENTER_CONFIRM_MARK);
        if (marked === "1") {
          setSideImmediate(next);
          if (afterConfirm) afterConfirm();
          return;
        }
      } catch {}
      setPublicFromSide(side);
      setPendingAfterConfirm(() => afterConfirm || null);
      setPendingAfterCancel(() => afterCancel || null);
      setConfirmPublic(true);
      return;
    }

    setSideImmediate(next);
    if (afterConfirm) afterConfirm();
  };

  const cycleSide = (dir: 1 | -1 = 1) => {
    setSide(nextSide(side, dir));
  };

  const confirmEnterPublic = () => {
    setConfirmPublic(false);
    setSideImmediate("public");
    try {
      window.sessionStorage.setItem(PUBLIC_ENTER_CONFIRM_MARK, "1");
    } catch {}
    const fn = pendingAfterConfirm;
    setPendingAfterConfirm(null);
    setPendingAfterCancel(null);
    if (fn) fn();
  };

  const cancelEnterPublic = () => {
    setConfirmPublic(false);
    const fn = pendingAfterCancel;
    setPendingAfterConfirm(null);
    setPendingAfterCancel(null);
    if (fn) fn();
  };

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== ACTIVE_SIDE_STORAGE_KEY) return;
      if (!e.newValue) return;
      const v = e.newValue as SideId;
      if (v === "public" || v === "friends" || v === "close" || v === "work") {
        setSideState(v);
        if (v !== "public") setStoredLastNonPublicSide(v);
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value: SideContextValue = { side, setSide, cycleSide, sideLock, setSideLock, clearSideLock };

  return (
    <SideContext.Provider value={value}>
      {children}

      <PublicEnterConfirmSheet
        open={confirmPublic}
        fromSide={publicFromSide}
        onCancel={cancelEnterPublic}
        onConfirm={confirmEnterPublic}
      />
    </SideContext.Provider>
  );
}

export function useSide(): SideContextValue {
  const ctx = useContext(SideContext);
  if (!ctx) throw new Error("useSide must be used within SideProvider");
  return ctx;
}
