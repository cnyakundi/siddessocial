import { Suspense } from "react";
import ComposeClient from "./client";

export default function ComposePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <ComposeClient />
    </Suspense>
  );
}
