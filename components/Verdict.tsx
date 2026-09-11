import type { JudgedVerdict } from "@/lib/schema";

/** Anything at or above this reads as approval, and Dani gives a thumbs up. */
export const GOOD_FROM = 50;

/**
 * Renders ONLY the validated fields, as text. No dangerouslySetInnerHTML
 * anywhere in this app: model output never becomes markup.
 */
export function Verdict({ verdict }: { verdict: JudgedVerdict }) {
  const good = verdict.score >= GOOD_FROM;

  return (
    <section className="verdict">
      <div className="score-row">
        <span className="score" data-good={good}>
          {verdict.score}
        </span>
        <span className="out-of">/100</span>
        <span className="band">{verdict.band}</span>
      </div>

      <p className="punchline">{verdict.verdict}</p>

      <ul className="jabs">
        {verdict.roast.map((line, i) => (
          <li key={i} style={{ animationDelay: `${120 + i * 90}ms` }}>
            {line}
          </li>
        ))}
      </ul>

      <div className="grudging">
        <span className="label">One redeeming quality</span>
        <p>{verdict.redeemingQuality}</p>
      </div>

      {verdict.source === "canned" && (
        <p className="note">Dani is at capacity. This one came off the shelf.</p>
      )}
    </section>
  );
}
