import Link from "next/link";
import { ACCOUNT_DELETION_REQUEST_PATH, PRIVACY_EMAIL } from "@/src/lib/publicSiteConfig";

export const dynamic = "force-static";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-2xl font-black text-gray-900 tracking-tight">Privacy Policy</div>
            <div className="text-xs text-gray-500 font-semibold mt-1">Last updated: Jan 20, 2026</div>
          </div>
          <Link href="/legal" className="px-3 py-2 rounded-xl text-sm font-extrabold border border-gray-200 bg-white hover:bg-gray-50">
            All policies
          </Link>
        </div>

        <div className="mt-6 space-y-5 text-sm text-gray-700 leading-relaxed">
          <p>
            Siddes (“we”) is designed to prevent context collapse by enforcing audience boundaries server-side.
            This policy explains what data we process and why.
          </p>

          <section>
            <h2 className="text-base font-extrabold text-gray-900">1) Data we collect</h2>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>Account data: email, username, authentication signals.</li>
              <li>Content you create: posts, replies, likes, sets, invites.</li>
              <li>Safety data: reports, blocks, moderation actions.</li>
              <li>Technical data: IP, user agent, request IDs, basic logs for security.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-extrabold text-gray-900">2) How we use data</h2>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>Provide the service (authentication, feeds, notifications).</li>
              <li>Enforce privacy and prevent abuse (rate limits, fraud detection, moderation).</li>
              <li>Improve reliability (debugging, performance, incident response).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-extrabold text-gray-900">3) Sharing</h2>
            <p className="mt-2">
              We do not sell your personal data. We may share limited data with infrastructure providers (hosting, email)
              and if required by law.
            </p>
          </section>

          <section>
            <h2 className="text-base font-extrabold text-gray-900">4) Retention</h2>
            <p className="mt-2">
              We retain data for as long as needed to operate the service and comply with law. If you delete your account,
              we remove personal data where feasible and may retain limited records for legal, security, and abuse-prevention purposes.
            </p>
          </section>

          <section>
            <h2 className="text-base font-extrabold text-gray-900">5) Cookies</h2>
            <p className="mt-2">
              Siddes uses session cookies to keep you signed in. Cookies are configured with security attributes
              (HttpOnly, SameSite, and Secure in production).
            </p>
          </section>

          <section>
            <h2 className="text-base font-extrabold text-gray-900">6) Your choices</h2>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>Update account info in settings.</li>
              <li>Block/mute/report other users.</li>
              <li>
                Export your data in-app (Settings → Account → Export).
              </li>
              <li>
                Delete your account in-app (Settings → Account → Danger Zone). If you can’t access the app, use the{" "}
                <Link href={ACCOUNT_DELETION_REQUEST_PATH} className="font-semibold hover:underline">account deletion request page</Link>.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-extrabold text-gray-900">7) Contact</h2>
            <p className="mt-2">
              Privacy contact:{" "}
              <a className="font-semibold hover:underline" href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>
            </p>
          </section>

          <div className="pt-4 text-xs text-gray-500">
            Also see: <Link href="/terms" className="font-semibold hover:underline">Terms</Link> and{" "}
            <Link href="/community-guidelines" className="font-semibold hover:underline">Community Guidelines</Link>.
          </div>
        </div>
      </div>
    </div>
  );
}
