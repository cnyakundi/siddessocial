import { ArrowRight, Globe, Users, Heart, Lock, Briefcase, type LucideIcon } from "lucide-react";
import type { SideId } from "@/src/lib/sides";
import { SIDE_ORDER, SIDES, SIDE_THEMES } from "@/src/lib/sides";
import { SIDE_UX } from "@/src/lib/sideUx";
import { PrimaryButton } from "@/src/components/onboarding/ui";

const SIDE_ICON: Record<SideId, LucideIcon> = {
  public: Globe,
  friends: Users,
  // sd_749_pwa_notifs_nav: Close = Inner Circle (Heart)
  close: Heart,
  work: Briefcase,
};

export default function WelcomeStep({
  onNext,
  onShowPrivacy,
  needsAgeGate,
  minAge,
  ageOk,
  setAgeOk,
  ageBusy,
  ageErr,
}: {
  onNext: () => void;
  onShowPrivacy: () => void;
  needsAgeGate: boolean;
  minAge: number;
  ageOk: boolean;
  setAgeOk: (v: boolean) => void;
  ageBusy: boolean;
  ageErr: string | null;
}) {
  return (
    <div className="flex flex-col min-h-full items-center justify-center text-center px-6 pt-16 pb-12 animate-in fade-in zoom-in-95 duration-700">
      <div className="w-20 h-20 bg-gray-900 rounded-[2rem] flex items-center justify-center shadow-2xl mb-8">
        <span className="text-3xl font-black text-white tracking-tighter">S</span>
      </div>

      <h1 className="text-4xl font-black text-gray-900 tracking-tight mb-3 leading-[0.95]">Siddes</h1>
      <p className="text-base text-gray-500 font-semibold leading-relaxed mb-7 max-w-sm">
        Keep your worlds separate.
        <br />
        Switch Sides. No audience mistakes.
      </p>

      {/* Side preview (zero-tap learning) */}
      <div className="grid grid-cols-1 gap-2 w-full max-w-xs mb-7">
        {SIDE_ORDER.map((id) => {
          const theme = SIDE_THEMES[id];
          const Icon = SIDE_ICON[id];
          return (
            <div key={id} className={`flex items-center gap-3 p-3 rounded-3xl border ${theme.lightBg} ${theme.border}`}>
              <div className={`p-2.5 rounded-2xl ${theme.primaryBg} text-white shrink-0`}>
                <Icon size={18} strokeWidth={3} />
              </div>
              <div className="text-left">
                <div className={`font-black text-[10px] uppercase tracking-widest ${theme.text}`}>{SIDES[id].label}</div>
                <div className="text-[11px] text-gray-600 font-semibold leading-tight">{SIDE_UX[id]?.meaning}</div>
              </div>
            </div>
          );
        })}
      </div>

      {needsAgeGate ? (
        <div className="w-full max-w-xs mb-6 text-left">
          <label className="flex items-start gap-2 text-xs text-gray-600">
            <input type="checkbox" className="mt-0.5" checked={ageOk} onChange={(e) => setAgeOk(e.target.checked)} />
            <span>
              I confirm I'm at least <strong>{minAge}</strong> years old (or the minimum age required in my country).
            </span>
          </label>
          {ageErr ? <div className="mt-2 text-xs font-bold text-rose-600">{ageErr}</div> : null}
        </div>
      ) : null}

      <div className="w-full flex flex-col items-center gap-4">
        <PrimaryButton
          label={ageBusy ? "One sec..." : "Get started"}
          onClick={onNext}
          icon={ArrowRight}
          disabled={ageBusy || (needsAgeGate && !ageOk)}
        />

        <button
          onClick={onShowPrivacy}
          className="text-[10px] font-black text-gray-300 uppercase tracking-widest hover:text-gray-900 transition-colors"
        >
          How privacy works
        </button>
      </div>
    </div>
  );
}
