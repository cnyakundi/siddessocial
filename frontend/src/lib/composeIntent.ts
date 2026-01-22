"use client";

import type { SideId } from "@/src/lib/sides";
import type { SetDef } from "@/src/lib/sets";

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
    if (hay.includes(n)) c += 1;
  }
  return c;
}

function scoreSide(text: string) {
  const t = norm(text);
  const work = ["standup", "roadmap", "pr", "merge", "deploy", "jira", "sprint", "meeting", "deck", "slides", "review", "deadline", "handoff", "ticket"];
  const close = ["love you", "miss you", "mom", "dad", "family", "sweetie", "call me"];
  const friends = ["bbq", "gym", "leg day", "workout", "weekend", "hangout", "party", "brisket", "brunch"];

  const w = countHits(t, work);
  const c = countHits(t, close);
  const f = countHits(t, friends);

  const max = Math.max(w, c, f);
  if (max === 0) return null;

  if (w === max) return { side: "work" as SideId, hits: w, reason: "Mentions work" };
  if (c === max) return { side: "close" as SideId, hits: c, reason: "Mentions close people" };
  return { side: "friends" as SideId, hits: f, reason: "Mentions friends" };
}

function scoreUrgent(text: string) {
  const t = norm(text);
  const urgent = ["urgent", "asap", "immediately", "today", "now", "pls", "please"];
  const hits = countHits(t, urgent);
  if (!hits) return null;
  const confidence = Math.min(0.9, 0.6 + hits * 0.1);
  return { confidence, reason: "Mentions urgency" };
}

function scoreSet(text: string, sets: SetDef[]) {
  const t = norm(text);
  if (!t || !sets.length) return null;

  const gymCue = countHits(t, ["gym", "workout", "leg day", "protein", "lift"]);
  const weekendCue = countHits(t, ["weekend", "bbq", "brunch", "party", "sat", "saturday"]);

  if (gymCue) {
    const s = sets.find((x) => x.id === "gym" || x.label.toLowerCase().includes("gym"));
    if (s) return { setId: s.id, label: s.label, confidence: Math.min(0.95, 0.7 + gymCue * 0.1), reason: "Mentions gym" };
  }
  if (weekendCue) {
    const s = sets.find((x) => x.id === "weekend" || x.label.toLowerCase().includes("weekend"));
    if (s) return { setId: s.id, label: s.label, confidence: Math.min(0.9, 0.65 + weekendCue * 0.1), reason: "Mentions weekend" };
  }

  // label token match
  let best: { s: SetDef; score: number } | null = null;
  for (const s of sets) {
    const tokens = s.label.split(/\s+/).map((x) => x.toLowerCase()).filter(Boolean);
    let score = 0;
    for (const tok of tokens) {
      if (tok.length < 3) continue;
      if (t.includes(tok)) score += 1;
    }
    if (score > 0 && (!best || score > best.score)) best = { s, score };
  }
  if (best) {
    const confidence = Math.min(0.8, 0.6 + best.score * 0.08);
    return { setId: best.s.id, label: best.s.label, confidence, reason: "Mentions a Set" };
  }

  return null;
}

export function computeComposeSuggestions(args: {
  text: string;
  currentSide: SideId;
  sets: SetDef[];
  selectedSetId?: string | null;
  urgent?: boolean;
}): ComposeSuggestion[] {
  const { text, currentSide, sets, selectedSetId, urgent } = args;
  const t = text.trim();
  if (!t) return [];

  const out: ComposeSuggestion[] = [];

  const sideScore = scoreSide(t);
  if (sideScore) {
    const confidence = Math.min(0.95, 0.55 + sideScore.hits * 0.12);
    if (confidence >= 0.72 && sideScore.side !== currentSide) {
      out.push({ kind: "side", side: sideScore.side, confidence, reason: sideScore.reason });
    }
  }

  const effectiveSide = (sideScore?.side ?? currentSide) as SideId;
  if (effectiveSide === "friends") {
    const setScore = scoreSet(t, sets);
    if (setScore && setScore.confidence >= 0.7 && setScore.setId !== selectedSetId) {
      out.push({ kind: "set", setId: setScore.setId, label: setScore.label, confidence: setScore.confidence, reason: setScore.reason });
    }
  }

  const urg = scoreUrgent(t);
  if (urg && urg.confidence >= 0.75 && !urgent) {
    out.push({ kind: "urgent", confidence: urg.confidence, reason: urg.reason });
  }

  return out;
}
