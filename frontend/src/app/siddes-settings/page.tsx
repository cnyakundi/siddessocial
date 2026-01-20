"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

type SettingsState = {
  inAppAlerts: boolean;
  pushNotifications: boolean;
  emailDigests: boolean;
};

const KEY = "sd.settings.v1";

function safeParse(v: string | null): SettingsState | null {
  if (!v) return null;
  try {
    const o = JSON.parse(v);
    if (
      typeof o === "object" &&
      o &&
      typeof o.inAppAlerts === "boolean" &&
      typeof o.pushNotifications === "boolean" &&
      typeof o.emailDigests === "boolean"
    ) {
      return o as SettingsState;
    }
  } catch {
    // ignore
  }
  return null;
}

function loadSettings(): SettingsState {
  if (typeof window === "undefined") {
    return { inAppAlerts: true, pushNotifications: false, emailDigests: false };
  }
  const v = window.localStorage.getItem(KEY);
  return safeParse(v) ?? { inAppAlerts: true, pushNotifications: false, emailDigests: false };
}

function saveSettings(s: SettingsState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(s));
}

function ToggleRow({
  label,
  desc,
  value,
  onChange,
}: {
  label: string;
  desc: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 p-4 rounded-2xl border border-gray-200 bg-white">
      <div>
        <div className="text-sm font-bold text-gray-900">{label}</div>
        <div className="text-xs text-gray-500 mt-1">{desc}</div>
      </div>

      <button
        type="button"
        onClick={() => onChange(!value)}
        aria-pressed={value}
        className={`w-12 h-7 rounded-full p-1 transition-all border ${
          value ? "bg-gray-900 border-gray-900" : "bg-gray-100 border-gray-200"
        }`}
      >
        <div className={`w-5 h-5 rounded-full bg-white transition-all ${value ? "translate-x-5" : ""}`} />
      </button>
    </div>
  );
}

export default function SiddesSettingsPage() {
  const [s, setS] = useState<SettingsState>(() => ({ inAppAlerts: true, pushNotifications: false, emailDigests: false }));

  useEffect(() => {
    setS(loadSettings());
  }, []);

  useEffect(() => {
    saveSettings(s);
  }, [s]);

  return (
    <div className="px-4 py-6">
      <div className="mb-4">
        <div className="text-sm font-bold text-gray-900">Settings</div>
        <div className="text-xs text-gray-500 mt-1">Preferences are saved on this device.</div>
      </div>

      <div className="flex flex-col gap-3" data-testid="settings-page">
        <ToggleRow
          label="In-app Alerts"
          desc="Show alerts inside Siddes (mentions, replies, invites)."
          value={s.inAppAlerts}
          onChange={(next) => setS((cur) => ({ ...cur, inAppAlerts: next }))}
        />
                <Link href="/siddes-settings/appeals" className="block">
          <div className="mt-2 flex items-center justify-between gap-4 p-4 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50">
            <div>
              <div className="text-sm font-bold text-gray-900">Appeals</div>
              <div className="text-xs text-gray-500 mt-1">Request review of a restriction or takedown.</div>
            </div>
            <div className="text-xs font-extrabold text-gray-700">Open</div>
          </div>
        </Link>

        <Link href="/siddes-settings/locality" className="block" data-testid="settings-locality-link">
          <div className="mt-2 flex items-center justify-between gap-4 p-4 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50">
            <div>
              <div className="text-sm font-bold text-gray-900">Region & Age</div>
              <div className="text-xs text-gray-500 mt-1">Locality defaults and age confirmation.</div>
            </div>
            <div className="text-xs font-extrabold text-gray-700">Open</div>
          </div>
        </Link>
<Link href="/siddes-settings/blocked" className="block">
          <div className="mt-2 flex items-center justify-between gap-4 p-4 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50">
            <div>
              <div className="text-sm font-bold text-gray-900">Blocked users</div>
              <div className="text-xs text-gray-500 mt-1">Manage who you've blocked.</div>
            </div>
            <div className="text-xs font-extrabold text-gray-700">Open</div>
          </div>
        </Link>

        <Link href="/siddes-settings/muted" className="block">
          <div className="mt-2 flex items-center justify-between gap-4 p-4 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50">
            <div>
              <div className="text-sm font-bold text-gray-900">Muted users</div>
              <div className="text-xs text-gray-500 mt-1">Manage who you've muted.</div>
            </div>
            <div className="text-xs font-extrabold text-gray-700">Open</div>
          </div>
        </Link>

      </div>
    </div>
  );
}
