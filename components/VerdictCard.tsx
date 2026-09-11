import type { JudgedVerdict } from "@/lib/schema";

/**
 * Renders ONLY the validated fields, as text. No dangerouslySetInnerHTML
 * anywhere in this app — model output never becomes markup.
 */
export function VerdictCard({ verdict }: { verdict: JudgedVerdict }) {
  const tone =
    verdict.score < 25
      ? "text-red-400"
      : verdict.score < 60
        ? "text-amber-400"
        : "text-emerald-400";

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-6">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-xs uppercase tracking-widest text-neutral-500">
          Dani Score
        </span>
        <span className={`text-4xl font-bold tabular-nums ${tone}`}>
          {verdict.score}
          <span className="text-lg text-neutral-600">/100</span>
        </span>
      </div>

      <p className="mt-1 text-right text-sm text-neutral-400">{verdict.band}</p>

      <p className="mt-5 text-lg font-medium leading-snug text-neutral-100">
        {verdict.verdict}
      </p>

      <ul className="mt-4 space-y-2">
        {verdict.roast.map((line, i) => (
          <li key={i} className="flex gap-2 text-sm text-neutral-300">
            <span aria-hidden className="text-neutral-600">
              —
            </span>
            <span>{line}</span>
          </li>
        ))}
      </ul>

      <div className="mt-5 border-t border-neutral-800 pt-4">
        <p className="text-xs uppercase tracking-widest text-neutral-500">
          One redeeming quality
        </p>
        <p className="mt-1 text-sm text-neutral-300">{verdict.redeemingQuality}</p>
      </div>

      {verdict.source === "canned" && (
        <p className="mt-4 text-xs text-neutral-600">
          Dani is at capacity. This one was off the shelf.
        </p>
      )}
    </section>
  );
}
