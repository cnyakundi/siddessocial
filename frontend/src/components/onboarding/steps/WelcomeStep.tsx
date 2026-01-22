import { ArrowRight } from "lucide-react";
import { PrimaryButton } from "@/src/components/onboarding/ui";

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
    <div className="flex flex-col min-h-full items-center justify-center text-center px-10 animate-in fade-in zoom-in-95 duration-700">
      <div className="w-24 h-24 bg-gray-900 rounded-[2.2rem] flex items-center justify-center shadow-2xl mb-12 animate-bounce">
        <span className="text-4xl font-black text-white tracking-tighter">S</span>
      </div>
      <h1 className="text-5xl font-black text-gray-900 tracking-tight mb-4 leading-[0.9]">Siddes.</h1>
      <p className="text-xl text-gray-400 font-medium leading-relaxed mb-10 max-w-xs">
        Four safe Sides for your life. <br />
        No context collapse.
      </p>

      {needsAgeGate ? (
        <div className="w-full max-w-xs mb-8 text-left">
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
          label={ageBusy ? "One sec..." : "Enter Siddes"}
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
