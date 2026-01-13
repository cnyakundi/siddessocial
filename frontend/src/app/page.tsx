import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
        <h1 className="text-2xl font-bold text-gray-900">Siddes</h1>
        <p className="text-sm text-gray-600 mt-2">
          This is the frontend bootstrap page. The Siddes feed scaffold lives at:
        </p>

        <div className="mt-4">
          <Link
            href="/siddes-feed"
            className="inline-flex items-center justify-center w-full px-4 py-3 rounded-full bg-gray-900 text-white font-semibold hover:opacity-90"
          >
            Open Siddes Feed
          </Link>
        </div>

        <p className="text-xs text-gray-400 mt-4">
          SideBadge + switcher will appear once AppProviders are wired (run patch script).
        </p>
      </div>
    </main>
  );
}
