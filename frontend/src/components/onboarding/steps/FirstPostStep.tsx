import { useState } from "react";
import { Camera, Globe, Users, Star, Lock, Briefcase, type LucideIcon } from "lucide-react";
import type { SideId } from "@/src/lib/sides";
import { SIDES, SIDE_THEMES } from "@/src/lib/sides";

type PostCreateResp = { ok: boolean; item?: unknown; error?: string };

const SIDE_ICON: Record<SideId, LucideIcon> = {
  public: Globe,
  friends: Users,
  // sd_749_pwa_notifs_nav: Close = Inner Circle (Star)
  close: Star,
  work: Briefcase,
};

export default function FirstPostStep({
  setInfo,
  onPosted,
  onSkip,
  busy,
}: {
  setInfo: { id: string; name: string; side: SideId };
  onPosted: () => void;
  onSkip?: () => void;
  busy?: boolean;
}) {
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const theme = SIDE_THEMES[setInfo.side || "friends"];
  const SideIcon = SIDE_ICON[setInfo.side || "friends"];
  const finishing = Boolean(busy);

  async function post() {
    const v = String(text || "").trim();
    if (!v || posting || finishing) return;
    setErr(null);
    setPosting(true);
    try {
      const r = await fetch("/api/post", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: v, setId: setInfo.id, side: setInfo.side }),
      });
      const d = (await r.json().catch(() => ({}))) as PostCreateResp;
      if (r.ok && d?.ok) {
        onPosted();
        return;
      }
      setErr(d?.error ? String(d.error) : "Could not post");
    } catch {
      setErr("Could not post");
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className={`flex flex-col min-h-full ${theme.primaryBg} transition-colors p-8 animate-in fade-in duration-700 pb-12`}>
      <div className="mt-16 mb-8 shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div className="text-center md:text-left">
            <h2 className="text-5xl font-black text-white tracking-tight mb-2 leading-[0.85]">First Take</h2>
            <p className="text-white/80 font-bold text-lg">Post your first context-safe update.</p>
          </div>

          {onSkip ? (
            <button
              onClick={onSkip}
              disabled={posting || finishing}
              className={`text-[10px] font-black uppercase tracking-widest transition-colors ${posting || finishing ? "text-white/20 cursor-not-allowed" : "text-white/70 hover:text-white"}`}
              aria-label="Skip"
            >
              Skip
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex-1 bg-white rounded-[3.5rem] p-8 shadow-2xl flex flex-col animate-in slide-in-from-bottom-10 duration-500 overflow-hidden">
        <div className="flex gap-2 mb-8 flex-wrap">
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border ${theme.lightBg} ${theme.text} ${theme.border} text-[10px] font-black uppercase tracking-widest shadow-sm`}>
            <SideIcon size={12} strokeWidth={3} /> {SIDES[setInfo.side].label}
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-gray-100 bg-gray-50 text-gray-500 text-[10px] font-black uppercase tracking-widest shadow-sm">
            {setInfo.name}
          </div>
        </div>

        <textarea
          autoFocus
          placeholder={`Say hi to ${setInfo.name}...`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="flex-1 w-full text-2xl font-bold text-gray-900 placeholder-gray-100 outline-none resize-none leading-relaxed no-scrollbar"
        />

        {err ? <div className="mt-3 text-xs font-bold text-rose-600">{err}</div> : null}

        <div className="flex justify-between items-center pt-6 border-t border-gray-50 shrink-0">
          <button type="button" className="p-3 bg-gray-50 rounded-2xl text-gray-400 hover:text-gray-900 transition-colors" aria-label="Add media">
            <Camera size={24} />
          </button>
          <button
            type="button"
            onClick={post}
            disabled={!text.trim() || posting || finishing}
            className={`px-8 py-3 rounded-2xl font-black text-sm uppercase tracking-widest transition-all ${
              text.trim() && !posting && !finishing ? `${theme.primaryBg} text-white shadow-xl hover:scale-105 active:scale-95` : "bg-gray-100 text-gray-300 cursor-not-allowed"
            }`}
          >
            {posting ? "Posting..." : finishing ? "Finishing..." : "Post"}
          </button>
        </div>
      </div>
    </div>
  );
}
