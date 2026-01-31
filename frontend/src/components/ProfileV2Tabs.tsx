"use client";

import React from "react";
import { Grid, List, Layers } from "lucide-react";
import { SIDE_THEMES, type SideId } from "@/src/lib/sides";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

export type ProfileV2TabId = "posts" | "media" | "sets";
export type ProfileV2TabsMode = "labels" | "icons";

// sd_953_profile_tabs_icons: design-canon tabs (posts/media icons), sets hidden by default
export function ProfileV2Tabs(props: {
  side: SideId;
  active: ProfileV2TabId;
  onPick: (tab: ProfileV2TabId) => void;
  sticky?: boolean;

  // mode="icons" => List/Grid icon tabs (design canon)
  mode?: ProfileV2TabsMode;

  // Keep compatibility, but default to hidden (design canon)
  showSets?: boolean;
}) {
  const { side, active, onPick, sticky = true, mode = "labels", showSets = false } = props;
  const t = SIDE_THEMES[side];

  const tabs: Array<{ id: ProfileV2TabId; label: string; Icon: any; isVisible: boolean }> = [
    { id: "posts", label: "Posts", Icon: List, isVisible: true },
    { id: "media", label: "Media", Icon: Grid, isVisible: true },
    { id: "sets", label: "Sets", Icon: Layers, isVisible: !!showSets },
  ];

  const visible = tabs.filter((x) => x.isVisible);

  return (
    <div className={cn("mt-5", sticky ? "sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-gray-100" : "")}>
      <div className="flex px-1">
        {visible.map((tab) => {
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onPick(tab.id)}
              className={cn(
                "relative flex-1 py-4 text-[13px] font-extrabold transition-colors flex items-center justify-center gap-2",
                isActive ? t.text : "text-gray-400 hover:text-gray-600"
              )}
              aria-label={tab.label}
              title={tab.label}
            >
              {mode === "icons" ? <tab.Icon size={18} /> : tab.label}
              {isActive ? <span className={cn("absolute bottom-1 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full", t.primaryBg)} /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
