"use client";

export type TelemetryEvent =
  | "suggestion_shown"
  | "suggestion_accepted"
  | "suggestion_skipped"
  | "suggestion_edited"
  | "suggestion_undo"
  | "embeddings_opt_in"
  | "embeddings_opt_out";

/**
 * Privacy-safe telemetry: counts only.
 * Never send handles, contact identifiers, or raw names.
 */
export async function sdTelemetry(event: TelemetryEvent, count = 1) {
  try {
    await fetch("/api/telemetry", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event, count }),
      cache: "no-store",
    });
  } catch {
    // ignore
  }
}
