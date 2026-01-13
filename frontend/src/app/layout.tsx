import "./globals.css";
import type { Metadata } from "next";

import { AppProviders } from "@/src/components/AppProviders";
export const metadata: Metadata = {
  title: "Siddes",
  description: "Context-safe social OS",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppProviders>
{children}
</AppProviders>
      </body>
    </html>
  );
}
