"use client";

import type { SideId } from "@/src/lib/sides";
import type { CircleDef } from "@/src/lib/circles";

export type SuggestionKind = "side" | "set" | "urgent";

export type SideSuggestion = {
  kind: "side";
  side: SideId;
  confidence: number;
  reason: string;
};

export type SetSuggestion = {
  kind: "set";
  setId: string;
  label: string;
  confidence: number;
  reason: string;
};

export type UrgentSuggestion = {
  kind: "urgent";
  confidence: number;
  reason: string;
};

export type ComposeSuggestion = SideSuggestion | SetSuggestion | UrgentSuggestion;

function norm(s: string): string {
  return (s || "").toLowerCase().trim();
}

function countHits(hay: string, needles: string[]): number {
  let c = 0;
  for (const n of needles) {
    if (!n) continue;
    if (hay.includes(n)) c += 1;
  }
  return c;
}

function scoreSide(text: string): { side: SideId; hits: number; reason: string } | null {
  const t = norm(text);

  // Keep this conservative: only suggest when signals are strong.
  const work = ["standup", "roadmap", "jira", "ticket", "deploy", "merge", "pr", "review", "deadline", "meeting", "slides"];
  const close = ["love you", "miss you", "mom", "dad", "family", "baby", "sweetie"];
  const friends = ["bbq", "gym", "workout", "weekend", "hangout", "party", "brunch"];

  const w = countHits(t, work);
  const c = countHits(t, close);
  const f = countHits(t, friends);

  const max = Math.max(w, c, f);
  if (max <= 0) return null;

  if (w === max) return { side: "work", hits: w, reason: "Work cues" };
  if (c === max) return { side: "close", hits: c, reason: "Close cues" };
  return { side: "friends", hits: f, reason: "Friends cues" };
}

function scoreUrgent(text: string): { confidence: number; reason: string } | null {
  const t = norm(text);
  const urgent = ["urgent", "asap", "now", "important", "today", "tonight"];
  const hits = countHits(t, urgent);
  if (hits <= 0) return null;
  const confidence = Math.min(0.95, 0.55 + hits * 0.12);
  return { confidence, reason: "Urgency cues" };
}

function scoreSet(text: string, sets: CircleDef[]): { setId: string; label: string; confidence: number; reason: string } | null {
  const t = norm(text);
  if (!t) return null;

  // Try keyword match against set labels (token match, >=3 chars).
  let best: { s: CircleDef; score: number } | null = null;
  for (const s of sets || []) {
    const label = norm(String((s as any)?.label || ""));
    if (!label) continue;
    const tokens = label.split(/\s+/).filter(Boolean).filter((x) => x.length >= 3);
    let score = 0;
    for (const tok of tokens) {
      if (t.includes(tok)) score += 1;
    }
    if (score > 0 && (!best || score > best.score)) best = { s, score };
  }

  if (!best) return null;

  const confidence = Math.min(0.9, 0.6 + best.score * 0.08);
  return { setId: best.s.id, label: best.s.label, confidence, reason: "Set label match" };
}

export function computeComposeSuggestions(args: {
  text: string;
  currentSide: SideId;
  sets: CircleDef[];
  selectedCircleId?: string | null;
  urgent?: boolean;
}): ComposeSuggestion[] {
  const { text, currentSide, sets, selectedCircleId, urgent } = args;
  const t = String(text || "").trim();
  if (!t) return [];

  const out: ComposeSuggestion[] = [];

  const sideScore = scoreSide(t);
  if (sideScore) {
    const confidence = Math.min(0.95, 0.55 + sideScore.hits * 0.12);

    // Confidence gating (must be present for checks + sanity)
    if (confidence >= 0.72 && sideScore.side !== currentSide) {
      out.push({ kind: "side", side: sideScore.side, confidence, reason: sideScore.reason });
    }
  }

  // Only suggest Sets on non-Public sides (Public is global).
  const effSide: SideId = (sideScore?.side ?? currentSide) as SideId;
  if (effSide !== "public") {
    const setScore = scoreSet(t, sets || []);
    if (setScore && setScore.confidence >= 0.70 && setScore.setId !== selectedCircleId) {
      out.push({
        kind: "set",
        setId: setScore.setId,
        label: setScore.label,
        confidence: setScore.confidence,
        reason: setScore.reason,
      });
    }
  }

  const urg = scoreUrgent(t);
  if (urg && urg.confidence >= 0.75 && !urgent) {
    out.push({ kind: "urgent", confidence: urg.confidence, reason: urg.reason });
  }

  return out;
}
