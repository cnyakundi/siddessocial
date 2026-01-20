"use client";

import React from "react";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

/**
 * ContentColumn — Tumblr-width center column.
 * Rule: keep readable width on desktop. Never exceed ~760px.
 */
export function ContentColumn({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("w-full max-w-[680px] mx-auto px-4", className)}>{children}</div>;
}
