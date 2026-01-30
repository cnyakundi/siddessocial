"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-full bg-amber-50 text-amber-600">
            <AlertTriangle size={18} />
          </div>
          <div>
            <div className="font-bold text-gray-900">Something went wrong</div>
            <div className="text-xs text-gray-500">
              Calm failure. No panic loops.
            </div>
          </div>
        </div>

        <p className="text-sm text-gray-600 mb-4 leading-relaxed">
          Try again. If it keeps happening, open Launchpad to confirm build and API
          base configuration.
        </p>

        <div className="flex gap-3">
          <button
            onClick={() => reset()}
            className="flex-1 rounded-full bg-gray-900 text-white text-sm font-bold py-2.5 hover:bg-gray-800"
          >
            Try again
          </button>
          {process.env.NODE_ENV !== "production" ? (
            <Link
              href="/launchpad"
              className="flex-1 text-center rounded-full border border-gray-300 text-sm font-bold py-2.5 hover:bg-gray-50"
            >
              Launchpad
            </Link>
          ) : (
            <Link
              href="/siddes-feed"
              className="flex-1 text-center rounded-full border border-gray-300 text-sm font-bold py-2.5 hover:bg-gray-50"
            >
              Home
            </Link>
          )}
        </div>

        {error?.digest ? (
          <div className="mt-4 text-[11px] text-gray-400 font-mono">
            digest: {error.digest}
          </div>
        ) : null}
      </div>
    </div>
  );
}
