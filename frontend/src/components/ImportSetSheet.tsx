"use client";

import React, { useMemo, useState } from "react";
import { ArrowLeft, Check, Contact, X } from "lucide-react";
import { SuggestedSetsSheet } from "@/src/components/SuggestedSetsSheet";
import { getSuggestedSets } from "@/src/lib/setSuggestions";

type Step = "import" | "select" | "name";

type ContactRow = { id: string; name: string; handle: string; matched: boolean };

const MOCK_CONTACTS: ContactRow[] = [
  { id: "c1", name: "Marcus", handle: "@marc_us", matched: true },
  { id: "c2", name: "Sarah J.", handle: "@sara_j", matched: true },
  { id: "c3", name: "Elena Fisher", handle: "@elena", matched: true },
  { id: "c4", name: "Jordan Lee", handle: "@jordan", matched: false },
];

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

export function ImportSetSheet({
  open,
  onClose,
  onFinish,
  onCreateSuggested,
}: {
  open: boolean;
  onClose: () => void;
  onFinish: (payload: { name: string; members: string[] }) => void;
  onCreateSuggested: (payload: { label: string; color: any; members: string[] }) => void;
}) {
  const [step, setStep] = useState<Step>("import");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [setName, setSetName] = useState("Gym Squad");

  const [suggestOpen, setSuggestOpen] = useState(false);

  const selectedHandles = useMemo(() => {
    return MOCK_CONTACTS.filter((c) => selectedIds.includes(c.id)).map((c) => c.handle);
  }, [selectedIds]);

  const matchedHandles = useMemo(() => MOCK_CONTACTS.filter((c) => c.matched).map((c) => c.handle), []);

  const suggestions = useMemo(() => getSuggestedSets(matchedHandles), [matchedHandles]);

  const reset = () => {
    setStep("import");
    setSelectedIds([]);
    setSetName("Gym Squad");
    setSuggestOpen(false);
  };

  const close = () => onClose();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[99] flex items-end justify-center md:items-center">
      <button type="button" className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={close} aria-label="Close" />
      <div className="relative w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-full duration-200">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {step !== "import" ? (
              <button
                type="button"
                onClick={() => setStep(step === "name" ? "select" : "import")}
                className="p-2 rounded-full hover:bg-gray-100"
                aria-label="Back"
              >
                <ArrowLeft size={18} className="text-gray-500" />
              </button>
            ) : (
              <div className="w-10" />
            )}
            <div className="font-bold text-gray-900">
              {step === "import" ? "Find your people" : step === "select" ? "Select people" : "Name this Set"}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              reset();
              close();
            }}
            className="p-2 rounded-full hover:bg-gray-100"
            aria-label="Close"
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {step === "import" ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600">
              <Contact size={32} />
            </div>
            <h3 className="text-xl font-bold mb-2">Sync contacts</h3>
            <p className="text-gray-500 mb-8">
              Find friends and create Sets like “Gym Squad” or “Weekend Crew”.
            </p>
            <button
              type="button"
              onClick={() => {
                // After sync, show suggested sets first (user controlled)
                if (suggestions.length) setSuggestOpen(true);
                else setStep("select");
              }}
              className="w-full py-3 rounded-full bg-blue-600 text-white font-bold text-lg mb-3"
            >
              Sync Contacts
            </button>
            <button type="button" onClick={close} className="text-gray-400 text-sm font-medium">
              Not now
            </button>
          </div>
        ) : null}

        {step === "select" ? (
          <>
            <div className="p-2 max-h-[60vh] overflow-y-auto">
              {MOCK_CONTACTS.map((c) => {
                const selected = selectedIds.includes(c.id);
                const disabled = !c.matched;
                return (
                  <button
                    key={c.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      if (disabled) return;
                      setSelectedIds((prev) =>
                        prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id]
                      );
                    }}
                    className={cn("w-full flex items-center gap-3 p-3 rounded-xl text-left", disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-50")}
                  >
                    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center font-bold", selected ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-600")}>
                      {selected ? <Check size={20} /> : c.name.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">{c.name}</div>
                      <div className="text-xs text-gray-400">{c.matched ? `${c.handle} • On Siddes` : "Invite"}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="p-4 border-t border-gray-100">
              <button
                type="button"
                disabled={selectedIds.length === 0}
                onClick={() => setStep("name")}
                className={cn("w-full py-3 rounded-full bg-blue-600 text-white font-bold", selectedIds.length === 0 ? "opacity-50" : "hover:opacity-95")}
              >
                Continue ({selectedIds.length})
              </button>
            </div>
          </>
        ) : null}

        {step === "name" ? (
          <div className="p-6">
            <p className="text-sm text-gray-500 text-center mb-3">Selected {selectedHandles.length} people</p>

            <input
              type="text"
              value={setName}
              onChange={(e) => setSetName(e.target.value)}
              className="w-full text-center text-2xl font-bold border-b-2 border-blue-600 outline-none pb-2 mb-8"
              autoFocus
            />

            <div className="flex gap-2 justify-center mb-8 flex-wrap">
              {["Weekend Crew", "Family", "Colleagues", "Gym Squad"].map((n) => (
                <button key={n} type="button" onClick={() => setSetName(n)} className="px-3 py-1 bg-gray-100 rounded-full text-xs font-bold hover:bg-gray-200">
                  {n}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                onFinish({ name: setName.trim() || "New Set", members: selectedHandles });
                reset();
                close();
              }}
              className="w-full py-3 rounded-full bg-blue-600 text-white font-bold"
            >
              Create Set
            </button>
          </div>
        ) : null}

        <SuggestedSetsSheet
          open={suggestOpen}
          onClose={() => {
            setSuggestOpen(false);
            setStep("select");
          }}
          suggestions={suggestions}
          onAccept={(s) => {
            onCreateSuggested({ label: s.label, color: s.color, members: s.members });
          }}
          onSkip={(id) => {
            // no-op; still allow other suggestions
          }}
        />
      </div>
    </div>
  );
}
