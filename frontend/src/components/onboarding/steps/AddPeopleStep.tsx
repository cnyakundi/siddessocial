import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BrainCircuit, Check, Copy, MessageSquare, Search, Share, UserPlus, Users } from "lucide-react";
import type { SideId } from "@/src/lib/sides";
import { PrimaryButton, Toast } from "@/src/components/onboarding/ui";

type ContactHint = { kind?: string; domain?: string; workish?: boolean };
type ContactMatch = { user_id?: string; handle: string; display_name: string; hint?: ContactHint };
type ContactsMatchResp = { ok: boolean; matches?: ContactMatch[] };

type ContactsSuggestionItem = { id: string; name: string; handle: string; matched?: boolean; hint?: ContactHint };
type ContactsSuggestionsResp = { ok: boolean; items?: ContactsSuggestionItem[] };

type SearchUserItem = { id: number; username: string; handle: string };
type SearchUsersResp = { ok: boolean; items?: SearchUserItem[]; count?: number };

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
    const k = p.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(p);
    if (out.length >= 2000) break;
  }
  return out;
}

export default function AddPeopleStep({
  setName,
  sideId,
  onContinue,
  onSkip,
}: {
  setName: string;
  sideId: SideId;
  onContinue: (payload: { handles: string[]; contactSyncDone: boolean }) => void;
  onSkip: () => void;
}) {
  const [viewState, setViewState] = useState<"method" | "scanning" | "results">("method");
  const [paste, setPaste] = useState("");
  const [matches, setMatches] = useState<ContactMatch[]>([]);
  const [suggestions, setSuggestions] = useState<ContactsSuggestionItem[]>([]);
  const [searchQ, setSearchQ] = useState("");
  const [searchItems, setSearchItems] = useState<SearchUserItem[]>([]);
  const [added, setAdded] = useState<Set<string>>(() => new Set());
  const [toastMsg, setToastMsg] = useState("");
  const [toastOn, setToastOn] = useState(false);
  const [contactSyncDone, setContactSyncDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const INVITE_URL = "https://siddes.com/i/access";

  function toast(msg: string) {
    setToastMsg(msg);
    setToastOn(true);
    window.setTimeout(() => setToastOn(false), 2000);
  }

  const heading = useMemo(() => {
    if (sideId === "close") return "Add your inner circle ❤️";
    if (sideId === "friends") return "Pick your people";
    if (sideId === "work") return "Add your team";
    return "Bring your circle";
  }, [sideId]);

  async function loadSuggestions() {
    try {
      const r = await fetch("/api/contacts/suggestions", { cache: "no-store" });
      const d = (await r.json().catch(() => ({}))) as ContactsSuggestionsResp;
      if (r.ok && d?.ok && Array.isArray(d.items)) {
        setSuggestions(d.items);
      }
    } catch {
      // ignore
    }
  }

  async function runMatch() {
    setErr(null);
    const ids = parseIdentifiers(paste);
    if (!ids.length) {
      setErr("Paste at least one email or phone number.");
      return;
    }
    setViewState("scanning");
    try {
      const r = await fetch("/api/contacts/match", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ identifiers: ids }),
      });
      const d = (await r.json().catch(() => ({}))) as ContactsMatchResp;
      const rows = Array.isArray(d?.matches) ? d.matches : [];
      setMatches(rows);
      setContactSyncDone(true);
      setViewState("results");
      toast(rows.length ? `Found ${rows.length} siders` : "No matches yet");
      loadSuggestions();
    } catch {
      setViewState("results");
      setErr("Could not match right now.");
    }
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(INVITE_URL);
      toast("Link copied!");
    } catch {
      window.prompt("Copy this link:", INVITE_URL);
    }
  }

  async function handleShare() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const navAny: any = navigator as any;
    if (navAny?.share) {
      try {
        await navAny.share({ title: "Join Siddes", text: `Join my \"${setName}\" Set on Siddes`, url: INVITE_URL });
        return;
      } catch {
        // fall through
      }
    }
    await copyInvite();
  }

  function openWhatsApp() {
    const wa = `https://wa.me/?text=${encodeURIComponent(`Join my \"${setName}\" Set on Siddes: ${INVITE_URL}`)}`;
    window.open(wa, "_blank", "noopener,noreferrer");
    toast("Opening WhatsApp...");
  }

  function toggle(handle: string, name?: string) {
    const h = String(handle || "").trim();
    if (!h) return;
    setAdded((prev) => {
      const next = new Set(prev);
      if (next.has(h)) {
        next.delete(h);
        if (name) toast(`${name} removed`);
      } else {
        next.add(h);
        if (name) toast(`${name} added!`);
      }
      return next;
    });
  }

  const primaryList = useMemo(() => {
    const base = matches.length
      ? matches.map((m) => ({ handle: m.handle, name: m.display_name, hint: m.hint }))
      : suggestions.map((s) => ({ handle: s.handle, name: s.name, hint: s.hint }));

    const seen = new Set<string>();
    const out: Array<{ handle: string; name: string; hint?: ContactHint }> = [];
    for (const r of base) {
      const h = String(r.handle || "").trim();
      if (!h || seen.has(h)) continue;
      seen.add(h);
      out.push({ handle: h, name: r.name, hint: r.hint });
      if (out.length >= 50) break;
    }
    return out;
  }, [matches, suggestions]);

  useEffect(() => {
    if (viewState !== "results") return;
    if (suggestions.length === 0) loadSuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewState]);

  useEffect(() => {
    const q = String(searchQ || "").trim();
    const qn = q.startsWith("@") ? q.slice(1) : q;
    if (qn.length < 2) {
      setSearchItems([]);
      return;
    }
    const t = window.setTimeout(async () => {
      try {
        const r = await fetch(`/api/search/users?q=${encodeURIComponent(qn)}&limit=12`, { cache: "no-store" });
        const d = (await r.json().catch(() => ({}))) as SearchUsersResp;
        if (r.ok && d?.ok && Array.isArray(d.items)) {
          setSearchItems(d.items);
        } else {
          setSearchItems([]);
        }
      } catch {
        setSearchItems([]);
      }
    }, 180);

    return () => window.clearTimeout(t);
  }, [searchQ]);

  if (viewState === "method") {
    return (
      <div className="flex flex-col min-h-full px-10 pt-32 text-center bg-white">
        <div className="w-20 h-20 bg-blue-50 rounded-[2rem] flex items-center justify-center mx-auto mb-8 text-blue-600">
          <Users size={40} />
        </div>
        <h2 className="text-4xl font-black text-gray-900 tracking-tight mb-3">Find your people.</h2>
        <p className="text-gray-400 mb-8 font-medium leading-relaxed">
          Paste emails or phone numbers to check who’s already on Siddes.
          <span className="block text-[11px] font-bold uppercase tracking-widest text-gray-300 mt-3">We don’t store your address book.</span>
        </p>

        <div className="w-full max-w-md mx-auto space-y-3">
          <textarea
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            placeholder={"Paste emails / phones\n(e.g. marc@gmail.com, +2547..., ...)"}
            className="w-full min-h-[140px] p-4 rounded-3xl border border-gray-100 bg-gray-50 text-sm font-semibold outline-none focus:bg-white focus:border-gray-200"
          />
          {err ? <div className="text-xs font-bold text-rose-600">{err}</div> : null}

          <div className="flex flex-col items-center gap-3">
            <PrimaryButton label="Find Contacts" onClick={runMatch} icon={Search} disabled={!paste.trim()} />
            <button
              onClick={() => setViewState("results")}
              className="py-4 text-xs font-black text-gray-400 uppercase tracking-widest hover:text-gray-900 transition-colors"
            >
              Skip contact matching
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (viewState === "scanning") {
    return (
      <div className="flex flex-col min-h-full px-10 pt-32 text-center bg-white relative pb-12">
        <Toast message={toastMsg} visible={toastOn} />
        <div className="flex-1 flex flex-col items-center justify-center animate-in fade-in duration-500 px-4">
          <div className="relative mb-12">
            <BrainCircuit size={80} className="text-emerald-600 animate-pulse" />
            <div className="absolute inset-0 border-4 border-emerald-100 rounded-full animate-ping opacity-20" />
          </div>
          <h2 className="text-3xl font-black text-gray-900 mb-2 leading-tight">Matching safely...</h2>
          <p className="text-gray-400 font-medium px-4 leading-relaxed">
            We hash identifiers and discard the originals.
            <br />
            We never store your address book.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full px-10 pt-28 text-center bg-white relative pb-12">
      <Toast message={toastMsg} visible={toastOn} />

      <h2 className="text-4xl font-black text-gray-900 tracking-tight mb-2 leading-[0.95]">{heading}</h2>
      <p className="text-gray-400 mb-8 font-medium leading-tight px-4 italic">
        Invite them to your <strong className="text-gray-900">{setName}</strong> Set.
      </p>

      <div className="space-y-3 mb-8">
        <h3 className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] mb-3 text-left px-1">Already on Siddes</h3>

        {primaryList.length ? (
          primaryList.map((u) => (
            <div key={u.handle} className="flex items-center justify-between p-4 bg-gray-50 rounded-[2rem] border border-gray-100">
              <div className="flex items-center gap-3 text-left min-w-0">
                <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden border-2 border-white shadow-sm shrink-0 flex items-center justify-center text-gray-500 font-black">
                  {String(u.name || "?").slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-sm text-gray-900 truncate">{u.name}</div>
                  <div className="text-[10px] text-gray-400 font-black uppercase tracking-tighter truncate">{u.handle}</div>
                </div>
              </div>
              <button
                onClick={() => toggle(u.handle, u.name)}
                className={`p-2.5 rounded-full border transition-all active:scale-90 shadow-sm ${
                  added.has(u.handle) ? "bg-emerald-600 border-transparent text-white" : "bg-white border-gray-200 text-gray-900"
                }`}
              >
                {added.has(u.handle) ? <Check size={18} strokeWidth={4} /> : <UserPlus size={18} strokeWidth={3} />}
              </button>
            </div>
          ))
        ) : (
          <div className="py-8 bg-gray-50 rounded-[2rem] border border-dashed border-gray-200">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">No matches yet</p>
            <p className="text-[11px] text-gray-400 font-semibold mt-1">Try searching handles below, or invite via WhatsApp.</p>
          </div>
        )}
      </div>

      <div className="mb-8">
        <h3 className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] mb-3 text-left px-1">Search handles</h3>
        <div className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3">
          <Search size={18} className="text-gray-300" />
          <input
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Search @username"
            className="flex-1 bg-transparent outline-none text-sm font-semibold text-gray-900 placeholder-gray-300"
          />
        </div>

        {searchItems.length ? (
          <div className="mt-3 space-y-2">
            {searchItems.map((u) => (
              <div key={u.id} className="flex items-center justify-between p-3 bg-white rounded-2xl border border-gray-100">
                <div className="text-left min-w-0">
                  <div className="text-sm font-bold text-gray-900 truncate">{u.username}</div>
                  <div className="text-[11px] font-black text-gray-400 uppercase tracking-widest">{u.handle}</div>
                </div>
                <button
                  onClick={() => toggle(u.handle, u.username)}
                  className={`p-2.5 rounded-full border transition-all active:scale-90 shadow-sm ${
                    added.has(u.handle) ? "bg-emerald-600 border-transparent text-white" : "bg-white border-gray-200 text-gray-900"
                  }`}
                >
                  {added.has(u.handle) ? <Check size={18} strokeWidth={4} /> : <UserPlus size={18} strokeWidth={3} />}
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mb-10">
        <h3 className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] mb-4 text-left px-1">Or Invite via</h3>
        <div className="flex justify-center gap-4">
          <button
            onClick={handleShare}
            className="w-14 h-14 rounded-2xl bg-gray-900 text-white flex items-center justify-center shadow-lg active:scale-90 transition-all hover:bg-gray-800"
          >
            <Share size={24} strokeWidth={3} />
          </button>
          <button
            onClick={openWhatsApp}
            className="w-14 h-14 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg active:scale-90 transition-all hover:bg-emerald-600"
          >
            <MessageSquare size={24} strokeWidth={3} />
          </button>
          <button
            onClick={copyInvite}
            className="w-14 h-14 rounded-2xl bg-gray-100 text-gray-400 flex items-center justify-center shadow-sm active:scale-90 transition-all hover:bg-gray-200"
          >
            <Copy size={24} strokeWidth={3} />
          </button>
        </div>
      </div>

      <div className="space-y-4 px-4 flex flex-col items-center">
        <PrimaryButton
          label={added.size ? `Finished (${added.size})` : "Continue"}
          onClick={() => onContinue({ handles: Array.from(added), contactSyncDone })}
          icon={ArrowRight}
        />
        <button onClick={onSkip} className="text-sm font-bold text-gray-400 hover:text-gray-900 transition-colors uppercase tracking-widest">
          Skip for now
        </button>
      </div>
    </div>
  );
}
