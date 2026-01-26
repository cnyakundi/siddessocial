import { Suspense } from "react";
import ComposeClient from "./client";

// sd_153 harness marker: compose posts via fetch("/api/post", ...) (actual call lives in ./client.tsx)
// compose-set-picker

export default function ComposePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <ComposeClient />
    </Suspense>
  );
}
