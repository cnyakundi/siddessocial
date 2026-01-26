"use client";

import React, { useEffect, useMemo, useState } from "react";
import { BellRing, Save } from "lucide-react";
import { toast } from "@/src/lib/toast";

// sd_743_push_prefs_ui
type PushPrefs = {
  enabled: boolean;
  types: { mention: boolean; reply: boolean; like: boolean; echo: boolean; other: boolean };
  sides: { public: boolean; friends: boolean; close: boolean; work: boolean };
};

const DEFAULT_PREFS: PushPrefs = {
  enabled: true,
  types: { mention: true, reply: true, like: true, echo: true, other: true },
  sides: { public: true, friends: true, close: true, work: true },
};

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      className={
        "w-full flex items-center justify-between rounded-xl border px-3 py-2 text-sm " +
        (value ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white text-gray-900")
      }
      onClick={() => onChange(!value)}
    >
      <span className="font-semibold">{label}</span>
      <span className="text-xs opacity-80">{value ? "On" : "Off"}</span>
    </button>
  );
}

export function PushPreferencesCard() {
  const [prefs, setPrefs] = useState<PushPrefs>(DEFAULT_PREFS);
  const [busy, setBusy] = useState(false);
  const [restricted, setRestricted] = useState(false);

  const supported = useMemo(() => typeof window !== "undefined", []);

  useEffect(() => {
    if (!supported) return;
    (async () => {
      try {
        const res = await fetch("/api/push/prefs", { method: "GET" });
        const data = await res.json().catch(() => ({}));
        if (data?.restricted) setRestricted(true);
        if (data?.prefs) setPrefs(data.prefs);
      } catch {}
    })();
  }, [supported]);

  async function save() {
    setBusy(true);
    try {
      const res = await fetch("/api/push/prefs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prefs }),
      });
      const data = await res.json().catch(() => ({}));
      if (data?.restricted) toast.error("Could not save prefs (restricted viewer).");
      else toast.success("Saved push preferences.");
      if (data?.prefs) setPrefs(data.prefs);
    } catch {
      toast.error("Save failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
            <BellRing className="h-4 w-4" />
            Push preferences
          </div>
          <div className="mt-1 text-xs text-gray-600">
            Control which events and Sides can send push.
            {restricted ? <span className="ml-2 text-rose-600 font-semibold">Restricted</span> : null}
          </div>
        </div>

        <button
          type="button"
          disabled={busy}
          className={
            "px-3 py-2 rounded-full text-xs font-bold flex items-center gap-2 " +
            (busy ? "bg-gray-100 text-gray-400" : "bg-gray-900 text-white hover:opacity-90")
          }
          onClick={save}
        >
          <Save className="h-4 w-4" />
          Save
        </button>
      </div>

      <div className="mt-3 space-y-3">
        <Toggle label="All push notifications" value={prefs.enabled} onChange={(v) => setPrefs({ ...prefs, enabled: v })} />

        <div className="text-xs font-bold text-gray-500">Types</div>
        <div className="grid grid-cols-2 gap-2">
          <Toggle label="Mentions" value={prefs.types.mention} onChange={(v) => setPrefs({ ...prefs, types: { ...prefs.types, mention: v } })} />
          <Toggle label="Replies" value={prefs.types.reply} onChange={(v) => setPrefs({ ...prefs, types: { ...prefs.types, reply: v } })} />
          <Toggle label="Likes" value={prefs.types.like} onChange={(v) => setPrefs({ ...prefs, types: { ...prefs.types, like: v } })} />
          <Toggle label="Echoes" value={prefs.types.echo} onChange={(v) => setPrefs({ ...prefs, types: { ...prefs.types, echo: v } })} />
          <Toggle label="Other" value={prefs.types.other} onChange={(v) => setPrefs({ ...prefs, types: { ...prefs.types, other: v } })} />
        </div>

        <div className="text-xs font-bold text-gray-500 mt-2">Sides</div>
        <div className="grid grid-cols-2 gap-2">
          <Toggle label="Public" value={prefs.sides.public} onChange={(v) => setPrefs({ ...prefs, sides: { ...prefs.sides, public: v } })} />
          <Toggle label="Friends" value={prefs.sides.friends} onChange={(v) => setPrefs({ ...prefs, sides: { ...prefs.sides, friends: v } })} />
          <Toggle label="Close" value={prefs.sides.close} onChange={(v) => setPrefs({ ...prefs, sides: { ...prefs.sides, close: v } })} />
          <Toggle label="Work" value={prefs.sides.work} onChange={(v) => setPrefs({ ...prefs, sides: { ...prefs.sides, work: v } })} />
        </div>
      </div>
    </div>
  );
}
