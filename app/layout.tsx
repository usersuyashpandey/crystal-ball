import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

// Deliberately not next/font/google here: it fetches from
// fonts.googleapis.com at build time, which fails outright in a
// network-restricted CI/sandbox and adds an external dependency for zero
// real benefit in a take-home. The system font stack in globals.css reads
// fine and builds anywhere with no network access required.

export const metadata: Metadata = {
  title: "Crystal Ball — Approvals Assistant",
  description: "OomniEye Approvals & Review panel with a real LLM-backed assistant.",
};

// Explicit prop type rather than Next's generated `LayoutProps`, which only
// exists after `next dev`/`next build` has run — so `npm run typecheck` works
// on a fresh clone too.
export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
