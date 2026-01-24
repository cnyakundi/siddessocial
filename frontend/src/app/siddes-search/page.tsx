import { Suspense } from "react";
import SearchClient from "./client";

export default function SiddesSearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <SearchClient />
    </Suspense>
  );
}
