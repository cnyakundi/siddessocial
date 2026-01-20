"use client";

export type ProdGuardOpts = {
  feature: string;
  provider: string;
  hint?: string;
};

/**
 * Production safety guard.
 *
 * Siddes law:
 * - Unfinished / mock paths must not be reachable in production builds.
 * - If an env misconfiguration selects a mock provider, we fail loud.
 */
export function assertProviderAllowedInProd(opts: ProdGuardOpts): void {
  if (process.env.NODE_ENV !== "production") return;

  const feature = String(opts?.feature || "feature");
  const provider = String(opts?.provider || "provider");
  const hint = opts?.hint ? " " + String(opts.hint) : "";

  throw new Error(
    `[Siddes] Illegal provider in production: ${feature}=${provider}.${hint} Use backend_stub + session auth.`
  );
}
