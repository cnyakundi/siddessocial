"use client";

import type { SideId } from "@/src/lib/sides";

const KEY = "sd.inbox.move.recents.v0";
const MAX = 4;

function hasWindow(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function isSideId(x: any): x is SideId {
  return x === "public" || x === "friends" || x === "close" || x === "work";
}

export function loadRecentMoveSides(): SideId[] {
  if (!hasWindow()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSideId).slice(0, MAX);
  } catch {
    return [];
  }
}

function saveRecentMoveSides(arr: SideId[]) {
  if (!hasWindow()) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(arr.slice(0, MAX)));
  } catch {}
}

export function pushRecentMoveSide(side: SideId): SideId[] {
  const existing = loadRecentMoveSides();
  const next = [side, ...existing.filter((s) => s !== side)].slice(0, MAX);
  saveRecentMoveSides(next);
  return next;
}

export function clearRecentMoveSides() {
  if (!hasWindow()) return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {}
}
