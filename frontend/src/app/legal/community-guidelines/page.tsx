import Link from "next/link";

export const dynamic = "force-static";

export default function CommunityGuidelinesPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-2xl font-black text-gray-900 tracking-tight">Community Guidelines</div>
            <div className="text-xs text-gray-500 font-semibold mt-1">Last updated: Jan 19, 2026</div>
          </div>
          <Link href="/legal" className="px-3 py-2 rounded-xl text-sm font-extrabold border border-gray-200 bg-white hover:bg-gray-50">
            All policies
          </Link>
        </div>

        <div className="mt-6 space-y-5 text-sm text-gray-700 leading-relaxed">
          <p>
            Siddes is built around context safety. Use the right Side, respect boundaries, and don’t cause harm.
          </p>

          <section>
            <h2 className="text-base font-extrabold text-gray-900">What’s not allowed</h2>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>Harassment, threats, hate, or targeted abuse.</li>
              <li>Impersonation (including pretending to be staff or public officials).</li>
              <li>Spam, scams, or coordinated manipulation.</li>
              <li>Sharing private personal information (“doxxing”).</li>
              <li>Sexual exploitation, child sexual abuse material, or non-consensual intimate imagery.</li>
              <li>Content that violates the law.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-extrabold text-gray-900">Enforcement</h2>
            <p className="mt-2">
              We may remove content, limit accounts (read-only), suspend, or ban accounts that break the rules.
              Severe violations may be reported to relevant authorities when required.
            </p>
          </section>

          <section>
            <h2 className="text-base font-extrabold text-gray-900">Reporting</h2>
            <p className="mt-2">
              Use in-app reporting on posts and profiles. Include context and screenshots if relevant.
            </p>
          </section>

          <div className="pt-4 text-xs text-gray-500">
            Also see: <Link href="/terms" className="font-semibold hover:underline">Terms</Link> and{" "}
            <Link href="/privacy" className="font-semibold hover:underline">Privacy</Link>.
          </div>
        </div>
      </div>
    </div>
  );
}
