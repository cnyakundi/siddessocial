import Link from "next/link";
import { notFound } from "next/navigation";
import { SD_BUILD_STAMP } from "@/src/lib/buildStamp";

export default function LaunchpadPage() {
  // sd_179j: Launchpad is internal.
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <main className="min-h-screen bg-white px-4 py-10">
      <div className="mx-auto max-w-[680px]">
        <h1 className="text-2xl font-bold text-gray-900">Siddes Launchpad</h1>
        <p className="mt-2 text-sm text-gray-600">
          This is a developer launchpad. The real “home” experience is the Feed.
        </p>

        <div className="mt-3 text-xs text-gray-500">
          <span className="font-bold">Build:</span> {SD_BUILD_STAMP}
        </div>


        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/siddes-feed"
            className="inline-flex items-center justify-center rounded-full bg-gray-900 px-5 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Open Feed
          </Link>
          <Link
            href="/siddes-compose"
            className="inline-flex items-center justify-center rounded-full border border-gray-200 bg-white px-5 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          >
            Compose
          </Link>
          <Link
            href="/launchpad/composer-studio"
            className="inline-flex items-center justify-center rounded-full border border-gray-200 bg-white px-5 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          >
            Composer Studio
          </Link>
          <Link
            href="/siddes-inbox"
            className="inline-flex items-center justify-center rounded-full border border-gray-200 bg-white px-5 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          >
            Inbox
          </Link>
          <Link
            href="/siddes-circles"
            className="inline-flex items-center justify-center rounded-full border border-gray-200 bg-white px-5 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          >
            Sets
          </Link>
          <Link
            href="/siddes-profile"
            className="inline-flex items-center justify-center rounded-full border border-gray-200 bg-white px-5 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          >
            Profile
          </Link>
        </div>

        <div className="mt-10 rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <div className="text-sm font-semibold text-gray-900">Dev status command</div>
          <pre className="mt-2 overflow-auto rounded-xl border border-gray-200 bg-white p-3 text-xs text-gray-800">
bash scripts/run_tests.sh --smoke
          </pre>
        </div>
      </div>
    </main>
  );
}
