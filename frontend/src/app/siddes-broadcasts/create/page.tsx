"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSide } from "@/src/components/SideProvider";
import { useEffect, useState } from "react";
export default function CreateBroadcastPage() {
  const router = useRouter();
  const { side, setSide } = useSide();

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);

  const [requestedPublic, setRequestedPublic] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    if (side === "public") return;
    if (requestedPublic) return;
    setRequestedPublic(true);
    setSide("public", { afterCancel: () => router.replace("/siddes-feed") });
  }, [hydrated, side, requestedPublic, setSide, router]);


  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [category, setCategory] = useState("News");
  const [desc, setDesc] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onCreate() {
    setErr(null);
    const n = name.trim();
    const h = handle.trim();
    if (!n) return setErr("Name is required.");
    if (!h || !h.startsWith("@")) return setErr("Handle must start with @ (e.g. @nairobi_traffic).");
    if (h.length < 3) return setErr("Handle is too short.");

    setSaving(true);
    try {
      const res = await fetch("/api/broadcasts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: n, handle: h, category, desc }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(String(data?.error || "Create failed"));
        setSaving(false);
        return;
      }

      const id = data?.item?.id;
      if (id) {
        router.push(`/siddes-broadcasts/${id}`);
        return;
      }
      router.push("/siddes-broadcasts");
    } catch {
      setErr("Network error.");
    } finally {
      setSaving(false);
    }
  }
  if (hydrated && side !== "public") {
    return <div className="min-h-screen bg-gray-50" />;
  }


  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-black text-gray-900">Create Broadcast</div>
          <div className="text-sm text-gray-500 mt-1">Public-only channel. Calm, high-signal updates.</div>
        </div>
        <Link href="/siddes-broadcasts" className="text-sm font-bold text-gray-600 hover:text-gray-900">
          Cancel
        </Link>
      </div>

      <div className="mt-6 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
        <label className="block text-xs font-extrabold uppercase tracking-widest text-gray-500">Name</label>
        <input
          className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-300"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nairobi Traffic"
        />

        <label className="block mt-5 text-xs font-extrabold uppercase tracking-widest text-gray-500">Handle</label>
        <input
          className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-300"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="@nairobi_traffic"
        />

        <label className="block mt-5 text-xs font-extrabold uppercase tracking-widest text-gray-500">Category</label>
        <select
          className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-300 bg-white"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option>News</option>
          <option>Utility</option>
          <option>Tech</option>
          <option>Lifestyle</option>
          <option>Sports</option>
          <option>Business</option>
          <option>Politics</option>
        </select>

        <label className="block mt-5 text-xs font-extrabold uppercase tracking-widest text-gray-500">Description</label>
        <textarea
          className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-300 min-h-[120px]"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Real-time updates on major routes. Community sourced, verified by admins."
        />

        {err ? <div className="mt-4 text-sm text-rose-600 font-bold">{err}</div> : null}

        <button
          onClick={onCreate}
          disabled={saving}
          className="mt-6 w-full rounded-full bg-blue-600 text-white text-sm font-extrabold py-3 hover:opacity-95 disabled:opacity-60"
        >
          {saving ? "Creating…" : "Create"}
        </button>
      </div>
    </div>
  );
}
