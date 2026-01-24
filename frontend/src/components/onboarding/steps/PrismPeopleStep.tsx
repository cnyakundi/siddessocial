"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BrainCircuit, CheckSquare, Users, Sparkles } from "lucide-react";

import type { SideId } from "@/src/lib/sides";
import { SIDE_THEMES, SIDES } from "@/src/lib/sides";

import { PrimaryButton, Toast } from "@/src/components/onboarding/ui";

import { suggestSetsFromMatches, type ContactMatch } from "@/src/lib/localIntelligence/onDeviceContextEngine";
import type { SuggestedSet } from "@/src/lib/setSuggestions";
import { saveSuggestedSetsCache } from "@/src/lib/localIntelligence/localSuggestedSetsCache";

type ContactHint = { kind?: string; domain?: string; workish?: boolean };
type ContactsSuggestionItem = { id: string; name: string; handle: string; matched?: boolean; hint?: ContactHint };
type ContactsSuggestionsResp = { ok: boolean; items?: ContactsSuggestionItem[] };

type MatchRow = { user_id?: string; handle: string; display_name: string; hint?: ContactHint };
type ContactsMatchResp = { ok: boolean; matches?: MatchRow[] };

type MeResp = { ok: boolean; authenticated?: boolean; user?: { id: number }; viewerId?: string };

function computeViewerKey(me: MeResp | null): string {
  const v = me?.viewerId ? String(me.viewerId).trim() : "";
  if (v) return v;
  const uid = me?.user?.id;
  return uid ? `me_${uid}` : "anon";
}

function parseIdentifiers(raw: string): string[] {
  const s = String(raw || "").trim();
  if (!s) return [];
  const parts = s
    .split(/[\n,; \t]+/g)
    .map((x) => String(x || "").trim())
    .filter(Boolean);

  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of parts) {
    const v = p.toLowerCase();
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(p);
    if (out.length >= 120) break;
  }
  return out;
}

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

function sidePriority(side: SideId): number {
  // more intimate wins if collisions happen
  if (side === "close") return 0;
  if (side === "work") return 1;
  if (side === "friends") return 2;
  return 9;
}

function isHighConfidence(s: SuggestedSet): boolean {
  const id = String((s as any)?.id || "");
  return id.startsWith("local_work_") || id.startsWith("local_family_");
}

export default function PrismPeopleStep({
  onContinue,
  onSkip,
}: {
  onContinue: (payload: { contactSyncDone: boolean }) => void;
  onSkip: () => void;
}) {
  const [me, setMe] = useState<MeResp | null>(null);
  const viewerKey = useMemo(() => computeViewerKey(me), [me]);

  const [paste, setPaste] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [toastMsg, setToastMsg] = useState("");
  const [toastOn, setToastOn] = useState(false);

  const [contactSuggestions, setContactSuggestions] = useState<ContactsSuggestionItem[]>([]);
  const [matchRows, setMatchRows] = useState<MatchRow[]>([]);
  const [contactSyncDone, setContactSyncDone] = useState(false);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [fillFriends, setFillFriends] = useState(false);
  const [createSets, setCreateSets] = useState(false);

  const [sensitiveConfirmOpen, setSensitiveConfirmOpen] = useState(false); // sd_532_sensitive_confirm
  const [sensitiveCounts, setSensitiveCounts] = useState<{ close: number; work: number; total: number }>({ close: 0, work: 0, total: 0 }); // sd_532_sensitive_confirm


  function toast(m: string) {
    setToastMsg(m);
    setToastOn(true);
    window.setTimeout(() => setToastOn(false), 2000);
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/auth/me", { cache: "no-store" });
        const d = (await r.json().catch(() => ({}))) as MeResp;
        if (alive) setMe(d && typeof d === "object" ? d : null);
      } catch {
        if (alive) setMe(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function loadSuggestions() {
    try {
      const r = await fetch("/api/contacts/suggestions", { cache: "no-store" });
      const d = (await r.json().catch(() => ({}))) as ContactsSuggestionsResp;
      const items = Array.isArray(d?.items) ? d.items : [];
      setContactSuggestions(items);
      if (items.length) setContactSyncDone(true);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    loadSuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const matches: ContactMatch[] = useMemo(() => {
    if (contactSuggestions.length) {
      return contactSuggestions.map((x) => ({
        handle: x.handle,
        display_name: x.name,
        hint: x.hint,
      }));
    }
    if (matchRows.length) {
      return matchRows.map((x) => ({
        handle: x.handle,
        display_name: x.display_name,
        hint: x.hint,
      }));
    }
    return [];
  }, [contactSuggestions, matchRows]);

  const suggestedSets = useMemo(() => suggestSetsFromMatches(matches), [matches]);

  useEffect(() => {
    if (!viewerKey || viewerKey === "anon") return;
    if (!suggestedSets.length) return;
    saveSuggestedSetsCache(viewerKey, suggestedSets);
  }, [viewerKey, suggestedSets]);

  useEffect(() => {
    if (selectedIds.length) return;
    if (!suggestedSets.length) return;
    const defaults = suggestedSets.filter(isHighConfidence).map((s) => String((s as any)?.id || "")).filter(Boolean);
    setSelectedIds(defaults);
  }, [suggestedSets, selectedIds.length]);

  async function runMatch() {
    setErr(null);
    const ids = parseIdentifiers(paste);
    if (!ids.length) {
      setErr("Paste at least one email or phone number.");
      return;
    }
    setSyncing(true);
    try {
      const r = await fetch("/api/contacts/match", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ identifiers: ids }),
      });
      const d = (await r.json().catch(() => ({}))) as ContactsMatchResp;
      const rows = Array.isArray(d?.matches) ? d.matches : [];
      setMatchRows(rows);
      setContactSyncDone(true);
      toast(rows.length ? `Found ${rows.length} people on Siddes` : "No matches yet");
      await loadSuggestions();
    } catch {
      setErr("Could not match right now.");
    } finally {
      setSyncing(false);
    }
  }

  function toggleGroup(id: string) {
    const sid = String(id || "").trim();
    if (!sid) return;
    setSelectedIds((prev) => {
      const set = new Set(prev);
      if (set.has(sid)) set.delete(sid);
      else set.add(sid);
      return Array.from(set.values());
    });
  }

  const selectedGroups = useMemo(() => {
    const set = new Set(selectedIds.map((x) => String(x || "").trim()).filter(Boolean));
    return suggestedSets.filter((s) => set.has(String((s as any)?.id || "")));
  }, [suggestedSets, selectedIds]);

  const counts = useMemo(() => {
    const total = matches.length;
    const selected = selectedGroups.length;
    const people = new Set<string>();
    for (const g of selectedGroups) {
      for (const h of (g as any)?.members || []) people.add(String(h || "").trim());
    }
    return { total, selected, people: people.size };
  }, [matches.length, selectedGroups]);

  async function applyAndContinue(forceConfirmed: boolean = false) {
    setErr(null);
    setBusy(true);

    try {
      // 1) Build membership assignments (close > work > friends)
      const assignments = new Map<string, SideId>();

      for (const g of selectedGroups) {
        const side = (g as any)?.side as SideId | undefined;
        const members = Array.isArray((g as any)?.members) ? ((g as any)?.members as string[]) : [];
        if (!side || side === "public") continue;
        for (const raw of members) {
          const handle = String(raw || "").trim();
          if (!handle) continue;
          const prev = assignments.get(handle);
          if (!prev || sidePriority(side) < sidePriority(prev)) assignments.set(handle, side);
        }
      }

      if (fillFriends) {
        for (const m of matches) {
          const handle = String(m?.handle || "").trim();
          if (!handle) continue;
          if (!assignments.has(handle)) assignments.set(handle, "friends");
        }
      }

      const entries = Array.from(assignments.entries());
      let closeN = 0;
      let workN = 0;
      for (const [, s] of entries) {
        if (s === "close") closeN++;
        if (s === "work") workN++;
      }

      // sd_532_sensitive_confirm: require explicit user confirmation before granting Close/Work access
      if (!forceConfirmed && (closeN > 0 || workN > 0)) {
        setSensitiveCounts({ close: closeN, work: workN, total: entries.length });
        setSensitiveConfirmOpen(true);
        setBusy(false);
        return;
      }

      setSensitiveConfirmOpen(false);

      // 2) Apply side edges (sequential, calm)
      for (let i = 0; i < entries.length; i++) {
        const [handle, side] = entries[i];
        try {
          // Close requires Friends first (server rule). Do it automatically.
          if (side === "close") {
            try {
              const r0 = await fetch("/api/side", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ username: handle, side: "friends" }),
              });
              await r0.json().catch(() => ({}));
            } catch {
              // ignore
            }
          }

          const r = await fetch("/api/side", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              username: handle,
              side,
              confirm: side === "close" || side === "work" ? true : undefined, // sd_530 align
            }),
          });
          await r.json().catch(() => ({}));
        } catch {
          // ignore single failure
        }
      }

      // 3) Optional: create sets from selected groups
      if (createSets) {
        for (const g of selectedGroups) {
          const side = (g as any)?.side as SideId | undefined;
          const label = String((g as any)?.label || "").trim() || "Untitled";
          const color = (g as any)?.color || undefined;
          const members = Array.isArray((g as any)?.members) ? (g as any).members : [];
          if (!side || side === "public") continue;
          try {
            const r = await fetch("/api/sets", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ side, label, color, members }),
            });
            await r.json().catch(() => ({}));
          } catch {
            // ignore
          }
        }
      }

      toast("Done");
      onContinue({ contactSyncDone: contactSyncDone || matches.length > 0 });
    } catch {
      setErr("Could not apply right now.");
    } finally {
      setBusy(false);
    }
  }


  const canApply = !busy && !syncing && (selectedGroups.length > 0 || fillFriends);

  return (
    <div className="flex flex-col min-h-full px-10 pt-28 text-center pb-12">
      <Toast message={toastMsg} visible={toastOn} />


      {/* sd_532_sensitive_confirm: Close/Work grant confirmation */}
      {sensitiveConfirmOpen ? (
        <div className="fixed inset-0 z-[96] flex items-end justify-center md:items-center">
          <button
            type="button"
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => !busy && setSensitiveConfirmOpen(false)}
            aria-label="Close"
          />
          <div className="relative w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl shadow-2xl p-6 animate-in slide-in-from-bottom-full duration-200">
            <div className="text-lg font-black text-gray-900">Confirm private access</div>
            <div className="text-xs text-gray-500 mt-1 leading-relaxed">
              You’re about to place people into your <span className="font-black text-gray-900">Close</span> and/or <span className="font-black text-gray-900">Work</span> Side.
              That grants them access to your private identities and posts.
            </div>

            <div className="mt-4 space-y-2">
              {sensitiveCounts.close > 0 ? (
                <div className="p-4 rounded-2xl border border-gray-200 bg-rose-50">
                  <div className="text-xs font-black text-rose-700">Close</div>
                  <div className="text-sm font-extrabold text-gray-900 mt-0.5">{sensitiveCounts.close} people</div>
                </div>
              ) : null}
              {sensitiveCounts.work > 0 ? (
                <div className="p-4 rounded-2xl border border-gray-200 bg-slate-50">
                  <div className="text-xs font-black text-slate-700">Work</div>
                  <div className="text-sm font-extrabold text-gray-900 mt-0.5">{sensitiveCounts.work} people</div>
                </div>
              ) : null}
              <div className="text-[11px] text-gray-500">
                Total changes: <span className="font-black text-gray-900">{sensitiveCounts.total}</span>
              </div>
            </div>

            <div className="mt-3 text-[11px] text-gray-600 leading-relaxed">
              This does <span className="font-black">not</span> unlock their private identities for you.
              It only changes what <span className="font-black">they</span> can access of <span className="font-black">you</span>.
            </div>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setSensitiveConfirmOpen(false)}
                className="flex-1 py-3 rounded-xl bg-white border border-gray-200 text-gray-800 font-extrabold text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setSensitiveConfirmOpen(false);
                  applyAndContinue(true);
                }}
                className="flex-1 py-3 rounded-xl bg-gray-900 text-white font-extrabold text-sm shadow-md active:scale-95 transition-all"
              >
                Grant access
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="inline-flex items-center justify-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-gray-400 mb-4">
        <Sparkles size={16} /> Prism People
      </div>

      <h2 className="text-4xl font-black text-gray-900 tracking-tight mb-4 leading-tight">Sort your people.</h2>

      <p className="text-gray-400 mb-10 font-medium leading-relaxed">
        We suggest high-confidence groups (Work & Family).<br />
        You approve. You can change anything later.
      </p>

      <div className="max-w-md mx-auto w-full space-y-4 text-left">
        <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2 text-gray-900 font-black">
            <BrainCircuit size={18} /> Scan contacts
          </div>
          <p className="text-xs text-gray-400 mb-3">
            Paste emails or phone numbers (optional). If you already scanned, you can skip this.
          </p>

          <textarea
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            placeholder="e.g. jane@company.com +254712345678"
            className="w-full h-24 resize-none rounded-2xl border border-gray-100 p-4 text-sm outline-none focus:ring-2 focus:ring-gray-900/10"
          />

          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="text-[11px] text-gray-400 font-semibold">
              {syncing ? "Scanning…" : contactSuggestions.length ? `${contactSuggestions.length} matched people ready` : "No matches yet"}
            </div>
            <button
              type="button"
              onClick={runMatch}
              disabled={syncing}
              className={cn(
                "px-4 py-2 rounded-full text-xs font-black border transition-all",
                syncing ? "opacity-30 cursor-not-allowed" : "hover:shadow-sm",
                "border-gray-200 text-gray-900"
              )}
            >
              Scan
            </button>
          </div>

          {err ? <div className="mt-3 text-xs font-bold text-red-500">{err}</div> : null}
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2 text-gray-900 font-black">
            <Users size={18} /> Smart groups
          </div>

          {suggestedSets.length ? (
            <div className="space-y-3 mt-4">
              {suggestedSets.map((s) => {
                const id = String((s as any)?.id || "");
                const side = ((s as any)?.side as SideId | undefined) || "friends";
                const theme = SIDE_THEMES[side] || SIDE_THEMES.friends;
                const checked = selectedIds.includes(id);
                const members = Array.isArray((s as any)?.members) ? ((s as any)?.members as string[]) : [];
                const label = String((s as any)?.label || "Untitled");
                const reason = String((s as any)?.reason || "");

                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleGroup(id)}
                    className={cn(
                      "w-full rounded-3xl border p-4 text-left transition-all",
                      checked ? cn(theme.border, theme.lightBg, "shadow-sm") : "border-gray-100 hover:border-gray-200"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "mt-0.5 h-6 w-6 rounded-full flex items-center justify-center border",
                          checked ? cn(theme.primaryBg, "border-transparent text-white") : "border-gray-200 text-gray-300"
                        )}
                        aria-hidden="true"
                      >
                        <CheckSquare size={16} />
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-black text-gray-900">{label}</div>
                          <span className={cn("px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-white", theme.primaryBg)}>
                            {SIDES[side]?.label || "Friends"}
                          </span>
                        </div>
                        {reason ? <div className="text-xs text-gray-400 mt-1 leading-snug">{reason}</div> : null}
                        <div className="text-[11px] text-gray-500 mt-2 font-semibold">{members.length} people</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mt-3 text-xs text-gray-400 leading-relaxed">
              No strong groups yet. Try scanning contacts, or skip for now.
            </div>
          )}

          <div className="mt-5 space-y-3">
            <label className="flex items-center gap-3 text-xs font-bold text-gray-700">
              <input type="checkbox" checked={fillFriends} onChange={(e) => setFillFriends(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
              Mark remaining as <span className="text-emerald-600">Friends</span>
            </label>

            <label className="flex items-center gap-3 text-xs font-bold text-gray-700">
              <input type="checkbox" checked={createSets} onChange={(e) => setCreateSets(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
              Also create Sets from selected groups
            </label>

            <div className="text-[11px] text-gray-400">
              Selected: {counts.selected} groups · {counts.people} people
            </div>
          </div>
        </div>
      </div>

      <div className="mt-10 flex flex-col items-center gap-4">
        <PrimaryButton
          label={busy ? "Applying…" : "Continue"}
          onClick={applyAndContinue}
          disabled={!canApply}
          icon={ArrowRight}
          themeBg="bg-gray-900"
        />

        <button type="button" onClick={onSkip} className="text-xs font-black text-gray-300 hover:text-gray-500 transition-colors">
          Skip for now
        </button>
      </div>
    </div>
  );
}

