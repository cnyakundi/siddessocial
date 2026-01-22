import { Check, Globe, Users, Lock, Briefcase, type LucideIcon } from "lucide-react";
import type { SideId } from "@/src/lib/sides";
import { SIDE_ORDER, SIDES, SIDE_THEMES } from "@/src/lib/sides";
import { SIDE_UX } from "@/src/lib/sideUx";
import { PrimaryButton } from "@/src/components/onboarding/ui";

const SIDE_ICON: Record<SideId, LucideIcon> = {
  public: Globe,
  friends: Users,
  close: Lock,
  work: Briefcase,
};

export default function SidesExplainerStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col min-h-full items-center justify-center text-center px-6 pt-24 pb-12">
      <h2 className="text-4xl font-black text-gray-900 tracking-tight mb-10 leading-tight">
        One Identity,
        <br />4 Sides.
      </h2>

      <div className="grid grid-cols-1 gap-3 w-full max-w-xs mb-12">
        {SIDE_ORDER.map((id) => {
          const theme = SIDE_THEMES[id];
          const Icon = SIDE_ICON[id];
          return (
            <div key={id} className={`flex items-center gap-4 p-4 rounded-3xl border transition-all ${theme.lightBg} ${theme.border}`}>
              <div className={`p-2.5 rounded-2xl ${theme.primaryBg} text-white shrink-0`}>
                <Icon size={20} strokeWidth={3} />
              </div>
              <div className="text-left">
                <div className={`font-black text-sm uppercase tracking-widest ${theme.text}`}>{SIDES[id].label}</div>
                <div className="text-[11px] text-gray-600 font-semibold leading-tight">{SIDE_UX[id].meaning}</div>
                <div className="text-[10px] text-gray-400 font-bold leading-tight mt-0.5">{SIDES[id].privacyHint}</div>
              </div>
            </div>
          );
        })}
      </div>

      <PrimaryButton label="Got it" onClick={onNext} icon={Check} />
    </div>
  );
}
