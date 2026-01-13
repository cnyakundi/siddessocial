"use client";

import { useEffect } from "react";

/**
 * StubViewerCookie
 * In stub mode we do not have real auth yet.
 * This sets a lightweight cookie so Next API stubs can behave “default-safe”
 * and not leak private sides to requests without app context.
 */
export function StubViewerCookie() {
  useEffect(() => {
    try {
      // Always refresh cookie (keeps it alive during dev)
      document.cookie = "sd_viewer=me; Path=/; SameSite=Lax";
    } catch {
      // ignore
    }
  }, []);

  return null;
}
