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

export const metadata: Metadata = {
  title: "The Dani Test",
  description: "Describe a project idea. Dani decides whether you would build it if nobody was watching.",
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
