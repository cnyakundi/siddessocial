"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

type AppealItem = {
  id: number;
  createdAt: string | null;
  appellantId: string;
  targetType: string;
  targetId: string;
  reason: string;
  details: string;
  status: string;
  staffNote?: string;
};

type AppealsResp = { ok: boolean; items?: AppealItem[]; error?: string };

type CreateResp = { ok: boolean; created?: boolean; id?: number; error?: string };

const TARGETS = [
  { id: "account", label: "Account restriction" },
  { id: "post", label: "Post takedown" },
  { id: "reply", label: "Reply takedown" },
  { id: "user", label: "User/profile action" },
  { id: "broadcast", label: "Broadcast action" },
  { id: "report", label: "Report decision" },
];

export default function AppealsPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<AppealItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [targetType, setTargetType] = useState<string>("account");
  const [targetId, setTargetId] = useState<string>("");
  const [reason, setReason] = useState<string>("other");
  const [details, setDetails] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/appeals", { cache: "no-store" });
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
  }, []);

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  }, [items]);

  const submit = async () => {
    const d = details.trim();
    if (!d) {
      setNotice("Please describe what happened.");
      return;
    }

    setSubmitting(true);
    setNotice(null);
    try {
      const res = await fetch("/api/appeals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetType,
          targetId: targetId.trim(),
          reason: reason.trim() || "other",
          details: d,
        }),
      });
      const j = (await res.json().catch(() => null)) as CreateResp | null;
      if (!j || !j.ok) {
        setNotice(j?.error || `submit_failed_${res.status}`);
      } else {
        setTargetId("");
        setReason("other");
        setDetails("");
        setNotice("Appeal submitted.");
        await load();
      }
    } catch {
      setNotice("network");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="px-4 py-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-gray-900">Appeals</div>
          <div className="text-xs text-gray-500 mt-1">Request a review of a restriction or takedown.</div>
        </div>
        <Link href="/siddes-settings" className="text-xs font-bold text-gray-700 hover:text-gray-900">
          Back
        </Link>
      </div>

      <div className="p-4 rounded-2xl border border-gray-200 bg-white">
        <div className="text-sm font-bold text-gray-900">Submit an appeal</div>
        <div className="text-xs text-gray-500 mt-1">Keep it short and factual. Include IDs if you have them.</div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <div className="text-xs font-bold text-gray-700 mb-1">What are you appealing?</div>
            <select
              value={targetType}
              onChange={(e) => setTargetType(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white"
            >
              {TARGETS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="text-xs font-bold text-gray-700 mb-1">Target ID (optional)</div>
            <input
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              placeholder="e.g. post_123, report #45, etc"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2"
            />
          </div>
        </div>

        <div className="mt-3">
          <div className="text-xs font-bold text-gray-700 mb-1">Reason (optional)</div>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. mistake, context missing, false positive"
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2"
          />
        </div>

        <div className="mt-3">
          <div className="text-xs font-bold text-gray-700 mb-1">Details</div>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={5}
            placeholder="Describe what happened, and why you think the action should be reviewed."
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2"
          />
        </div>

        {notice ? <div className="mt-3 text-xs text-gray-700">{notice}</div> : null}

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            disabled={submitting}
            onClick={submit}
            className={cn(
              "px-4 py-2 rounded-full text-xs font-extrabold",
              submitting ? "bg-gray-200 text-gray-500" : "bg-gray-900 text-white hover:bg-black"
            )}
          >
            {submitting ? "Submitting..." : "Submit appeal"}
          </button>
          <button
            type="button"
            onClick={load}
            className="px-4 py-2 rounded-full text-xs font-extrabold border border-gray-200 bg-white hover:bg-gray-50"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="mt-6">
        <div className="text-sm font-bold text-gray-900">Your appeals</div>
        <div className="text-xs text-gray-500 mt-1">Status updates will appear here after staff review.</div>

        <div className="mt-3">
          {loading ? (
            <div className="text-sm text-gray-600">Loading...</div>
          ) : error ? (
            <div className="text-sm text-red-600">Could not load appeals ({error}).</div>
          ) : sorted.length === 0 ? (
            <div className="text-sm text-gray-600">No appeals yet.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {sorted.map((a) => (
                <div key={a.id} className="p-4 rounded-2xl border border-gray-200 bg-white">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs text-gray-500">
                        #{a.id} • {a.createdAt ? new Date(a.createdAt).toLocaleString() : ""}
                      </div>
                      <div className="text-sm font-bold text-gray-900 mt-1">{String(a.targetType || "").toUpperCase()}</div>
                      {a.targetId ? (
                        <div className="text-xs text-gray-600 mt-1">
                          Target: <span className="font-mono">{a.targetId}</span>
                        </div>
                      ) : null}
                      {a.reason ? <div className="text-xs text-gray-600 mt-1">Reason: {a.reason}</div> : null}
                      {a.details ? <div className="text-xs text-gray-800 mt-2 whitespace-pre-wrap">{a.details}</div> : null}
                      {a.staffNote ? (
                        <div className="mt-3 text-xs text-gray-700 border border-gray-100 rounded-xl p-2 bg-gray-50">
                          <div className="font-bold text-gray-700">Staff note</div>
                          <div className="mt-1 whitespace-pre-wrap">{a.staffNote}</div>
                        </div>
                      ) : null}
                    </div>
                    <div className="shrink-0 text-xs px-2 py-1 rounded-full border border-gray-200 bg-white text-gray-700">
                      {String(a.status || "").toUpperCase()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
