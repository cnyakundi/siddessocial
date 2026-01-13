/**
 * Siddes — Trust Levels (minimal)
 *
 * This is intentionally tiny and "under the hood".
 * Public UI should talk in human terms (Calm / Standard / Arena).
 */

export type TrustLevel = 0 | 1 | 2 | 3;

export function clampTrustLevel(n: number, fallback: TrustLevel = 1): TrustLevel {
  if (!Number.isFinite(n)) return fallback;
  if (n <= 0) return 0;
  if (n === 1) return 1;
  if (n === 2) return 2;
  return 3;
}

export function normalizeTrustLevel(raw: unknown, fallback: TrustLevel = 1): TrustLevel {
  const n = typeof raw === "number" ? raw : Number(raw);
  return clampTrustLevel(n, fallback);
}

export function labelForTrustLevel(lvl: TrustLevel): string {
  switch (lvl) {
    case 0:
      return "Untrusted";
    case 1:
      return "New";
    case 2:
      return "Known";
    case 3:
      return "Trusted";
  }
}
