import { Sparkles, Share } from "lucide-react";
import { PrimaryButton } from "@/src/components/onboarding/ui";

export default function RetentionStep({ onFinish, busy }: { onFinish: () => void; busy: boolean }) {
  const isIOS = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);

  return (
    <div className="flex flex-col min-h-full items-center justify-center text-center px-10 bg-white pt-20">
      <div className="mb-12 relative">
        <div className="w-32 h-32 bg-gray-900 rounded-[2.5rem] flex items-center justify-center shadow-2xl relative z-10 animate-bounce">
          <span className="text-5xl font-black text-white tracking-tighter">S</span>
        </div>
        <div className="absolute inset-0 -m-4 border-4 border-dashed border-gray-100 rounded-[3rem] animate-pulse" />
      </div>

      <h2 className="text-4xl font-black text-gray-900 tracking-tight mb-6 leading-[0.95]">Install Siddes.</h2>
      <p className="text-lg text-gray-400 font-medium leading-relaxed mb-12 max-w-xs px-2">
        Add to your Home Screen for faster Side switching and updates.
      </p>

      {isIOS ? (
        <div className="w-full max-w-xs p-6 bg-blue-50 rounded-[2rem] border border-blue-100 text-left mb-8 animate-in zoom-in-95 shadow-sm">
          <p className="text-xs font-bold text-blue-900 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Sparkles size={14} /> iOS Instructions
          </p>
          <ol className="text-sm font-medium text-blue-800 space-y-3 list-decimal pl-4 leading-snug">
            <li>
              Tap the <Share size={16} className="inline mx-1" /> Share icon
            </li>
            <li>
              Scroll down to <strong className="font-black underline">Add to Home Screen</strong>
            </li>
            <li>Open from your home screen</li>
          </ol>
        </div>
      ) : (
        <div className="w-full flex flex-col items-center gap-3">
          <PrimaryButton label={busy ? "Finishing..." : "Add to Home Screen"} onClick={onFinish} themeBg="bg-blue-600" disabled={busy} />
          <p className="text-[10px] font-bold text-gray-400 uppercase">Android & Chrome only</p>
        </div>
      )}

      <button
        onClick={onFinish}
        disabled={busy}
        className={`mt-8 text-sm font-bold uppercase tracking-widest mb-12 transition-colors ${
          busy ? "text-gray-300 cursor-not-allowed" : "text-gray-400 hover:text-gray-900"
        }`}
      >
        I've added it
      </button>
    </div>
  );
}
