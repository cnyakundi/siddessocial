export type MeResponse = {
  ok: boolean;
  authenticated?: boolean;
  user?: { id: number; username: string; email: string };
  viewerId?: string;
  emailVerified?: boolean;
  isStaff?: boolean;
  onboarding?: { completed: boolean; step: string; contact_sync_done?: boolean };
  // sd_399: locality + age gate (top-level fields)
  locality?: { detectedRegion?: string; chosenRegion?: string; region?: string };
  ageGateConfirmed?: boolean;
  ageGateConfirmedAt?: string | null;
  minAge?: number;
};

export async function fetchMe(): Promise<MeResponse> {
  try {
    const res = await fetch("/api/auth/me", { cache: "no-store" });
    const data = (await res.json()) as any;
    return (data || { ok: false }) as MeResponse;
  } catch {
    return { ok: false, authenticated: false };
  }
}
