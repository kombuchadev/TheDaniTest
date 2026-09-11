import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Dani Test",
  description: "Submit a project idea. Dani will judge it. You will not enjoy it.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-8 px-5 py-16">
          {children}
          <footer className="mt-auto pt-8 text-xs leading-relaxed text-neutral-500">
            A parody. Not affiliated with, endorsed by, or representative of any real
            person&apos;s actual opinions. Ideas are judged, people are not. Nothing you
            type is stored.
          </footer>
        </main>
      </body>
    </html>
  );
}
