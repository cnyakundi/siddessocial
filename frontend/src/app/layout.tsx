import "./globals.css";
import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { AppProviders } from "@/src/components/AppProviders";

const APP_DESC = "Context-safe social OS. Post to the right Side: Public, Friends, Close, Work.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: {
    default: "Siddes",
    template: "%s — Siddes",
  },
  description: APP_DESC,
  applicationName: "Siddes",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Siddes",
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-32.png", type: "image/png", sizes: "32x32" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    title: "Siddes",
    description: APP_DESC,
    type: "website",
    images: [
      {
        url: "/brand/og_1200x630.png",
        width: 1200,
        height: 630,
        alt: "Siddes",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Siddes",
    description: APP_DESC,
    images: ["/brand/og_1200x630.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#0B1020",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* sd_391_rootlayout_suspense_guard */}
        <Suspense fallback={<div className="min-h-dvh bg-gray-50" />}>
          <AppProviders>{children}</AppProviders>
        </Suspense>
      </body>
    </html>
  );
}

