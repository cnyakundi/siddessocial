import { ArrowRight, Briefcase, Heart, Lock } from "lucide-react";
import type { SideId } from "@/src/lib/sides";
import { SIDES, SIDE_THEMES } from "@/src/lib/sides";
import { PrimaryButton } from "@/src/components/onboarding/ui";
import { useState } from "react";

export default function CreateFirstSetStep({
  onCreate,
  onSkip,
  busy,
  msg,
}: {
  onCreate: (info: { side: SideId; name: string }) => void;
  onSkip?: () => void;
  busy: boolean;
  msg: string | null;
}) {
  const [selectedSide, setSelectedSide] = useState<SideId>("friends");
  const [setName, setSetName] = useState("");

  const templates: Array<{ id: string; icon: any; label: string }> = [
    { id: "Family", icon: Lock, label: "Family" },
    { id: "Besties", icon: Heart, label: "Besties" },
    { id: "Project Team", icon: Briefcase, label: "Project" },
  ];

  const can = !!setName.trim() && !busy;

  return (
    <div className="flex flex-col min-h-full px-10 pt-28 text-center pb-12">
      <h2 className="text-4xl font-black text-gray-900 tracking-tight mb-3 leading-tight">Create your first Circle</h2>
      <p className="text-gray-500 mb-10 font-semibold leading-relaxed">
        A Set is a private room inside a Side.
        <br />
        You can add people later.
      </p>

      <div className="space-y-4 mb-8">
        <div className="flex gap-2 justify-center">
          {(["friends", "close", "work"] as SideId[]).map((side) => {
            const theme = SIDE_THEMES[side];
            return (
              <button
                key={side}
                onClick={() => setSelectedSide(side)}
                className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${
                  selectedSide === side ? `${theme.primaryBg} text-white border-transparent shadow-md` : "bg-white text-gray-400 border-gray-100"
                }`}
              >
                {SIDES[side].label}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-3 gap-3">
          {templates.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setSetName(t.id)}
                className={`p-4 rounded-3xl border flex flex-col items-center gap-2 transition-all ${
                  setName === t.id ? "border-gray-900 bg-gray-50 shadow-sm" : "border-gray-100 bg-white hover:border-gray-200"
                }`}
              >
                <Icon size={20} className={setName === t.id ? "text-gray-900" : "text-gray-300"} />
                <span className={`text-[10px] font-bold uppercase ${setName === t.id ? "text-gray-900" : "text-gray-400"}`}>{t.label}</span>
              </button>
            );
          })}
        </div>

        <input
          type="text"
          placeholder="Set name (e.g. Gym Crew)"
          value={setName}
          onChange={(e) => setSetName(e.target.value)}
          className="w-full p-5 bg-gray-50 border border-gray-100 rounded-2xl text-center font-bold outline-none focus:bg-white focus:border-gray-200 transition-all"
        />
      </div>

      {msg ? <div className="mb-4 text-xs font-bold text-rose-600">{msg}</div> : null}

      <div className="flex flex-col items-center gap-4">
        <PrimaryButton
          label={busy ? "Creating..." : "Create Circle"}
          onClick={() => onCreate({ side: selectedSide, name: setName.trim() })}
          disabled={!can}
          icon={ArrowRight}
        />

        {onSkip ? (
          <button
            onClick={onSkip}
            disabled={busy}
            className={`text-[10px] font-black uppercase tracking-widest transition-colors ${busy ? "text-gray-300 cursor-not-allowed" : "text-gray-400 hover:text-gray-900"}`}
          >
            Skip for now
          </button>
        ) : null}
      </div>
    </div>
  );
}
