import { redirect } from "next/navigation";

// sd_796: /me is an alias for the calm Me landing page.
export default function MeRedirect() {
  redirect("/siddes-profile");
}
