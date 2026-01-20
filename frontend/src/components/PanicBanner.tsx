"use client";

import React from "react";
import { FLAGS } from "@/src/lib/flags";

export function PanicBanner() {
  if (!FLAGS.panicMode) return null;

  return (
    <div className="w-full border-b border-amber-200 bg-amber-50 text-amber-900">
      <div className="mx-auto flex max-w-[1480px] items-center gap-2 px-4 py-2 text-sm">
        <span className="font-semibold">Panic mode</span>
        <span className="opacity-90">Posting and other write actions are temporarily disabled while Siddes stabilizes.</span>
      </div>
    </div>
  );
}
