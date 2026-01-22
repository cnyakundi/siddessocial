/**
 * Icon Registry — Measurement Protocol v1.2
 * Purpose: keep icon sizes/stroke widths consistent across the OS.
 *
 * NOTE: Prefer applying these constants where it matters most:
 * - Threshold switcher: 24px / 2.5
 * - Workspace nav: 20px / 2.5
 * - Utility header: 22px / 2.0
 * - Post actions: 22px / 2.0
 * - Metadata: 14px / 2.5
 */
export const ICON = {
  threshold: { size: 24, stroke: 2.5 },
  nav: { size: 20, stroke: 2.5 },
  header: { size: 22, stroke: 2 },
  action: { size: 22, stroke: 2 },
  widget: { size: 32, stroke: 2 },
  meta: { size: 14, stroke: 2.5 },
} as const;
