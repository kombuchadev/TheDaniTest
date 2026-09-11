import { DANI } from "../dani";
import type { Verdict } from "../schema";

/**
 * The tier that cannot fail. Used when every provider is exhausted, times out,
 * or produces something the output guard rejects.
 *
 * The rule: a visitor from a LinkedIn post must never see an error. They see
 * Dani being dismissive, which is the same thing, but funnier.
 */
const CANNED: Verdict[] = [
  {
    score: 14,
    verdict: "Dani is away from his phone. That is the whole personality.",
    roast: [
      "He will look at it eventually. Probably.",
      "The idea will not have improved by then.",
    ],
    redeemingQuality: "You built something while he was out. That counts.",
  },
  {
    score: 21,
    verdict: "No comment. That is the comment.",
    roast: [
      "Some ideas answer themselves.",
      "This one answered before anyone asked.",
    ],
    redeemingQuality: "It is at least short.",
  },
  {
    score: 17,
    verdict: "Dani has gone to play football. Try later.",
    roast: [
      "He did not ask what the idea was.",
      "That is not rudeness, he genuinely just left.",
    ],
    redeemingQuality: "Nothing here needed his approval anyway.",
  },
  {
    score: 9,
    verdict: "Dani is not looking at this right now, which tells you something.",
    roast: [
      "Consider this a stay of execution.",
      "Use it to go build the thing instead of describing it.",
    ],
    redeemingQuality: "Timing, at least, is on your side.",
  },
];

/** Deterministic per idea, so a refresh does not reroll the same joke. */
export function cannedVerdict(seed: string): Verdict {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % CANNED.length;
  return CANNED[index]!;
}

export const CANNED_LINES = DANI.cannedVerdicts;
