"use client";

import React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

/**
 * sd_466e1: Dead-simple Profile Home
 * - Keeps /siddes-profile as a calm "Me" landing page
 * - Moves the full Identity Prism editor/view to /siddes-profile/prism
 */
export default function SiddesProfileHomePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-[11px] font-black tracking-widest text-gray-500"
              aria-hidden="true"
            >
              ME
            </div>
            <div className="min-w-0">
              <div className="text-lg font-black text-gray-900 truncate">My Profile</div>
              <div className="text-sm text-gray-400 truncate">Account + Identity Prism</div>
            </div>
          </div>

          <div className="mt-6 space-y-2">
            <Link
              href="/siddes-profile/account"
              className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-2xl font-bold text-sm hover:bg-gray-100 active:bg-gray-100 transition-colors"
            >
              Account Settings <ChevronRight size={18} className="text-gray-300" />
            </Link>

            <Link
              href="/siddes-profile/prism"
              className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-2xl font-bold text-sm hover:bg-gray-100 active:bg-gray-100 transition-colors"
            >
              Identity Prism <ChevronRight size={18} className="text-gray-300" />
            </Link>
          </div>

          <div className="mt-6 text-xs text-gray-400">
            Tip: Your audience (Public/Friends/Close/Work) is chosen when you post — not here.
          </div>
        </div>
      </div>
    </div>
  );
}
