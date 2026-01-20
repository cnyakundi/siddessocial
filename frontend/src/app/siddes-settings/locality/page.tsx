"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type MeResp = {
  ok: boolean;
  authenticated?: boolean;
  locality?: { detectedRegion?: string; chosenRegion?: string; region?: string };
  ageGateConfirmed?: boolean;
  minAge?: number;
};

export default function LocalitySettingsPage() {
  const [me, setMe] = useState<MeResp | null>(null);
  const [regionChoice, setRegionChoice] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [ageOk, setAgeOk] = useState(false);
  const [ageBusy, setAgeBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const ageConfirmed = !!me?.ageGateConfirmed;
  const minAge = typeof me?.minAge === "number" && (me.minAge || 0) > 0 ? (me.minAge as number) : 13;

  const detected = useMemo(() => String(me?.locality?.detectedRegion || "").trim(), [me]);
  const chosen = useMemo(() => String(me?.locality?.chosenRegion || "").trim(), [me]);

  async function refreshMe() {
    try {
      const r = await fetch("/api/auth/me", { cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      setMe(d);
      const seed = String(d?.locality?.chosenRegion || d?.locality?.detectedRegion || "").trim();
      setRegionChoice((prev) => (prev ? prev : seed));
    } catch {
      setMe({ ok: true, authenticated: false });
    }
  }

  useEffect(() => {
    refreshMe();
  }, []);

  async function saveRegion() {
    setMsg(null);
    setBusy(true);
    try {
      const region = String(regionChoice || "").trim().toUpperCase();
      const res = await fetch("/api/auth/region", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ region }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data?.error ? String(data.error) : "Region update failed");
      } else {
        setMsg(region ? "Region saved." : "Using detected region.");
        await refreshMe();
      }
    } catch {
      setMsg("Network error updating region.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmAge() {
    setMsg(null);
    if (ageConfirmed) return;
    if (!ageOk) {
      setMsg("Please confirm the checkbox first.");
      return;
    }

    setAgeBusy(true);
    try {
      const res = await fetch("/api/auth/age/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmed: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data?.error ? String(data.error) : "Age confirmation failed");
      } else {
        setMsg("Age confirmed.");
        await refreshMe();
      }
    } catch {
      setMsg("Network error confirming age.");
    } finally {
      setAgeBusy(false);
    }
  }

  if (me && !me.authenticated) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl p-6 shadow-sm text-center">
          <div className="text-xl font-black text-gray-900">Sign in first</div>
          <p className="text-sm text-gray-500 mt-2">These settings are tied to your account.</p>
          <Link
            href="/login"
            className="inline-block mt-5 rounded-full bg-gray-900 text-white text-sm font-bold px-6 py-2.5 hover:bg-gray-800"
          >
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-bold text-gray-900">Region & Age</div>
          <div className="text-xs text-gray-500 mt-1">Used only for defaults. Never a hard lock.</div>
        </div>
        <Link href="/siddes-settings" className="text-xs font-bold text-gray-700 hover:underline">
          Back
        </Link>
      </div>

      <div className="p-4 rounded-2xl border border-gray-200 bg-white">
        <div className="text-xs font-bold uppercase tracking-widest text-gray-500">Region</div>
        <div className="text-xs text-gray-500 mt-2">
          Detected: <span className="font-semibold text-gray-700">{detected || "Unknown"}</span>
          {chosen ? (
            <>
              {" "}• Chosen: <span className="font-semibold text-gray-700">{chosen}</span>
            </>
          ) : null}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <select
            value={regionChoice}
            onChange={(e) => setRegionChoice(String(e.target.value || ""))}
            className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-800 outline-none focus:bg-white focus:border-gray-300"
          >
            <option value="">Use detected</option>
            <option value="KE">KE - Kenya</option>
            <option value="UG">UG - Uganda</option>
            <option value="TZ">TZ - Tanzania</option>
            <option value="RW">RW - Rwanda</option>
            <option value="ET">ET - Ethiopia</option>
            <option value="NG">NG - Nigeria</option>
            <option value="GH">GH - Ghana</option>
            <option value="ZA">ZA - South Africa</option>
            <option value="EG">EG - Egypt</option>
            <option value="IN">IN - India</option>
            <option value="US">US - United States</option>
            <option value="GB">GB - United Kingdom</option>
            <option value="CA">CA - Canada</option>
            <option value="DE">DE - Germany</option>
            <option value="FR">FR - France</option>
            <option value="BR">BR - Brazil</option>
            <option value="AU">AU - Australia</option>
            <option value="JP">JP - Japan</option>
          </select>

          <button
            type="button"
            onClick={saveRegion}
            disabled={busy}
            className={
              "rounded-full px-4 py-2 text-xs font-extrabold border " +
              (busy ? "bg-gray-100 text-gray-400 border-gray-200" : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50")
            }
          >
            {busy ? "Saving..." : "Save"}
          </button>
        </div>

        <div className="mt-2 text-[11px] text-gray-400">Region only affects defaults (language/help/safety/perf).</div>
      </div>

      <div className="mt-3 p-4 rounded-2xl border border-gray-200 bg-white">
        <div className="text-xs font-bold uppercase tracking-widest text-gray-500">Age</div>
        {ageConfirmed ? (
          <div className="text-sm text-gray-700 mt-2">Confirmed (min age {minAge}+).</div>
        ) : (
          <div className="mt-2">
            <label className="flex items-start gap-2 text-xs text-gray-600">
              <input type="checkbox" className="mt-0.5" checked={ageOk} onChange={(e) => setAgeOk(e.target.checked)} />
              <span>I confirm I'm at least {minAge} years old (or the minimum age required in my country).</span>
            </label>

            <button
              type="button"
              onClick={confirmAge}
              disabled={!ageOk || ageBusy}
              className={
                "mt-2 rounded-full px-4 py-2 text-xs font-extrabold border " +
                (!ageOk || ageBusy
                  ? "bg-gray-100 text-gray-400 border-gray-200"
                  : "bg-gray-900 text-white border-gray-900 hover:opacity-90")
              }
            >
              {ageBusy ? "Confirming..." : "Confirm"}
            </button>
          </div>
        )}
      </div>

      {msg ? <div className="mt-3 text-xs font-semibold text-gray-700">{msg}</div> : null}
    </div>
  );
}
