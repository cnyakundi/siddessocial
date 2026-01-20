import Link from "next/link";
import { LEGAL_ENTITY_NAME, LEGAL_JURISDICTION, SUPPORT_EMAIL } from "@/src/lib/publicSiteConfig";

export const dynamic = "force-static";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-2xl font-black text-gray-900 tracking-tight">Terms of Service</div>
            <div className="text-xs text-gray-500 font-semibold mt-1">Last updated: Jan 20, 2026</div>
          </div>
          <Link href="/legal" className="px-3 py-2 rounded-xl text-sm font-extrabold border border-gray-200 bg-white hover:bg-gray-50">
            All policies
          </Link>
        </div>

        <div className="mt-6 space-y-5 text-sm text-gray-700 leading-relaxed">
          <p>
            <span className="font-semibold">Operator:</span> {LEGAL_ENTITY_NAME} (“Siddes”, “we”, “us”).
            By using Siddes you agree to these Terms.
          </p>

          <section>
            <h2 className="text-base font-extrabold text-gray-900">1) Eligibility</h2>
            <p className="mt-2">You must be at least the minimum age required in your jurisdiction. Do not use Siddes if you are prohibited by law.</p>
          </section>

          <section>
            <h2 className="text-base font-extrabold text-gray-900">2) Accounts & security</h2>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>Keep your login credentials secure.</li>
              <li>You are responsible for activity under your account.</li>
              <li>We may require email verification or additional checks to prevent abuse.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-extrabold text-gray-900">3) Acceptable use</h2>
            <p className="mt-2">You may not use Siddes to do harm. This includes:</p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>Illegal activity, threats, harassment, or hate.</li>
              <li>Impersonation, scams, or attempts to deceive users.</li>
              <li>Spam, coordinated inauthentic behavior, or automated scraping without permission.</li>
              <li>Attempts to bypass privacy controls or access content you are not allowed to see.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-extrabold text-gray-900">4) Content</h2>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>You retain ownership of content you post.</li>
              <li>You grant Siddes a license to host, store, and display your content to the audiences you select.</li>
              <li>We may remove content or restrict accounts to enforce policies or comply with law.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-extrabold text-gray-900">5) Enforcement</h2>
            <p className="mt-2">
              We may limit, suspend, or ban accounts that violate policies or threaten safety.
              Users can report content in-app. Staff actions are logged.
            </p>
          </section>

          <section>
            <h2 className="text-base font-extrabold text-gray-900">6) Disclaimers</h2>
            <p className="mt-2">Siddes is provided “as is”. We do not guarantee uninterrupted service or that content is accurate.</p>
          </section>

          <section>
            <h2 className="text-base font-extrabold text-gray-900">7) Limitation of liability</h2>
            <p className="mt-2">To the maximum extent permitted by law, Siddes is not liable for indirect or consequential damages.</p>
          </section>

          <section>
            <h2 className="text-base font-extrabold text-gray-900">8) Governing law</h2>
            <p className="mt-2">Governing law and venue: {LEGAL_JURISDICTION}.</p>
          </section>

          <section>
            <h2 className="text-base font-extrabold text-gray-900">9) Contact</h2>
            <p className="mt-2">
              Support:{" "}
              <a className="font-semibold hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
            </p>
          </section>

          <div className="pt-4 text-xs text-gray-500">
            Also see: <Link href="/privacy" className="font-semibold hover:underline">Privacy</Link> and{" "}
            <Link href="/community-guidelines" className="font-semibold hover:underline">Community Guidelines</Link>.
          </div>
        </div>
      </div>
    </div>
  );
}
