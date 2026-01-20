import Link from "next/link";
import { notFound } from "next/navigation";

export default function DeveloperHome() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div className="min-h-[80vh] px-4 py-10 flex justify-center">
      <div className="w-full max-w-2xl">
        <div className="text-2xl font-black text-gray-900">Developer</div>
        <div className="text-sm text-gray-500 mt-1">Dev-only utilities. Hidden in production builds.</div>

        <div className="mt-6 grid gap-3">
          <Link href="/developer/telemetry" className="p-4 rounded-2xl bg-white border border-gray-200 hover:bg-gray-50">
            <div className="text-sm font-extrabold text-gray-900">Telemetry</div>
            <div className="text-xs text-gray-500 mt-1">Counts-only quality signals for suggestions.</div>
          </Link>
        </div>

        <div className="mt-6 text-xs text-gray-500">Tip: keep developer pages behind auth and never expose private identifiers.</div>
      </div>
    </div>
  );
}
