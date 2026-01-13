"use client";

import Link from "next/link";
import React from "react";

import type { SetInvite } from "@/src/lib/inviteProvider";

export function InviteList({ items }: { items: SetInvite[] }) {
  if (!items.length) {
    return (
      <div className="p-4 rounded-2xl border border-dashed border-gray-200 text-center">
        <div className="font-black text-gray-900 mb-1">No invites</div>
        <div className="text-sm text-gray-500">When you invite someone, it will show up here.</div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((inv) => (
        <div key={inv.id} className="p-3 rounded-2xl border border-gray-200 bg-white">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-black text-gray-900 text-sm truncate">{inv.to}</div>
              <div className="text-xs text-gray-500">Set: <span className="font-mono">{inv.setId}</span></div>
              {inv.message ? <div className="text-xs text-gray-600 mt-1">“{inv.message}”</div> : null}
            </div>
            <div className="text-right text-xs text-gray-500">
              <div className="font-mono">{inv.status}</div>
              <Link href={`/invite/${encodeURIComponent(inv.id)}`} className="text-gray-900 font-bold hover:underline">
                open
              </Link>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
