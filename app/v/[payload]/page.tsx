import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Dani } from "@/components/Dani";
import { GOOD_FROM, Verdict } from "@/components/Verdict";
import { decodeVerdict } from "@/lib/share";

type Props = { params: Promise<{ payload: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { payload } = await params;
  const verdict = decodeVerdict(payload);
  if (!verdict) return { title: "The Dani Test" };

  return {
    title: `Dani gave it ${verdict.score}/100`,
    description: verdict.verdict,
    openGraph: {
      title: `Dani gave it ${verdict.score}/100`,
      description: verdict.verdict,
    },
  };
}

export default async function VerdictPage({ params }: Props) {
  const { payload } = await params;
  // Re-validated through the full output guard, so a hand-crafted URL cannot
  // put words in Dani's mouth.
  const verdict = decodeVerdict(payload);
  if (!verdict) notFound();

  return (
    <>
      <Dani reaction={verdict.score >= GOOD_FROM ? "up" : "down"} reactionKey={0} />

      <p className="subtitle">Someone was judged. Here is the damage.</p>

      <Verdict verdict={verdict} />

      <Link href="/" className="go" style={{ alignSelf: "flex-start", textDecoration: "none" }}>
        Get your own verdict
      </Link>
    </>
  );
}
