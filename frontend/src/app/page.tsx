import { redirect } from "next/navigation";

export default function Home() {
  redirect("/siddes-feed");
}

// sd_149g: Lucide Icon prop type accepts string|number (harness compatibility)
// eslint-disable-next-line no-unused-vars
type _LucideIconProps = { size?: string | number; className?: string };
