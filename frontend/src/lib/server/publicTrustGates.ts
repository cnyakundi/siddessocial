import type { TrustLevel } from "@/src/lib/trustLevels";

export type TrustGateResult =
  | { ok: true }
  | {
      ok: false;
      status: 401 | 403 | 429;
      error: "restricted" | "trust_required" | "link_requires_trust" | "rate_limited";
      retryAfterMs?: number;
      minTrust?: number;
    };

export function publicTrustGatesEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SD_PUBLIC_TRUST_GATES === "1";
}

export function textHasLink(text: string): boolean {
  const t = (text || "").toLowerCase();
  return /https?:\/\//.test(t) || /\bwww\./.test(t);
}

export function minIntervalMsForTrust(lvl: TrustLevel): number {
  // Simple, explainable defaults.
  // - 0: cannot post
  // - 1: slow lane
  // - 2: normal
  // - 3: effectively unlimited (dev)
  switch (lvl) {
    case 0:
      return 60_000; // shouldn't matter (blocked anyway)
    case 1:
      return 60_000;
    case 2:
      return 15_000;
    case 3:
    default:
      return 0;
  }
}

type RLMap = Map<string, number>; // key -> lastActionMs
const lastAction: RLMap = (globalThis as any).__SD_PUBLIC_TRUST_RL__ || new Map();
(globalThis as any).__SD_PUBLIC_TRUST_RL__ = lastAction;

export function checkMinInterval(key: string, minIntervalMs: number, nowMs: number = Date.now()): TrustGateResult {
  if (minIntervalMs <= 0) return { ok: true };
  const last = lastAction.get(key) || 0;
  const delta = nowMs - last;
  if (delta >= minIntervalMs) {
    lastAction.set(key, nowMs);
    return { ok: true };
  }
  return { ok: false, status: 429, error: "rate_limited", retryAfterMs: Math.max(250, minIntervalMs - delta) };
}

/**
 * enforcePublicWriteGates
 * Applies a minimal "trust under the hood" policy for Public writes.
 */
export function enforcePublicWriteGates(args: {
  viewerId: string | null;
  trustLevel: TrustLevel;
  text: string;
  kind: "post" | "reply";
}): TrustGateResult {
  // If stubs are misused without viewer identity, stay default-safe.
  if (!args.viewerId) {
    return { ok: false, status: 401, error: "restricted" };
  }

  // Basic requirement: must have at least "New" trust to write in Public.
  if (args.trustLevel < 1) {
    return { ok: false, status: 403, error: "trust_required", minTrust: 1 };
  }

  // Links require a bit more trust.
  if (textHasLink(args.text) && args.trustLevel < 2) {
    return { ok: false, status: 403, error: "link_requires_trust", minTrust: 2 };
  }

  const minInterval = minIntervalMsForTrust(args.trustLevel);
  const rlKey = `public_${args.kind}:${args.viewerId}`;
  const rl = checkMinInterval(rlKey, minInterval);
  if (!rl.ok) return rl;

  return { ok: true };
}
