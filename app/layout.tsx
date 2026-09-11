import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import { Astronaut } from "@/components/icons";
import "./globals.css";

// Self-hosted at build time, so no external stylesheet and no CSP hole.
const sans = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
});

/**
 * Absolute base for every OG tag. This is the piece that makes or breaks the
 * link preview: without it Next emits relative image URLs, and crawlers like
 * LinkedIn's cannot resolve them, so a shared verdict unfurls as a bare link
 * with no card. Set NEXT_PUBLIC_SITE_URL in production; VERCEL_URL covers
 * preview deploys on its own.
 */
function resolveSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  // The stable production alias. Prefer it over VERCEL_URL, which is unique
  // per deployment and would change every OG image link on each push.
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

const siteUrl = resolveSiteUrl();

const TITLE = "The Dani Test";
const DESCRIPTION =
  "Describe a project idea. Dani decides whether you would still build it if nobody was watching.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: TITLE,
    // Verdict pages set their own title and get the suffix for free.
    template: `%s · ${TITLE}`,
  },
  description: DESCRIPTION,
  applicationName: TITLE,
  openGraph: {
    type: "website",
    siteName: TITLE,
    title: TITLE,
    description: DESCRIPTION,
    url: siteUrl,
    locale: "en_GB",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fbfaf6",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={sans.variable}>
      <body>
        <div className="sky" aria-hidden />
        <Astronaut />
        <main className="shell">
          {children}
          <footer className="foot">
            A parody, made for a laugh. Not affiliated with, endorsed by, or
            representative of any real person&apos;s actual opinions. Ideas get
            judged here, people do not. Nothing you type is stored.
          </footer>
        </main>
      </body>
    </html>
  );
}
