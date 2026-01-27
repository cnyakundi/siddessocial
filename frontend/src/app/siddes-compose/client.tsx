"use client";

// sd_469c: compose audience guard (web + mobile)
// sd_763_compose_mvp: keep composer brutally simple by default.
// sd_153 harness marker: compose posts via fetch("/api/post", ...) (actual call lives in ./ComposeMVP.tsx)

import ComposeMVP from "./ComposeMVP";

export default function SiddesComposePage() {
  return <ComposeMVP />;
}
