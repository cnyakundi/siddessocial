"use client";

// Local suggestion ledger (per-browser). Keeps Siddes from nagging users.
// Stores ONLY suggestion ids + timestamps. No contact identifiers.

type Ledger = {
  accepted: Record<string, number>;
  dismissed: Record<string, number>;
};

const KEY_PREFIX = "siddes.local_suggestions.v1";

function key(viewerKey: string): string {
  const v = String(viewerKey || "anon").trim() || "anon";
  return `${KEY_PREFIX}:${v}`;
}

function safeParse(raw: string | null): Ledger {
  if (!raw) return { accepted: {}, dismissed: {} };
  try {
    const j = JSON.parse(raw);
    const accepted = j && typeof j.accepted === "object" ? j.accepted : {};
    const dismissed = j && typeof j.dismissed === "object" ? j.dismissed : {};
    return {
      accepted: accepted && typeof accepted === "object" ? accepted : {},
      dismissed: dismissed && typeof dismissed === "object" ? dismissed : {},
    };
  } catch {
    return { accepted: {}, dismissed: {} };
  }
}

function load(viewerKey: string): Ledger {
  if (typeof window === "undefined") return { accepted: {}, dismissed: {} };
  try {
    return safeParse(window.localStorage.getItem(key(viewerKey)));
  } catch {
    return { accepted: {}, dismissed: {} };
  }
}

function save(viewerKey: string, ledger: Ledger) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key(viewerKey), JSON.stringify(ledger));
  } catch {
    // ignore (private mode / quota)
  }
}

export function isSuggestionSuppressed(viewerKey: string, suggestionId: string): boolean {
  const id = String(suggestionId || "").trim();
  if (!id) return false;
  const led = load(viewerKey);
  return !!led.accepted[id] || !!led.dismissed[id];
}

export function markSuggestionAccepted(viewerKey: string, suggestionId: string) {
  const id = String(suggestionId || "").trim();
  if (!id) return;
  const led = load(viewerKey);
  led.accepted[id] = Date.now();
  delete led.dismissed[id];
  save(viewerKey, led);
}

export function markSuggestionDismissed(viewerKey: string, suggestionId: string) {
  const id = String(suggestionId || "").trim();
  if (!id) return;
  const led = load(viewerKey);
  led.dismissed[id] = Date.now();
  save(viewerKey, led);
}


export function clearSuggestionDecision(viewerKey: string, suggestionId: string) {
  const id = String(suggestionId || "").trim();
  if (!id) return;
  const led = load(viewerKey);
  delete led.accepted[id];
  delete led.dismissed[id];
  save(viewerKey, led);
}
