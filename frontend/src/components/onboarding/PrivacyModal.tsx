import { CheckCircle2, Shield, X } from "lucide-react";

export default function PrivacyModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
      <div className="bg-white rounded-[3rem] p-10 w-full max-w-sm relative animate-in zoom-in-95">
        <button onClick={onClose} className="absolute top-8 right-8 text-gray-300 hover:text-gray-900">
          <X size={24} />
        </button>
        <Shield size={48} className="text-emerald-500 mb-8" />
        <h3 className="text-2xl font-black mb-4">Sovereign Privacy</h3>
        <ul className="space-y-4 text-gray-500 font-medium text-sm leading-relaxed">
          <li className="flex gap-3">
            <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5" />
            <span>We don’t import your full address book. You choose what to share (e.g., paste a few emails/phones) and we use it only to look for matches.</span>
          </li>
          <li className="flex gap-3">
            <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5" />
            <span>We only use the identifiers you provide to check who’s already on Siddes. No vibe meters, no guessing.</span>
          </li>
          <li className="flex gap-3">
            <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5" />
            <span>Your contexts are siloed by design. Close doesn’t leak to Public.</span>
          </li>
        </ul>
        <button onClick={onClose} className="w-full mt-10 py-4 bg-gray-900 text-white rounded-2xl font-bold uppercase tracking-widest text-xs">
          Got it
        </button>
      </div>
    </div>
  );
}
