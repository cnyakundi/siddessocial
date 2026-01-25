export const dynamic = "force-dynamic";

import Link from "next/link";
import type { Metadata } from "next";
import { headers } from "next/headers";

type ApiPost = {
  id: string;
  author: string;
  handle: string;
  time: string;
  content: string;
  kind?: string;
  media?: Array<{ url: string; kind?: string; contentType?: string; width?: number; height?: number }>;
};

type ApiResp = { ok?: boolean; post?: ApiPost; side?: string; error?: string };

function originFromHeaders(): string {
  const h = headers();
  const proto = h.get("x-forwarded-proto") || "http";
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  return `${proto}://${host}`;
}

function excerpt(raw: string, max = 160): string {
  const s = String(raw || "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
}

async function fetchPost(postId: string): Promise<{ ok: boolean; post?: ApiPost; side?: string }>{
  const id = encodeURIComponent(String(postId || "").trim());
  if (!id) return { ok: false };
  const origin = originFromHeaders();
  const url = new URL(`/api/post/${id}`, origin).toString();

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return { ok: false };
    const data = (await res.json().catch(() => ({}))) as ApiResp;
    if (!data || !data.ok || !data.post) return { ok: false };
    return { ok: true, post: data.post, side: data.side };
  } catch {
    return { ok: false };
  }
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const id = String(params?.id || "").trim();
  const got = await fetchPost(id);

  if (!got.ok || !got.post) {
    return {
      title: "Post",
      description: "View this post on Siddes.",
    };
  }

  const p = got.post;
  const title = p.handle ? `@${String(p.handle).replace(/^@/, "")} on Siddes` : "Siddes";
  const desc = excerpt(p.content || "", 180) || "View this post on Siddes.";

  const img = Array.isArray(p.media) ? p.media.find((m) => m && String((m as any).kind || "") === "image" && String((m as any).url || "").trim()) : undefined;

  return {
    title,
    description: desc,
    openGraph: {
      title,
      description: desc,
      type: "article",
      images: img ? [{ url: img.url }] : undefined,
    },
    twitter: {
      card: img ? "summary_large_image" : "summary",
      title,
      description: desc,
      images: img ? [img.url] : undefined,
    },
  };
}

export default async function PublicSharePage({ params }: { params: { id: string } }) {
  const idRaw = String(params?.id || "").trim();
  const got = await fetchPost(idRaw);

  const threadHref = `/siddes-post/${encodeURIComponent(idRaw)}`;
  const signInHref = `/login?next=${encodeURIComponent(threadHref + "?reply=1")}`;
  const signUpHref = `/signup?next=${encodeURIComponent(threadHref + "?reply=1")}`;

  if (!got.ok || !got.post) {
    return (
      <div className="min-h-dvh bg-gray-50">
        <div className="max-w-lg mx-auto px-4 py-10">
          <div className="text-center">
            <div className="text-2xl font-black text-gray-900">Siddes</div>
            <div className="mt-2 text-sm text-gray-500">This post isn’t available.</div>
            <div className="mt-6 flex items-center justify-center gap-3">
              <Link href={signInHref} className="px-4 py-2 rounded-full bg-gray-900 text-white font-black text-sm">Sign in</Link>
              <Link href={signUpHref} className="px-4 py-2 rounded-full bg-white border border-gray-200 text-gray-900 font-black text-sm">Create account</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const p = got.post;
  const handle = String(p.handle || "").replace(/^@/, "");
  const author = String(p.author || handle || "Someone");
  const time = String(p.time || "");
  const content = String(p.content || "");

  const img = Array.isArray(p.media) ? p.media.find((m) => m && String((m as any).kind || "") === "image" && String((m as any).url || "").trim()) : undefined;

  return (
    <div className="min-h-dvh bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-10">
        <div className="text-center mb-6">
          <div className="text-2xl font-black text-gray-900">Siddes</div>
          <div className="mt-1 text-xs text-gray-500 font-semibold">Public post • Read-only unless you sign in</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-3xl p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
              <div className="font-black text-gray-900 truncate">{author}</div>
              <div className="text-xs text-gray-500 font-mono truncate">@{handle}{time ? ` • ${time}` : ""}</div>
            </div>
            <Link href={threadHref} className="text-xs font-black text-gray-900 hover:underline">Open</Link>
          </div>

          <div className="text-base text-gray-900 whitespace-pre-wrap leading-relaxed">{content}</div>

          {img ? (
            <div className="mt-4 overflow-hidden rounded-2xl border border-gray-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt="" className="w-full h-auto" />
            </div>
          ) : null}

          <div className="mt-6 grid grid-cols-1 gap-3">
            <Link href={signInHref} className="w-full text-center px-4 py-3 rounded-full bg-gray-900 text-white font-black text-sm hover:opacity-95">Sign in to reply</Link>
            <Link href={signUpHref} className="w-full text-center px-4 py-3 rounded-full bg-white border border-gray-200 text-gray-900 font-black text-sm hover:bg-gray-50">Create account</Link>
          </div>

          <div className="mt-4 text-[11px] text-gray-500">
            Siddes keeps your Private Sides (Friends/Close/Work) sealed. Only Public can be shared.
          </div>
        </div>
      </div>
    </div>
  );
}
