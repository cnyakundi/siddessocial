"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

import { SuggestedSetsSheet } from "@/src/components/SuggestedSetsSheet";
import type { SuggestedSet } from "@/src/lib/setSuggestions";
import type { SideId } from "@/src/lib/sides";

function normLabel(label: string): string {
  const v = String(label || "").trim();
  return (v || "Untitled").slice(0, 64);
}
import { suggestSetsFromMatches, type ContactMatch } from "@/src/lib/localIntelligence/onDeviceContextEngine";
import {
  clearSuggestionDecision,
  isSuggestionSuppressed,
  markSuggestionAccepted,
  markSuggestionDismissed,
} from "@/src/lib/localIntelligence/localSuggestionLedger";
import { sdTelemetry } from "@/src/lib/telemetry/sdTelemetry";

type MeResp = {
  ok: boolean;
  authenticated?: boolean;
  user?: { id: number; username: string; email: string };
  viewerId?: string;
  onboarding?: { completed: boolean; step?: string; contact_sync_done?: boolean };
  locality?: { detectedRegion?: string; chosenRegion?: string; region?: string };
  ageGateConfirmed?: boolean;
  ageGateConfirmedAt?: string | null;
  minAge?: number;
};



function saveSuggestedSetsCache(viewerKey: string, sets: SuggestedSet[]) {
  try {
    if (typeof window === "undefined") return;
    const key = `sd:suggested_sets:${viewerKey}`;
    window.localStorage.setItem(key, JSON.stringify({ v: 1, ts: Date.now(), sets }));
  } catch {
    // ignore
  }
}

type UndoToast = {
  token: string;
  setIds: string[];
  suggestions: SuggestedSet[];
  message: string;
  busy?: boolean;
};

function OnboardingPageInner() {
  const router = useRouter();
  const sp = useSearchParams();

  const nextHref = useMemo(() => {
    const raw = String(sp?.get("next") || "/siddes-feed");
    return raw.startsWith("/") ? raw : "/siddes-feed";
  }, [sp]);

  const [me, setMe] = useState<MeResp | null>(null);
  const viewerKey = useMemo(() => {
    const v = me?.viewerId ? String(me.viewerId).trim() : "";
    if (v) return v;
    const uid = me?.user?.id;
    return uid ? `me_${uid}` : "anon";
  }, [me]);

  const [emails, setEmails] = useState("");

  const [onbBroadcasts, setOnbBroadcasts] = useState<Array<any> | null>(null);
  const [onbFollowing, setOnbFollowing] = useState<Record<string, boolean>>({});
  const [onbLoading, setOnbLoading] = useState(false);

  const [matches, setMatches] = useState<Array<{ handle: string; display_name: string }> | null>(null);

  const [suggestedSets, setSuggestedSets] = useState<SuggestedSet[]>([]);
  const [suggestedSetsOpen, setSuggestedSetsOpen] = useState(false);

  const [msg, setMsg] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [localityMsg, setLocalityMsg] = useState<string | null>(null);
  const [ageOk, setAgeOk] = useState(false);
  const [ageBusy, setAgeBusy] = useState(false);
  const [regionChoice, setRegionChoice] = useState<string>("");
  const [regionBusy, setRegionBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [contactSyncDone, setContactSyncDone] = useState(false);

  const undoTimerRef = useRef<number | null>(null);
  const [undoToast, setUndoToast] = useState<UndoToast | null>(null);

  function armUndo(setIds: string[], suggestions: SuggestedSet[]) {
    const ids = (setIds || []).map((x) => String(x || "").trim()).filter(Boolean);
    if (!ids.length) return;

    const token = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const message = ids.length === 1 ? "Set created." : `${ids.length} sets created.`;
    setUndoToast({ token, setIds: ids, suggestions, message });

    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    undoTimerRef.current = window.setTimeout(() => {
      setUndoToast((cur) => (cur && cur.token === token ? null : cur));
    }, 8000);
  }

  async function undoLastCreate() {
    const u = undoToast;
    if (!u || u.busy) return;

    setUndoToast({ ...u, busy: true });

    try {
      for (const id of u.setIds) {
        const res = await fetch(`/api/sets/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("delete_failed");
      }

      sdTelemetry("suggestion_undo", u.suggestions.length || 1);

      // Restore suggestions + clear local decisions
      for (const s of u.suggestions) clearSuggestionDecision(viewerKey, s.id);

      setSuggestedSets((prev) => {
        const seen = new Set(prev.map((x) => x.id));
        const restored = u.suggestions.filter((s) => !seen.has(s.id));
        return restored.concat(prev);
      });

      setSuggestedSetsOpen(true);
      setUndoToast(null);
    } catch {
      setUndoToast((cur) => (cur ? { ...cur, busy: false, message: "Undo failed." } : cur));
    }
  }

  async function loadOnbBroadcasts() {
    setOnbLoading(true);
    try {
      const res = await fetch("/api/broadcasts?tab=discover", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      setOnbBroadcasts(Array.isArray(data?.items) ? data.items : []);
    } catch {
      setOnbBroadcasts([]);
    } finally {
      setOnbLoading(false);
    }
  }

  async function toggleOnbFollow(id: string, currently: boolean) {
    try {
      const res = await fetch(`/api/broadcasts/${id}/${currently ? "unfollow" : "follow"}`, { method: "POST" });
      if (res.ok) setOnbFollowing((m) => ({ ...m, [id]: !currently }));
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setMe(d))
      .catch(() => setMe({ ok: true, authenticated: false }));

    loadOnbBroadcasts();

    return () => {
      if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    };
  }, []);

  const authed = !!me?.authenticated;

  const ageConfirmed = !!me?.ageGateConfirmed; // sd_399_locality_step0
  const minAge = typeof me?.minAge === "number" && (me.minAge || 0) > 0 ? (me.minAge as number) : 13;
  const detectedRegion = String(me?.locality?.detectedRegion || "").trim();
  const chosenRegion = String(me?.locality?.chosenRegion || "").trim();
  const effectiveRegion = String(me?.locality?.region || (chosenRegion || detectedRegion) || "").trim();

  useEffect(() => {
    if (!regionChoice) {
      const seed = chosenRegion || detectedRegion;
      if (seed) setRegionChoice(seed);
    }
  }, [chosenRegion, detectedRegion]);

  function extractIdentifiers(raw: string): string[] {
    const text = String(raw || "");
    const out: string[] = [];

    // Emails
    const emailRe = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
    const emails = text.match(emailRe) || [];
    for (const e of emails) out.push(e.trim());

    // Phones (loose): +254..., 07xx..., (xxx) xxx-xxxx, etc.
    const phoneRe = /\+?\d[\d\s().-]{7,}\d/g;
    const phones = text.match(phoneRe) || [];
    for (const ph of phones) {
      const trimmed = String(ph || "").trim();
      if (!trimmed) continue;
      const hasPlus = trimmed.startsWith("+");
      const digits = trimmed.replace(/\D/g, "");
      if (!digits) continue;
      if (digits.length < 7 || digits.length > 15) continue;
      out.push(hasPlus ? `+${digits}` : digits);
    }

    // Dedup + cap (match backend)
    const seen = new Set<string>();
    const dedup: string[] = [];
    for (const x of out) {
      const v = String(x || "").trim();
      if (!v) continue;
      const k = v.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      dedup.push(v);
      if (dedup.length >= 2000) break;
    }
    return dedup;
  }

  async function importIdentifiersFromFile(file: File) {
    setMsg(null);
    setNote(null);

    try {
      const text = await file.text();
      const ids = extractIdentifiers(text);

      if (ids.length === 0) {
        setNote("No emails or phone numbers found in that file.");
        return;
      }

      setEmails((prev) => {
        const base = String(prev || "").trim();
        const merged = (base ? base + "\n" : "") + ids.join("\n");
        return merged + "\n";
      });

      setNote(`Imported ${ids.length} identifier(s) from ${file.name}.`);
    } catch {
      setNote("Failed to read that file.");
    }
  }


  async function matchContacts() {
    setMsg(null);
    setMatches(null);

    const ids = extractIdentifiers(emails);
if (ids.length === 0) {
      setMsg("Paste at least one email (or phone number).");
      return;
    }

    const res = await fetch("/api/contacts/match", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identifiers: ids }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(data?.error ? String(data.error) : "Contact match failed");
      return;
    }

    setContactSyncDone(true);

    const rawMatches: ContactMatch[] = Array.isArray(data?.matches)
      ? data.matches.map((m: any) => ({
          handle: String(m?.handle || ""),
          display_name: String(m?.display_name || ""),
          hint: m?.hint && typeof m.hint === "object" ? m.hint : undefined,
        }))
      : [];

    setMatches(rawMatches.map((m) => ({ handle: m.handle, display_name: m.display_name })));

    const local = suggestSetsFromMatches(rawMatches);
    const filtered = local.filter((s) => !isSuggestionSuppressed(viewerKey, s.id));

    setSuggestedSets(filtered);
    saveSuggestedSetsCache(viewerKey, filtered);
    if (filtered.length) setSuggestedSetsOpen(true);
  }

  async function createSetFromSuggestion(s: SuggestedSet): Promise<string> {
    const side = (s as any).side as SideId | undefined;

    const body = {
      side: side || "friends",
      label: normLabel(s.label),
      members: s.members,
      color: s.color,
    };

    const res = await fetch("/api/sets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`sets:create failed (${res.status})`);

    const id = data?.item?.id ? String(data.item.id) : "";
    if (!id) throw new Error("sets:create missing id");
    return id;
  }

  async function createSetsFromSuggestionsBulk(ss: SuggestedSet[]): Promise<string[]> {
    const inputs = ss.map((s) => ({
      side: (((s as any).side as SideId | undefined) || "friends"),
      label: normLabel(s.label),
      members: s.members,
      color: s.color,
    }));

    const res = await fetch("/api/sets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ inputs }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`sets:bulk_create failed (${res.status})`);

    const ids = Array.isArray(data?.items) ? data.items.map((it: any) => String(it?.id || "")).filter(Boolean) : [];
    return ids;
  }

  async function refreshMe() {
    try {
      const r = await fetch("/api/auth/me", { cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      setMe(d);
    } catch {
      // ignore
    }
  }

  async function confirmAgeGate() {
    setLocalityMsg(null);
    if (ageConfirmed) return;
    if (!ageOk) {
      setLocalityMsg("Please confirm the checkbox first.");
      return;
    }

    setAgeBusy(true);
    try {
      const res = await fetch("/api/auth/age/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmed: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLocalityMsg(data?.error ? String(data.error) : "Age confirmation failed");
      } else {
        setLocalityMsg("Age confirmed.");
        await refreshMe();
      }
    } catch {
      setLocalityMsg("Network error confirming age.");
    } finally {
      setAgeBusy(false);
    }
  }

  async function saveRegionChoice() {
    setLocalityMsg(null);
    setRegionBusy(true);

    try {
      const region = String(regionChoice || "").trim().toUpperCase();
      const res = await fetch("/api/auth/region", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ region }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLocalityMsg(data?.error ? String(data.error) : "Region update failed");
      } else {
        setLocalityMsg(region ? "Region saved." : "Using detected region." );
        await refreshMe();
      }
    } catch {
      setLocalityMsg("Network error updating region.");
    } finally {
      setRegionBusy(false);
    }
  }

  async function completeOnboardingAndGo() {
    if (!ageConfirmed) {
      setMsg(`Confirm age (${minAge}+) to continue.`);
      return;
    }

    setSubmitting(true);
    setMsg(null);

    try {
      const res = await fetch("/api/auth/onboarding/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contact_sync_done: contactSyncDone }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data?.error ? String(data.error) : "Onboarding completion failed");
        setSubmitting(false);
        return;
      }

      router.push(nextHref);
    } catch {
      setMsg("Network error completing onboarding");
      setSubmitting(false);
    }
  }

  if (me && !authed) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl p-6 shadow-sm text-center">
          <div className="text-xl font-black text-gray-900">Sign in first</div>
          <p className="text-sm text-gray-500 mt-2">Onboarding needs your account.</p>
          <Link
            href="/login"
            className="inline-block mt-5 rounded-full bg-gray-900 text-white text-sm font-bold px-6 py-2.5 hover:bg-gray-800"
          >
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-2xl font-black text-gray-900">You are in.</div>
            <div className="text-sm text-gray-500 mt-1">Siddes onboarding is about context safety, not friction.</div>
          </div>

          <button
            type="button"
            onClick={completeOnboardingAndGo}
            disabled={!ageConfirmed || submitting}
            className="rounded-full border border-gray-300 text-sm font-bold px-4 py-2.5 hover:bg-gray-50 disabled:opacity-60"
          >
            Skip
          </button>
        </div>

        <div className="mt-6 p-4 rounded-xl border border-gray-100 bg-gray-50" data-testid="onboarding-step0-locality">
          <div className="text-xs font-bold uppercase tracking-widest text-gray-500">Step 0</div>
          <div className="text-sm font-bold text-gray-900 mt-1">Safety + Locality</div>
          <div className="text-xs text-gray-500 mt-1">
            Region is used only for defaults (language, help, safety resources, performance). You can override anytime.
          </div>

          <div className="mt-3 p-3 rounded-xl border border-gray-100 bg-white">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Age</div>
            {ageConfirmed ? (
              <div className="text-sm text-gray-700 mt-1">Confirmed (min age {minAge}+).</div>
            ) : (
              <div className="mt-2">
                <label className="flex items-start gap-2 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={ageOk}
                    onChange={(e) => setAgeOk(e.target.checked)}
                  />
                  <span>I confirm I'm at least {minAge} years old (or the minimum age required in my country).</span>
                </label>

                <button
                  type="button"
                  onClick={confirmAgeGate}
                  disabled={!ageOk || ageBusy}
                  className={
                    "mt-2 rounded-full px-4 py-2 text-xs font-extrabold border " +
                    (!ageOk || ageBusy
                      ? "bg-gray-100 text-gray-400 border-gray-200"
                      : "bg-gray-900 text-white border-gray-900 hover:opacity-90")
                  }
                >
                  {ageBusy ? "Confirming..." : "Confirm"}
                </button>
              </div>
            )}
          </div>

          <div className="mt-3 p-3 rounded-xl border border-gray-100 bg-white">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Region</div>
                <div className="text-xs text-gray-500 mt-1">
                  Detected: <span className="font-semibold text-gray-700">{detectedRegion || "Unknown"}</span>
                  {chosenRegion ? (
                    <>
                      {" "}• Chosen: <span className="font-semibold text-gray-700">{chosenRegion}</span>
                    </>
                  ) : null}
                </div>
              </div>
              <div className="text-[11px] text-gray-400 font-semibold">Optional</div>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <select
                value={regionChoice}
                onChange={(e) => setRegionChoice(String(e.target.value || ""))}
                className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-800 outline-none focus:bg-white focus:border-gray-300"
              >
                <option value="">Use detected</option>
                <option value="KE">KE - Kenya</option>
                <option value="UG">UG - Uganda</option>
                <option value="TZ">TZ - Tanzania</option>
                <option value="RW">RW - Rwanda</option>
                <option value="ET">ET - Ethiopia</option>
                <option value="NG">NG - Nigeria</option>
                <option value="GH">GH - Ghana</option>
                <option value="ZA">ZA - South Africa</option>
                <option value="EG">EG - Egypt</option>
                <option value="IN">IN - India</option>
                <option value="US">US - United States</option>
                <option value="GB">GB - United Kingdom</option>
                <option value="CA">CA - Canada</option>
                <option value="DE">DE - Germany</option>
                <option value="FR">FR - France</option>
                <option value="BR">BR - Brazil</option>
                <option value="AU">AU - Australia</option>
                <option value="JP">JP - Japan</option>
              </select>

              <button
                type="button"
                onClick={() => saveRegionChoice()}
                disabled={regionBusy}
                className={
                  "rounded-full px-4 py-2 text-xs font-extrabold border " +
                  (regionBusy
                    ? "bg-gray-100 text-gray-400 border-gray-200"
                    : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50")
                }
              >
                {regionBusy ? "Saving..." : "Save"}
              </button>
            </div>

            <div className="mt-2 text-[11px] text-gray-400">Region only affects defaults. It is not a lock.</div>
          </div>

          {localityMsg ? <div className="mt-3 text-xs font-semibold text-gray-700">{localityMsg}</div> : null}
        </div>

        <div className="mt-6 p-4 rounded-xl border border-gray-100 bg-gray-50">
          <div className="text-xs font-bold uppercase tracking-widest text-gray-500">Step 1</div>
          <div className="text-sm font-bold text-gray-900 mt-1">Find your people (optional)</div>
          <div className="text-xs text-gray-500 mt-1">
            Paste emails (or phone numbers). We match safely; no raw contact list stored.
            <span className="block mt-1">Suggested Sets are computed <b>on-device</b>.</span>
          </div>

          <textarea
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            className="mt-3 w-full h-28 rounded-xl border border-gray-200 bg-white p-3 text-sm outline-none focus:border-gray-300"
            placeholder="one email per line..."
          />

          {msg ? <div className="text-sm text-rose-600 mt-2">{msg}</div> : null}
          {note ? <div className="text-sm text-gray-600 mt-2">{note}</div> : null}

          <button
            onClick={matchContacts}
            className="mt-3 rounded-full bg-gray-900 text-white text-sm font-bold px-5 py-2.5 hover:bg-gray-800"
            disabled={submitting}
          >
            Match contacts
          </button>

          {matches ? (
            <div className="mt-4">
              <div className="text-xs font-bold uppercase tracking-widest text-gray-500">Matches</div>
              {matches.length === 0 ? (
                <div className="text-sm text-gray-500 mt-2">No matches yet.</div>
              ) : (
                <ul className="mt-2 space-y-2">
                  {matches.slice(0, 30).map((m, i) => (
                    <li key={i} className="p-3 rounded-xl border border-gray-100 bg-white flex items-center justify-between">
                      <div>
                        <div className="text-sm font-bold text-gray-900">{m.display_name}</div>
                        <div className="text-xs text-gray-500">{m.handle}</div>
                      </div>
                      <span className="text-xs text-gray-400 font-bold">Found</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>

        <div className="mt-6 p-4 rounded-xl border border-gray-100 bg-gray-50">
          <div className="text-xs font-bold uppercase tracking-widest text-gray-500">Step 2</div>
          <div className="text-sm font-bold text-gray-900 mt-1">Start in Friends</div>
          <div className="text-xs text-gray-500 mt-1">You can accept Suggested Sets now, and adjust anytime.</div>
          <Link
            href="/siddes-sets"
            className="inline-block mt-3 rounded-full bg-white border border-gray-300 text-sm font-bold px-4 py-2.5 hover:bg-gray-50"
          >
            View Sets
          </Link>
        </div>

        <div className="mt-6 p-4 rounded-xl border border-gray-100 bg-gray-50">
          <div className="text-xs font-bold uppercase tracking-widest text-gray-500">Optional</div>
          <div className="text-sm font-bold text-gray-900 mt-1">Pick 3 broadcasts</div>
          <div className="text-xs text-gray-500 mt-1">
            Broadcasts keep Public useful even when friends are quiet. Calm, high-signal channels.
          </div>

          <div className="mt-3">
            {onbLoading ? (
              <div className="text-sm text-gray-500">Loading picks...</div>
            ) : onbBroadcasts && onbBroadcasts.length ? (
              <div className="space-y-2">
                {onbBroadcasts.slice(0, 6).map((b: any) => {
                  const followed = !!onbFollowing[b.id];
                  return (
                    <div key={b.id} className="p-3 rounded-xl border border-gray-100 bg-white flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-extrabold text-gray-900 truncate">{b.name}</div>
                        <div className="text-xs text-gray-500 truncate">
                          {b.handle} • {b.category}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleOnbFollow(String(b.id), followed)}
                        className={
                          "px-3 py-2 rounded-full text-xs font-extrabold border " +
                          (followed ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50")
                        }
                      >
                        {followed ? "Following" : "Follow"}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-sm text-gray-500">No picks available yet.</div>
            )}

            <div className="mt-3 flex items-center justify-between">
              <div className="text-[11px] text-gray-400">Try to follow at least 3. You can change this anytime.</div>
              <button type="button" onClick={loadOnbBroadcasts} className="text-xs font-extrabold text-gray-900 hover:underline">
                Refresh
              </button>
            </div>
          </div>
        </div>

        <SuggestedSetsSheet
          open={suggestedSetsOpen}
          onClose={() => setSuggestedSetsOpen(false)}
          suggestions={suggestedSets}
          onAccept={(s) => {
            createSetFromSuggestion(s)
              .then((createdId) => {
                markSuggestionAccepted(viewerKey, s.id);
                setSuggestedSets((prev) => prev.filter((x) => x.id !== s.id));
                armUndo([createdId], [s]);
              })
              .catch(() => {
                // ignore
              });
          }}
          onAcceptMany={async (ss) => {
            try {
              const created = await createSetsFromSuggestionsBulk(ss);
              ss.forEach((s) => markSuggestionAccepted(viewerKey, s.id));
              setSuggestedSets((prev) => prev.filter((x) => !ss.some((y) => y.id === x.id)));
              armUndo(created, ss);
            } catch {
              // ignore
            }
          }}
          onSkip={(id) => {
            markSuggestionDismissed(viewerKey, id);
            setSuggestedSets((prev) => prev.filter((x) => x.id !== id));
          }}
          onSkipMany={async (ids) => {
            ids.forEach((id) => markSuggestionDismissed(viewerKey, id));
            setSuggestedSets((prev) => prev.filter((x) => !ids.includes(x.id)));
          }}
        />

        {undoToast ? (
          <div className="fixed left-0 right-0 bottom-4 z-[120] px-4 flex justify-center">
            <div className="w-full max-w-lg bg-white border border-gray-200 rounded-2xl shadow-lg px-4 py-3 flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-gray-900">{undoToast.message}</div>
              <button
                type="button"
                onClick={undoLastCreate}
                disabled={!!undoToast.busy}
                className={
                  "px-4 py-2 rounded-full text-xs font-extrabold border " +
                  (undoToast.busy ? "bg-gray-100 text-gray-400 border-gray-200" : "bg-gray-900 text-white border-gray-900 hover:opacity-90")
                }
              >
                {undoToast.busy ? "Undoing..." : "Undo"}
              </button>
            </div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={completeOnboardingAndGo}
          disabled={!ageConfirmed || submitting}
          className="block mt-6 w-full text-center rounded-full bg-gray-900 text-white text-sm font-bold py-3 hover:opacity-95 disabled:opacity-60"
        >
          {submitting ? "Finishing..." : "Finish"}
        </button>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-500">Loading onboarding...</div>}>
      <OnboardingPageInner />
    </Suspense>
  );
}
