import type { Metadata } from "next";
import { Inter_Tight } from "next/font/google";
import { SITE_NAME, SITE_URL, TAGLINE } from "@/lib/site";
import "./globals.css";

const interTight = Inter_Tight({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
  fallback: ["system-ui", "-apple-system", "sans-serif"],
});

const description =
  "Open, daily-refreshed data on ERC-8004 agents per chain: how many agents exist, who owns them, what their wallets hold, activity over the last 30 days and the top projects. Open source, anyone can contribute.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description,
  applicationName: SITE_NAME,
  keywords: ["ERC-8004", "agents", "agentic ecosystem", "BNB Chain", "Base", "Celo", "8004scan", "open data"],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    url: SITE_URL,
    title: SITE_NAME,
    description: TAGLINE,
    locale: "en_US",
  },
  twitter: { card: "summary", title: SITE_NAME, description: TAGLINE },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={interTight.variable}>
      <body>{children}</body>
    </html>
  );
}
