import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { DM_Mono, DM_Sans, Syne } from "next/font/google";
import Link from "next/link";

import { MAIN_SITE_URL, REPO_URL, SITE_URL } from "@/lib/site";

import "./globals.css";

// next/font downloads these at build time and serves them from our own origin.
const syne = Syne({ subsets: ["latin"], weight: ["500", "700", "800"], variable: "--font-syne" });
const dmSans = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-dm-sans" });
const dmMono = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-dm-mono" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "AI Wrapped 2026 · your year with Claude",
  description:
    "Your year with Claude as story cards you can share and compare. Your export is analysed in your browser and never uploaded.",
  alternates: { canonical: SITE_URL },
  openGraph: {
    title: "AI Wrapped 2026",
    description: "Your year with Claude, in eight cards. Private by design: nothing is uploaded.",
    url: SITE_URL,
    siteName: "Barros Builds",
    type: "website",
  },
};

export const viewport: Viewport = { themeColor: "#1c1a17" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${syne.variable} ${dmSans.variable} ${dmMono.variable} antialiased`}>
      <body className="flex min-h-dvh flex-col">
        <div className="flex-1">{children}</div>
        <footer className="border-t border-line px-6 py-8 font-mono text-sm text-muted">
          <div className="mx-auto flex max-w-3xl flex-wrap gap-x-6 gap-y-2">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <a href={REPO_URL}>Source on GitHub</a>
            <span className="ml-auto">
              Built by <a href={MAIN_SITE_URL}>Barros Builds</a>
            </span>
          </div>
        </footer>
        {/* Cookieless page views only. No custom events. The standard path, so behind the
            barrosbuilds.com rewrite the main site's analytics count /wrapped too (the default
            project-specific path only exists on this project's own domain). */}
        <Analytics scriptSrc="/_vercel/insights/script.js" endpoint="/_vercel/insights" />
      </body>
    </html>
  );
}
