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

// sd_743: tiny in-tab cache to avoid /api/auth/me spam on rapid navigations
const ME_TTL_MS = 8000;
let _ME_CACHE: MeResponse | null = null;
let _ME_CACHE_TS = 0;
let _ME_INFLIGHT: Promise<MeResponse> | null = null;


export async function fetchMe(opts?: { force?: boolean }): Promise<MeResponse> {
  const force = !!opts?.force;
  const now = Date.now();

  if (!force && _ME_CACHE && now - _ME_CACHE_TS < ME_TTL_MS) return _ME_CACHE;
  if (!force && _ME_INFLIGHT) return _ME_INFLIGHT;

  const run = async (): Promise<MeResponse> => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = (await res.json()) as any;
      const out = (data || { ok: false }) as MeResponse;
      _ME_CACHE = out;
      _ME_CACHE_TS = Date.now();
      return out;
    } catch {
      const out = { ok: false, authenticated: false } as MeResponse;
      _ME_CACHE = out;
      _ME_CACHE_TS = Date.now();
      return out;
    }
  };

  if (force) return await run();

  _ME_INFLIGHT = run();
  try {
    return await _ME_INFLIGHT;
  } finally {
    _ME_INFLIGHT = null;
  }
}
