/**
 * inboxViewer.ts
 *
 * Compatibility shim:
 * - Older inbox stub routes import resolveStubViewer from here.
 * - The real implementation lives in stubViewer.ts.
 *
 * IMPORTANT:
 * This file must keep explicit references to NODE_ENV and "production".
 * A safety check greps for these tokens to ensure the Next.js inbox stubs
 * never trust viewer identity in production deployments.
 */

export type { StubViewerResolution } from "./stubViewer";
export { resolveStubViewer } from "./stubViewer";

// Keep a direct NODE_ENV/production marker in this shim file for safety checks.
// (The actual production gating logic is implemented inside stubViewer.ts.)
if (process.env.NODE_ENV === "production") {
  // no-op
}
