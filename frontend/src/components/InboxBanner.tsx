"use client";

import React from "react";

export function InboxBanner({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warn" | "danger";
  title: string;
  children?: React.ReactNode;
}) {
  const cls =
    tone === "danger"
      ? "border-rose-200 bg-rose-50 text-rose-900"
      : tone === "warn"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-gray-200 bg-white text-gray-900";

  const sub =
    tone === "danger"
      ? "text-rose-800"
      : tone === "warn"
      ? "text-amber-800"
      : "text-gray-600";

  return (
    <div className={`mb-3 p-3 rounded-2xl border ${cls}`}>
      <div className="text-sm font-bold">{title}</div>
      {children ? <div className={`mt-1 text-xs ${sub}`}>{children}</div> : null}
    </div>
  );
}
