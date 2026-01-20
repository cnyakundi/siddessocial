import Link from "next/link";
import { SUPPORT_EMAIL } from "@/src/lib/publicSiteConfig";

export const dynamic = "force-static";

function Card({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link
      href={href}
      className="block rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 p-5"
    >
      <div className="text-sm font-extrabold text-gray-900">{title}</div>
      <div className="text-xs text-gray-500 mt-1">{desc}</div>
    </Link>
  );
}

export default function LegalIndexPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/siddes_s_stroke_mark_color.svg" alt="Siddes" className="w-9 h-9" />
          <div>
            <div className="text-lg font-black text-gray-900 tracking-tight">Legal & Policies</div>
            <div className="text-xs text-gray-500 font-semibold">Last updated: Jan 20, 2026</div>
          </div>
        </div>

        <p className="mt-4 text-sm text-gray-600">
          Siddes is a context-safe social OS. These policies explain how we operate, protect users,
          and handle data.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-3">
          <Card href="/terms" title="Terms of Service" desc="Rules for using Siddes and your responsibilities." />
          <Card href="/privacy" title="Privacy Policy" desc="What data we collect, how we use it, and your rights." />
          <Card
            href="/community-guidelines"
            title="Community Guidelines"
            desc="What’s allowed, what’s not, and how reporting/moderation works."
          />
          <Card
            href="/account-deletion"
            title="Account Deletion Request"
            desc="If you can’t access the app, request deletion using the web link." 
          />
        </div>

        <div className="mt-8 text-xs text-gray-500">
          Need help? Use in-app reporting or contact{" "}
          <a className="font-semibold hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </div>
      </div>
    </div>
  );
}
