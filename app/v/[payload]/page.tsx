import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { VerdictCard } from "@/components/VerdictCard";
import { decodeVerdict } from "@/lib/share";

type Props = { params: Promise<{ payload: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { payload } = await params;
  const verdict = decodeVerdict(payload);
  if (!verdict) return { title: "The Dani Test" };

  return {
    title: `Dani Score: ${verdict.score}/100`,
    description: verdict.verdict,
    openGraph: {
      title: `Dani Score: ${verdict.score}/100`,
      description: verdict.verdict,
    },
  };
}

export default async function VerdictPage({ params }: Props) {
  const { payload } = await params;
  // Re-validated through the full output guard — a hand-crafted URL cannot
  // put words in Dani's mouth.
  const verdict = decodeVerdict(payload);
  if (!verdict) notFound();

  return (
    <>
      <header>
        <h1 className="text-3xl font-bold tracking-tight">The Dani Test</h1>
        <p className="mt-2 text-neutral-400">Someone was judged. Here is the damage.</p>
      </header>

      <VerdictCard verdict={verdict} />

      <Link
        href="/"
        className="self-start rounded-lg bg-neutral-100 px-5 py-2 text-sm font-semibold text-neutral-900"
      >
        Get your own verdict
      </Link>
    </>
  );
}
