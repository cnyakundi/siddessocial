export const FLAGS = {
  // Emergency kill switch (build-time env)
  panicMode: process.env.NEXT_PUBLIC_SD_PANIC_MODE === "1",
  // Public Side tuning (all default OFF unless explicitly enabled)
  publicChannels: process.env.NEXT_PUBLIC_SD_PUBLIC_CHANNELS === "1",
  publicTrustDial: process.env.NEXT_PUBLIC_SD_PUBLIC_TRUST_DIAL === "1",
  // Under-the-hood Public trust enforcement (rate limits + link gates). Default OFF.
  publicTrustGates: process.env.NEXT_PUBLIC_SD_PUBLIC_TRUST_GATES === "1",
  publicSlate: process.env.NEXT_PUBLIC_SD_PUBLIC_SLATE === "1",
  publicCalmUi: process.env.NEXT_PUBLIC_SD_PUBLIC_CALM_UI === "1",

  // Performance tuning (default ON). Set NEXT_PUBLIC_SD_MEDIA_PREFETCH=0 to disable.
  mediaPrefetch: process.env.NEXT_PUBLIC_SD_MEDIA_PREFETCH !== "0",

  // PWA: background feed revalidate (default ON). Set NEXT_PUBLIC_SD_FEED_REVALIDATE=0 to disable.
  feedRevalidate: process.env.NEXT_PUBLIC_SD_FEED_REVALIDATE !== "0",

  // PWA: "New posts" pill (default ON). Set NEXT_PUBLIC_SD_NEW_POSTS_PILL=0 to disable.
  newPostsPill: process.env.NEXT_PUBLIC_SD_NEW_POSTS_PILL !== "0",

  // PWA: pull-to-refresh (default ON). Set NEXT_PUBLIC_SD_PULL_TO_REFRESH=0 to disable.
  pullToRefresh: process.env.NEXT_PUBLIC_SD_PULL_TO_REFRESH !== "0",

  // Perf: fast-scroll mode (default ON). Set NEXT_PUBLIC_SD_FAST_SCROLL_MODE=0 to disable.
  fastScrollMode: process.env.NEXT_PUBLIC_SD_FAST_SCROLL_MODE !== "0",

  // PWA: swipe down to close Post Detail (default ON). Set NEXT_PUBLIC_SD_SWIPE_CLOSE_POST=0 to disable.
  swipeClosePostDetail: process.env.NEXT_PUBLIC_SD_SWIPE_CLOSE_POST !== "0",

} as const;
