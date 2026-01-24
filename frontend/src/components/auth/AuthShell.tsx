/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import React from "react";

type Props = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export default function AuthShell({ title, subtitle, children }: Props) {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-16 bg-gradient-to-b from-gray-50 to-white">
      <div className="w-full max-w-md">
        <div className="w-full bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <Link href="/" className="shrink-0" aria-label="Siddes home">
              <img src="/brand/siddes_s_stroke_mark_color.svg" alt="Siddes" className="w-10 h-10" />
            </Link>
            <div className="min-w-0">
              <div className="font-black text-lg tracking-tight text-gray-900 leading-none">Siddes</div>
              <div className="text-[11px] text-gray-500 font-semibold">Context-safe social OS</div>
            </div>
          </div>

          <h1 className="mt-5 text-2xl font-black text-gray-900 tracking-tight">{title}</h1>
          {subtitle ? <p className="text-sm text-gray-500 mt-1">{subtitle}</p> : null}

          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
