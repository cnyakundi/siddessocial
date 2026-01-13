export const FLAGS = {
  // Public Side tuning (all default OFF unless explicitly enabled)
  publicChannels: process.env.NEXT_PUBLIC_SD_PUBLIC_CHANNELS === "1",
  publicTrustDial: process.env.NEXT_PUBLIC_SD_PUBLIC_TRUST_DIAL === "1",
  // Under-the-hood Public trust enforcement (rate limits + link gates). Default OFF.
  publicTrustGates: process.env.NEXT_PUBLIC_SD_PUBLIC_TRUST_GATES === "1",
  publicSlate: process.env.NEXT_PUBLIC_SD_PUBLIC_SLATE === "1",
  publicCalmUi: process.env.NEXT_PUBLIC_SD_PUBLIC_CALM_UI === "1",
} as const;
