#!/usr/bin/env bash
set -euo pipefail

# sd_398: Safety parity — Inbox block enforcement + Appeals (user+admin)
# Ignore images/media: this script does NOT touch media.

SD_ID="sd_398_safety_parity_inbox_blocks_appeals"
TS="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR=".backup_${SD_ID}_${TS}"

echo "== ${SD_ID} =="
echo "Backup dir: ${BACKUP_DIR}"
echo

if [[ ! -d "backend" || ! -d "frontend" ]]; then
  echo "ERROR: run this from repo root (expected ./backend and ./frontend)."
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node is required to apply patches (missing 'node')."
  exit 1
fi

mkdir -p "${BACKUP_DIR}"

backup_file() {
  local rel="$1"
  if [[ -f "${rel}" ]]; then
    mkdir -p "${BACKUP_DIR}/$(dirname "${rel}")"
    cp -p "${rel}" "${BACKUP_DIR}/${rel}"
  fi
}

write_file() {
  local rel="$1"
  mkdir -p "$(dirname "${rel}")"
  cat > "${rel}"
}

# --- Backup files we will change/overwrite (existing only) ------------------
backup_file "backend/siddes_safety/models.py"
backup_file "backend/siddes_safety/views.py"
backup_file "backend/siddes_safety/urls.py"
backup_file "backend/siddes_backend/settings.py"
backup_file "backend/siddes_backend/middleware.py"
backup_file "backend/siddes_inbox/store_db.py"
backup_file "backend/siddes_inbox/store_memory.py"
backup_file "backend/siddes_auth/views.py"
backup_file "frontend/src/app/siddes-profile/account/page.tsx"
backup_file "frontend/src/app/siddes-moderation/page.tsx"

# New files: back up if they already exist
backup_file "backend/siddes_safety/migrations/0004_userappeal.py"
backup_file "frontend/src/app/api/appeals/route.ts"
backup_file "frontend/src/app/api/appeals/admin/route.ts"
backup_file "frontend/src/app/api/appeals/[id]/route.ts"
backup_file "frontend/src/app/siddes-profile/account/appeal/page.tsx"
backup_file "frontend/src/app/siddes-moderation/appeals/page.tsx"

# --- Create/overwrite NEW files (migration + Next API proxies + pages) ------

# 1) Django migration: UserAppeal
mkdir -p backend/siddes_safety/migrations
write_file "backend/siddes_safety/migrations/0004_userappeal.py" <<'PY'
from __future__ import annotations

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("siddes_safety", "0003_moderation_audit_event"),
    ]

    operations = [
        migrations.CreateModel(
            name="UserAppeal",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("appellant_id", models.CharField(db_index=True, max_length=64)),
                ("target_type", models.CharField(db_index=True, max_length=16)),
                ("target_id", models.CharField(db_index=True, max_length=128)),
                ("reason", models.CharField(db_index=True, max_length=32)),
                ("details", models.TextField(blank=True)),
                ("request_id", models.CharField(blank=True, max_length=64)),
                ("status", models.CharField(db_index=True, default="open", max_length=16)),
                ("staff_notes", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
        ),
    ]
PY

# 2) Next API proxies: /api/appeals (+ admin + patch)
mkdir -p frontend/src/app/api/appeals/admin frontend/src/app/api/appeals/[id]
write_file "frontend/src/app/api/appeals/route.ts" <<'TS'
import { NextResponse } from "next/server";
import { proxyJson } from "../auth/_proxy";

export async function GET(req: Request) {
  const qs = new URL(req.url).search || "";
  const out = await proxyJson(req, "/api/appeals" + qs, "GET");
  if (out instanceof NextResponse) return out;
  const { res, data, setCookies } = out;
  const r = NextResponse.json(data, { status: res.status });
  for (const c of setCookies) r.headers.append("set-cookie", c);
  return r;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const out = await proxyJson(req, "/api/appeals", "POST", body);
  if (out instanceof NextResponse) return out;
  const { res, data, setCookies } = out;
  const r = NextResponse.json(data, { status: res.status });
  for (const c of setCookies) r.headers.append("set-cookie", c);
  return r;
}
TS

write_file "frontend/src/app/api/appeals/admin/route.ts" <<'TS'
import { NextResponse } from "next/server";
import { proxyJson } from "../../auth/_proxy";

export async function GET(req: Request) {
  const qs = new URL(req.url).search || "";
  const out = await proxyJson(req, "/api/appeals/admin" + qs, "GET");
  if (out instanceof NextResponse) return out;
  const { res, data, setCookies } = out;
  const r = NextResponse.json(data, { status: res.status });
  for (const c of setCookies) r.headers.append("set-cookie", c);
  return r;
}
TS

write_file "frontend/src/app/api/appeals/[id]/route.ts" <<'TS'
import { NextResponse } from "next/server";
import { proxyJson } from "../../auth/_proxy";

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const id = String(ctx?.params?.id || "").trim();
  if (!id) return NextResponse.json({ ok: false, error: "missing_id" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const out = await proxyJson(req, `/api/appeals/${encodeURIComponent(id)}`, "PATCH", body);
  if (out instanceof NextResponse) return out;
  const { res, data, setCookies } = out;
  const r = NextResponse.json(data, { status: res.status });
  for (const c of setCookies) r.headers.append("set-cookie", c);
  return r;
}
TS

# 3) User Appeals page
mkdir -p frontend/src/app/siddes-profile/account/appeal
write_file "frontend/src/app/siddes-profile/account/appeal/page.tsx" <<'TSX'
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type MePayload = {
  ok?: boolean;
  authenticated?: boolean;
  user?: { id: number; username: string; email: string };
  viewerId?: string;
  emailVerified?: boolean;
  onboarding?: { completed: boolean; step: number; contact_sync_done: boolean };
  accountState?: string;
  accountStateUntil?: string | null;
  accountStateReason?: string | null;
  error?: string;
};

type AppealItem = {
  id: number;
  createdAt: string | null;
  targetType: string | null;
  targetId: string | null;
  reason: string | null;
  details: string | null;
  status: string | null;
  staffNotes?: string;
};

type AppealsResp = { ok: boolean; items?: AppealItem[]; error?: string };
type CreateResp = { ok: boolean; appealed?: boolean; id?: number; error?: string };

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

const REASONS = [
  { id: "mistake", label: "Mistake / misunderstanding" },
  { id: "context", label: "Needs context" },
  { id: "harassment", label: "Harassment / abuse" },
  { id: "spam", label: "Flagged as spam" },
  { id: "other", label: "Other" },
];

export default function AccountAppealPage() {
  const [me, setMe] = useState<MePayload | null>(null);
  const [loadingMe, setLoadingMe] = useState(true);

  const [items, setItems] = useState<AppealItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);

  const [reason, setReason] = useState<string>("mistake");
  const [details, setDetails] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const restricted = useMemo(() => {
    const s = String(me?.accountState || "active").toLowerCase();
    return s && s !== "active";
  }, [me?.accountState]);

  async function loadMe() {
    setLoadingMe(true);
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const j = (await res.json().catch(() => null)) as any;
      setMe(j && typeof j === "object" ? (j as MePayload) : { ok: false, error: "bad_response" });
    } catch {
      setMe({ ok: false, error: "network" });
    } finally {
      setLoadingMe(false);
    }
  }

  async function loadAppeals() {
    setLoadingItems(true);
    try {
      const res = await fetch("/api/appeals?limit=200", { cache: "no-store" });
      const j = (await res.json().catch(() => null)) as AppealsResp | null;
      if (!j || !j.ok) setItems([]);
      else setItems(Array.isArray(j.items) ? j.items : []);
    } catch {
      setItems([]);
    } finally {
      setLoadingItems(false);
    }
  }

  useEffect(() => {
    loadMe();
    loadAppeals();
  }, []);

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      const targetId = String(me?.viewerId || "").trim();
      const payload = { targetType: "account", targetId: targetId || undefined, reason, details };
      const res = await fetch("/api/appeals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = (await res.json().catch(() => null)) as CreateResp | null;
      if (!j || !j.ok) setMsg(j?.error ? `Error: ${j.error}` : `Error: http_${res.status}`);
      else {
        setDetails("");
        setMsg(`Appeal submitted (#${j.id}).`);
        await loadAppeals();
      }
    } catch {
      setMsg("Error: network");
    } finally {
      setBusy(false);
    }
  }

  const authed = !!me?.authenticated;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-black text-gray-900">Appeals</div>
            <div className="text-xs text-gray-500 mt-1">Request a review of restrictions or moderation outcomes</div>
          </div>

          <Link
            href="/siddes-profile/account"
            className="px-3 py-2 rounded-xl text-sm font-extrabold border border-gray-200 bg-white hover:bg-gray-50"
          >
            Back
          </Link>
        </div>

        <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
          {loadingMe ? (
            <div className="text-sm text-gray-600">Loading…</div>
          ) : !authed ? (
            <div>
              <div className="text-sm font-bold text-gray-900">Not signed in</div>
              <div className="text-xs text-gray-500 mt-1">Sign in to submit an appeal.</div>
              <div className="mt-3">
                <Link href="/login" className="inline-flex px-3 py-2 rounded-xl text-sm font-extrabold bg-gray-900 text-white">
                  Go to Login
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold border border-gray-200 bg-gray-50 text-gray-700">
                  viewer: {me?.viewerId || "(missing)"}
                </span>
                {restricted ? (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold border border-amber-200 bg-amber-50 text-amber-800">
                    state: {String(me?.accountState || "").toUpperCase()}
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold border border-gray-200 bg-gray-50 text-gray-700">
                    state: ACTIVE
                  </span>
                )}
              </div>

              {restricted ? (
                <div className="text-xs text-gray-600">
                  {me?.accountStateReason ? (
                    <div>
                      Reason: <span className="font-semibold">{me.accountStateReason}</span>
                    </div>
                  ) : null}
                  {me?.accountStateUntil ? (
                    <div>
                      Until: <span className="font-semibold">{new Date(me.accountStateUntil).toLocaleString()}</span>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="text-xs text-gray-600">
                  You can still appeal a moderation decision (for example, if content was removed), even if your account is active.
                </div>
              )}

              <div className="grid grid-cols-1 gap-3">
                <div>
                  <div className="text-[11px] font-extrabold uppercase tracking-widest text-gray-400">Reason</div>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="mt-1 w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white"
                  >
                    {REASONS.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="text-[11px] font-extrabold uppercase tracking-widest text-gray-400">Details</div>
                  <textarea
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    rows={5}
                    placeholder="Explain what happened. Include context, timestamps, or why you think this was a mistake."
                    className="mt-1 w-full text-sm border border-gray-200 rounded-2xl px-3 py-2 bg-white"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={submit}
                    disabled={busy || !details.trim()}
                    className={cn(
                      "px-3 py-2 rounded-xl text-sm font-extrabold",
                      "border border-gray-200 bg-gray-900 text-white hover:bg-gray-800",
                      (busy || !details.trim()) && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {busy ? "Submitting…" : "Submit appeal"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      loadMe();
                      loadAppeals();
                    }}
                    className="px-3 py-2 rounded-xl text-sm font-extrabold border border-gray-200 bg-white hover:bg-gray-50"
                  >
                    Refresh
                  </button>

                  {msg ? <div className="text-xs text-gray-600 ml-auto">{msg}</div> : null}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
          <div className="text-sm font-extrabold text-gray-900">Your appeals</div>
          <div className="text-xs text-gray-500 mt-1">Latest first</div>

          {loadingItems ? (
            <div className="text-sm text-gray-600 mt-3">Loading…</div>
          ) : items.length === 0 ? (
            <div className="text-sm text-gray-600 mt-3">No appeals yet.</div>
          ) : (
            <div className="mt-3 flex flex-col gap-2">
              {items
                .slice()
                .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
                .map((a) => (
                  <div key={a.id} className="p-3 rounded-2xl border border-gray-200 bg-gray-50">
                    <div className="text-xs text-gray-500">
                      #{a.id} • {a.createdAt ? new Date(a.createdAt).toLocaleString() : ""}
                    </div>
                    <div className="text-sm font-bold text-gray-900 mt-1">
                      {String(a.targetType || "").toUpperCase()} • {String(a.status || "open").toUpperCase()}
                    </div>
                    {a.reason ? <div className="text-xs text-gray-700 mt-1">Reason: {a.reason}</div> : null}
                    {a.details ? <div className="text-xs text-gray-700 mt-2">{a.details}</div> : null}
                    {a.staffNotes ? (
                      <div className="mt-2 text-xs text-emerald-800 border border-emerald-200 rounded-xl p-2 bg-emerald-50">
                        Staff: {a.staffNotes}
                      </div>
                    ) : null}
                  </div>
                ))}
            </div>
          )}
        </div>

        <div className="mt-4 text-xs text-gray-500">
          Tip: Blocking is a hard stop for DMs. If you can’t see a thread, it may be because one side blocked the other.
        </div>
      </div>
    </div>
  );
}
TSX

# 4) Staff Appeals page
mkdir -p frontend/src/app/siddes-moderation/appeals
write_file "frontend/src/app/siddes-moderation/appeals/page.tsx" <<'TSX'
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type AppealItem = {
  id: number;
  createdAt: string | null;
  appellantId?: string | null;
  appellantName?: string | null;
  appellantHandle?: string | null;
  targetType: string | null;
  targetId: string | null;
  reason: string | null;
  details: string | null;
  status: "open" | "reviewing" | "resolved" | "dismissed" | string;
  staffNotes?: string;
  requestId?: string | null;
};

type AppealsResp = { ok: boolean; items?: AppealItem[]; error?: string };
type PatchResp = { ok: boolean; id?: number; status?: string; staffNotes?: string; error?: string };

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

const STATUSES: Array<AppealItem["status"]> = ["open", "reviewing", "resolved", "dismissed"];

export default function ModerationAppealsPage() {
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<AppealItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : "";
      const res = await fetch(`/api/appeals/admin${q}`, { cache: "no-store" });
      const j = (await res.json().catch(() => null)) as AppealsResp | null;
      if (!j || !j.ok) {
        setError(j?.error || `http_${res.status}`);
        setItems([]);
      } else {
        setItems(Array.isArray(j.items) ? j.items : []);
      }
    } catch {
      setError("network");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  }, [items]);

  const update = async (id: number, nextStatus: string, staffNotes?: string) => {
    try {
      const res = await fetch(`/api/appeals/${encodeURIComponent(String(id))}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: nextStatus, staffNotes }),
      });
      const j = (await res.json().catch(() => null)) as PatchResp | null;
      if (!j || !j.ok) {
        setError(j?.error || `update_failed_${res.status}`);
        return;
      }
      setItems((cur) => cur.map((a) => (a.id === id ? { ...a, status: String(j.status || nextStatus), staffNotes: j.staffNotes } : a)));
      setError(null);
    } catch {
      setError("network");
    }
  };

  const setNotes = async (id: number) => {
    const note = window.prompt("Staff notes (shown to user)") || "";
    const cur = items.find((a) => a.id === id);
    await update(id, String(cur?.status || "open"), note);
  };

  return (
    <div className="px-4 py-6">
      <div className="mb-4">
        <div className="text-sm font-bold text-gray-900">Moderation • Appeals</div>
        <div className="text-xs text-gray-500 mt-1">Staff-only triage for user appeals.</div>
        <div className="text-xs text-gray-500 mt-1">
          <Link href="/siddes-moderation" className="underline font-bold">Reports</Link>
          <span className="mx-2">•</span>
          <Link href="/siddes-moderation/audit" className="underline font-bold">Audit log</Link>
          <span className="mx-2">•</span>
          <Link href="/siddes-moderation/stats" className="underline font-bold">Stats</Link>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <div className="text-xs font-bold text-gray-700">Filter</div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-xs border border-gray-200 rounded-xl px-3 py-2 bg-white"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {String(s).toUpperCase()}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={load}
          className={cn(
            "ml-auto text-xs font-extrabold px-3 py-2 rounded-xl",
            "border border-gray-200 bg-white hover:bg-gray-50 text-gray-800"
          )}
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-gray-600">Loading…</div>
      ) : error ? (
        <div className="text-sm text-red-600">{error === "forbidden" ? "Not authorized." : `Error: ${error}`}</div>
      ) : sorted.length === 0 ? (
        <div className="text-sm text-gray-600">No appeals in this bucket.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map((a) => (
            <div key={a.id} className="p-4 rounded-2xl border border-gray-200 bg-white">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs text-gray-500">
                    #{a.id} • {a.createdAt ? new Date(a.createdAt).toLocaleString() : ""}
                  </div>
                  <div className="text-sm font-bold text-gray-900 mt-1">
                    {String(a.targetType || "").toUpperCase()} • {String(a.reason || "other")} • {String(a.status || "open").toUpperCase()}
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    Appellant: <span className="font-mono">{a.appellantId || ""}</span>
                    {a.appellantHandle ? <> • <span className="font-semibold">{a.appellantHandle}</span></> : null}
                    {a.appellantName ? <> • {a.appellantName}</> : null}
                  </div>
                  {a.details ? <div className="text-xs text-gray-700 mt-2">{a.details}</div> : null}
                  {a.staffNotes ? (
                    <div className="mt-2 text-xs text-emerald-800 border border-emerald-200 rounded-xl p-2 bg-emerald-50">
                      Staff: {a.staffNotes}
                    </div>
                  ) : null}
                </div>

                <div className="shrink-0 flex flex-col items-end gap-2">
                  <div className="text-xs px-2 py-1 rounded-full border border-gray-200 bg-white text-gray-700">
                    {String(a.status).toUpperCase()}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => update(a.id, "reviewing")}
                  className="text-xs font-extrabold px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50"
                >
                  Reviewing
                </button>
                <button
                  type="button"
                  onClick={() => update(a.id, "resolved")}
                  className="text-xs font-extrabold px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50"
                >
                  Resolve
                </button>
                <button
                  type="button"
                  onClick={() => update(a.id, "dismissed")}
                  className="text-xs font-extrabold px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50"
                >
                  Dismiss
                </button>
                <button
                  type="button"
                  onClick={() => setNotes(a.id)}
                  className="ml-auto text-xs font-extrabold px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                >
                  Staff notes
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
TSX

# 5) Rewrite Account page (adds accountState badge + appeal link)
mkdir -p frontend/src/app/siddes-profile/account
write_file "frontend/src/ap_
