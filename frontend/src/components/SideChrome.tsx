"use client";

import React, { useState } from "react";
import { useSide } from "@/src/components/SideProvider";
import { SideBadge } from "@/src/components/SideBadge";
import { SideSwitcherSheet } from "@/src/components/SideSwitcherSheet";
import { PeekSheet } from "@/src/components/PeekSheet";
import { useSideActivity } from "@/src/hooks/useSideActivity";

export function SideChrome() {
  const { side, setSide } = useSide();
  const [open, setOpen] = useState(false);
  const [peekOpen, setPeekOpen] = useState(false);

  const peekEnabled = true; // Peek is DB-backed (safe in prod)

  const activity = useSideActivity(side);

  return (
    <div className="fixed top-3 left-3 z-[70]">
      <SideBadge
        onClick={() => setOpen(true)}
        onLongPress={
          peekEnabled
            ? () => {
                setOpen(false);
                setPeekOpen(true);
              }
            : undefined
        }
      />

      <SideSwitcherSheet
        open={open}
        onClose={() => setOpen(false)}
        currentSide={side}
        activity={activity}
        onSwitch={(nextSide) => {
          setSide(nextSide);
          setOpen(false);
        }}
      />

      {peekEnabled ? <PeekSheet open={peekOpen} onClose={() => setPeekOpen(false)} sideId={side} /> : null}
    </div>
  );
}
