"use client";

import React, { useEffect, useState } from "react";
import { useSide } from "@/src/components/SideProvider";
import { SideBadge } from "@/src/components/SideBadge";
import { SideSwitcherSheet } from "@/src/components/SideSwitcherSheet";
import { PeekSheet } from "@/src/components/PeekSheet";
import { getSideActivityMap, type SideActivityMap } from "@/src/lib/sideActivity";

export function SideChrome() {
  const { side, setSide } = useSide();
  const [open, setOpen] = useState(false);
  const [peekOpen, setPeekOpen] = useState(false);

  const [activity, setActivity] = useState<SideActivityMap>(() => getSideActivityMap());

  // Refresh activity when side changes (and periodically)
  useEffect(() => {
    setActivity(getSideActivityMap());
  }, [side]);

  useEffect(() => {
    const t = window.setInterval(() => setActivity(getSideActivityMap()), 2000);
    return () => window.clearInterval(t);
  }, []);

  return (
    <div className="fixed top-3 left-3 z-[70]">
      <SideBadge
        onClick={() => setOpen(true)}
        onLongPress={() => {
          setOpen(false);
          setPeekOpen(true);
        }}
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

      <PeekSheet open={peekOpen} onClose={() => setPeekOpen(false)} sideId={side} />
    </div>
  );
}
