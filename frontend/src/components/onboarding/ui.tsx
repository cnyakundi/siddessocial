import type { ReactNode } from "react";
import { ArrowLeft, type LucideIcon } from "lucide-react";

export function ProgressDots({ step, total }: { step: number; total: number }) {
  return (
    <nav className="fixed top-12 left-0 right-0 px-10 flex items-center justify-center gap-3 z-[60] transition-opacity duration-500">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-500 ${
            step === i + 1 ? "w-8 bg-gray-900 shadow-sm" : i + 1 < step ? "w-2 bg-gray-900/20" : "w-2 bg-gray-100"
          }`}
        />
      ))}
    </nav>
  );
}

export function PrimaryButton({
  label,
  onClick,
  disabled,
  icon: Icon,
  themeBg = "bg-gray-900",
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  icon?: LucideIcon;
  themeBg?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!!disabled}
      className={`w-full max-w-xs py-6 ${themeBg} text-white rounded-[2.5rem] font-black text-xl shadow-2xl transition-all flex items-center justify-center gap-3 ${
        disabled ? "opacity-20 grayscale cursor-not-allowed" : "hover:scale-105 active:scale-95"
      }`}
    >
      {label} {Icon ? <Icon size={24} strokeWidth={3} /> : null}
    </button>
  );
}

export function StepWrapper({
  children,
  active,
  onBack,
}: {
  children: ReactNode;
  active: boolean;
  onBack?: () => void;
}) {
  return (
    <div
      className={`fixed inset-0 bg-white flex flex-col transition-all duration-500 ease-out ${
        active ? "translate-x-0 opacity-100 z-30" : "translate-x-full opacity-0 z-0 pointer-events-none"
      }`}
    >
      {onBack ? (
        <button
          onClick={onBack}
          className="absolute top-12 left-6 p-2 text-gray-400 hover:text-gray-900 transition-colors z-[80] rounded-full hover:bg-gray-50"
        >
          <ArrowLeft size={24} />
        </button>
      ) : null}
      <div className="flex-1 overflow-y-auto no-scrollbar pb-32">{children}</div>
    </div>
  );
}

export function Toast({ message, visible }: { message: string; visible: boolean }) {
  return (
    <div
      className={`fixed top-24 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full text-xs font-bold transition-all z-[100] shadow-2xl border border-white/10 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4 pointer-events-none"
      }`}
    >
      {message}
    </div>
  );
}
