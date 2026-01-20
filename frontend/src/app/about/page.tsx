import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About",
  description: "Siddes is a context-safe social OS with Sides for Public, Friends, Close, and Work.",
};

function Chip({ label, hex }: { label: string; hex: string }) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-200 bg-white">
      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: hex }} />
      <span className="text-xs font-bold text-gray-700">{label}</span>
    </div>
  );
}

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-3xl mx-auto px-4 py-14">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/siddes_s_stroke_mark_color.svg"
            alt="Siddes"
            className="w-12 h-12"
          />
          <div>
            <div className="text-xl font-black tracking-tight">Siddes</div>
            <div className="text-sm text-gray-500">Context-safe social OS</div>
          </div>
        </div>

        <h1 className="mt-10 text-3xl font-black tracking-tight">
          One identity. Four Sides.
        </h1>
        <p className="mt-3 text-base text-gray-600 leading-relaxed">
          Siddes helps you share the same life across different contexts—without context collapse.
          Each <span className="font-bold">Side</span> is a first-class audience: it changes what you see, what you share,
          and what can reach you.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          <Chip label="Public" hex="#2563EB" />
          <Chip label="Friends" hex="#059669" />
          <Chip label="Close" hex="#E11D48" />
          <Chip label="Work" hex="#334155" />
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-sm font-black">Doorway moment</div>
            <p className="mt-2 text-sm text-gray-600 leading-relaxed">
              Switching Sides is intentional—like stepping into a different context. Siddes makes the audience
              explicit before you post.
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-sm font-black">Structural privacy</div>
            <p className="mt-2 text-sm text-gray-600 leading-relaxed">
              Your Side is your audience anchor. Posts don’t leak across Sides, and the UI never pretends
              something exists if it isn’t real.
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-sm font-black">Calm defaults</div>
            <p className="mt-2 text-sm text-gray-600 leading-relaxed">
              No one-big-feed fatigue. In Public you follow Topics and broadcasts you trust. In private Sides you stay scoped.
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-sm font-black">Human-first speed</div>
            <p className="mt-2 text-sm text-gray-600 leading-relaxed">
              Siddes reduces friction for meaningful actions—replying and sharing—while keeping safety checks where they matter.
            </p>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center px-5 py-3 rounded-full bg-gray-900 text-white font-extrabold hover:bg-gray-800"
          >
            Create account
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center px-5 py-3 rounded-full border border-gray-300 bg-white text-gray-900 font-extrabold hover:bg-gray-50"
          >
            Sign in
          </Link>
        </div>

        <div className="mt-10 text-xs text-gray-500">
          Siddes is not a chat clone. It’s a social OS built to prevent context collapse.
        </div>
      </div>
    </main>
  );
}

