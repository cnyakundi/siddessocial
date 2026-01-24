import Link from "next/link";

export default function AuthLegal() {
  return (
    <div className="mt-6">
      <div className="text-xs text-gray-500 text-center">
        <Link href="/about" className="hover:underline">About</Link>
      </div>

      <div className="mt-4 text-[11px] text-gray-500 text-center leading-relaxed">
        By continuing, you agree to the{" "}
        <Link href="/terms" className="font-semibold text-gray-700 hover:underline">Terms</Link>
        {" "}and acknowledge the{" "}
        <Link href="/privacy" className="font-semibold text-gray-700 hover:underline">Privacy Policy</Link>.
        <span className="block">
          Read our{" "}
          <Link href="/community-guidelines" className="font-semibold text-gray-700 hover:underline">
            Community Guidelines
          </Link>
          .
        </span>
      </div>
    </div>
  );
}
