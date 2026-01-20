import { notFound } from "next/navigation";
import ComposerStudioClient from "./studioClient";

export default function ComposerStudioPage() {
  // Dev-only: never ship this route in production.
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return <ComposerStudioClient />;
}
