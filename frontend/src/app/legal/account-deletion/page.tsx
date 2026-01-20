import Link from "next/link";
import {
  ACCOUNT_DELETION_REQUEST_PATH,
  SUPPORT_EMAIL,
} from "@/src/lib/publicSiteConfig";

export const dynamic = "force-static";

export default function AccountDeletionRequestPage() {
  const subj = encodeURIComponent("Siddes account deletion request");
  const body = encodeURIComponent(
    [
      "Hello Siddes Support,",
      "",
      "I would like to request deletion of my Siddes account.",
      "",
      "Email used on account:",
      "Username (if known):",
      "Reason (optional):",
      "",
      "Please let me know if you need additional verification.",
      "",
      "Thanks,",
    ].join("\n")
  );

  const mailto = `mailto:${SUPPORT_EMAIL}?subject=${subj}&body=${body}`;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-2xl font-black text-gray-900 tracking-tight">Account Deletion Request</div>
            <div className="text-xs text-gray-500 font-semibold mt-1">For users who can’t access the app</div>
          </div>
          <Link href="/legal" className="px-3 py-2 rounded-xl text-sm font-extrabold border border-gray-200 bg-white hover:bg-gray-50">
            All policies
          </Link>
        </div>

        <div className="mt-6 space-y-5 text-sm text-gray-700 leading-relaxed">
          <p>
            If you still have access to Siddes, the fastest option is in-app deletion:
            <span className="font-semibold"> Settings → Account → Danger Zone → Delete account</span>.
          </p>

          <section>
            <h2 className="text-base font-extrabold text-gray-900">Request deletion by email</h2>
            <p className="mt-2">
              If you can’t access the app, email our support team. Include the email you used on your account (and your username if you remember it).
              For safety, we may ask for additional verification.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={mailto}
                className="inline-flex items-center justify-center px-4 py-2 rounded-xl text-sm font-extrabold bg-black text-white hover:bg-gray-900"
              >
                Email deletion request
              </a>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="inline-flex items-center justify-center px-4 py-2 rounded-xl text-sm font-extrabold border border-gray-200 bg-white hover:bg-gray-50"
              >
                {SUPPORT_EMAIL}
              </a>
            </div>
          </section>

          <section>
            <h2 className="text-base font-extrabold text-gray-900">What happens after deletion</h2>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>Your account is removed and you will lose access.</li>
              <li>Some limited records may be retained if required for legal, security, or abuse-prevention reasons.</li>
              <li>If content is shared with other users (e.g., replies), we may remove or anonymize it depending on the context and law.</li>
            </ul>
          </section>

          <div className="pt-4 text-xs text-gray-500">
            Also see: <Link href="/privacy" className="font-semibold hover:underline">Privacy</Link> and{" "}
            <Link href="/terms" className="font-semibold hover:underline">Terms</Link>. This page is available at{" "}
            <span className="font-semibold">{ACCOUNT_DELETION_REQUEST_PATH}</span>.
          </div>
        </div>
      </div>
    </div>
  );
}
