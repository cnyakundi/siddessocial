"use client";

import React from "react";
import { SIDE_THEMES, type SideId } from "@/src/lib/sides";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

export type ProfileV2TabId = "posts" | "media" | "sets";

// sd_717_profile_v2_tabs: sticky-ready profile content tabs
export function ProfileV2Tabs(props: {
  side: SideId;
  active: ProfileV2TabId;
  onPick: (tab: ProfileV2TabId) => void;
  sticky?: boolean;
}) {
  const { side, active, onPick, sticky = true } = props;
  const t = SIDE_THEMES[side];

  const tabs: Array<{ id: ProfileV2TabId; label: string }> = [
    { id: "posts", label: "Posts" },
    { id: "media", label: "Media" },
    { id: "sets", label: "Sets" },
  ];

  return (
    <div
      className={cn(
        "mt-5",
        sticky ? "sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-gray-100" : ""
      )}
    >
      <div className="flex px-1">
        {tabs.map((tab) => {
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onPick(tab.id)}
              className={cn(
                "relative flex-1 py-4 text-[13px] font-extrabold transition-colors",
                isActive ? t.text : "text-gray-400 hover:text-gray-600"
              )}
            >
              {tab.label}
              {isActive ? (
                <span
                  className={cn(
                    "absolute bottom-1 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full",
                    t.primaryBg
                  )}
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
