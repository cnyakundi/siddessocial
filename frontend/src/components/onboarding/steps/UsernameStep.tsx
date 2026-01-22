import { ArrowRight } from "lucide-react";
import { PrimaryButton } from "@/src/components/onboarding/ui";

export default function UsernameStep({
  value,
  setValue,
  busy,
  msg,
  onNext,
}: {
  value: string;
  setValue: (v: string) => void;
  busy: boolean;
  msg: string | null;
  onNext: () => void;
}) {
  const v = String(value || "").trim().toLowerCase();
  const isValid = /^[a-z0-9_]{3,24}$/.test(v);

  return (
    <div className="flex flex-col min-h-full items-center justify-center text-center px-10">
      <h2 className="text-4xl font-black text-gray-900 tracking-tight mb-4 leading-none">Choose your handle.</h2>
      <p className="text-gray-400 mb-12 font-medium uppercase tracking-widest text-xs">How people find you</p>

      <div className="w-full max-w-xs mb-16 relative">
        <div className="absolute left-0 bottom-6 text-3xl font-black text-gray-300">@</div>
        <input
          autoFocus
          type="text"
          placeholder="username"
          value={v}
          onChange={(e) => setValue(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24))}
          className="w-full text-center text-4xl font-black bg-transparent border-b-4 border-gray-100 focus:border-blue-600 outline-none pb-4 transition-colors placeholder-gray-100 pl-8"
        />
        {v ? (
          <div
            className={`absolute -bottom-10 left-1/2 -translate-x-1/2 text-xs font-bold uppercase tracking-widest ${
              isValid ? "text-emerald-500" : "text-rose-500"
            }`}
          >
            {isValid ? "✓ Looks good" : "3–24 chars (a-z, 0-9, _)"}
          </div>
        ) : null}
      </div>

      {msg ? <div className="mb-4 text-xs font-bold text-rose-600">{msg}</div> : null}

      <PrimaryButton label={busy ? "Saving..." : "Continue"} onClick={onNext} disabled={!isValid || busy} icon={ArrowRight} />
    </div>
  );
}
