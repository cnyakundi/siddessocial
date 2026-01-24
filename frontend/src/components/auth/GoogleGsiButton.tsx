"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    google?: any;
    __siddes_gsi_loading__?: Promise<void>;
  }
}

function ensureGsiScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.__siddes_gsi_loading__) return window.__siddes_gsi_loading__;

  window.__siddes_gsi_loading__ = new Promise((resolve) => {
    const existing = document.getElementById("google-gsi");
    if (existing) {
      resolve();
      return;
    }

    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.id = "google-gsi";
    s.onload = () => resolve();
    document.head.appendChild(s);
  });

  return window.__siddes_gsi_loading__;
}

type Props = {
  clientId: string;
  onCredential: (credential: string) => Promise<void> | void;
  width?: number;
};

export default function GoogleGsiButton({ clientId, onCredential, width = 360 }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const cbRef = useRef(onCredential);

  useEffect(() => {
    cbRef.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    let cancelled = false;
    if (!clientId) return;

    ensureGsiScript().then(() => {
      if (cancelled) return;
      const g = (window as any).google;
      if (!g?.accounts?.id || !hostRef.current) return;

      g.accounts.id.initialize({
        client_id: clientId,
        callback: async (resp: any) => {
          const cred = String(resp?.credential || "");
          if (!cred) return;
          await cbRef.current(cred);
        },
      });

      // Re-render button into host.
      hostRef.current.innerHTML = "";
      g.accounts.id.renderButton(hostRef.current, {
        theme: "outline",
        size: "large",
        width,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [clientId, width]);

  return <div ref={hostRef} className="flex justify-center" />;
}
