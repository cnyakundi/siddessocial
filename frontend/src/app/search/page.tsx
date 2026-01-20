import { Suspense } from "react";
import SearchClient from "./client";

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <SearchClient />
    </Suspense>
  );
}
