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
    score: 11,
    verdict: "Dani has judged enough for one day.",
    roast: [
      "The queue is long and the ideas are short.",
      "Try again in a bit. The verdict will not improve.",
    ],
    redeemingQuality: "You showed up. That is something.",
  },
  {
    score: 17,
    verdict: "No comment. That is the comment.",
    roast: [
      "Some ideas answer themselves.",
      "This one answered before anyone asked.",
    ],
    redeemingQuality: "It is at least short.",
  },
  {
    score: 23,
    verdict: "Dani looked at this, sighed, and closed the laptop.",
    roast: [
      "The sigh was the detailed feedback.",
      "Come back when it does something.",
    ],
    redeemingQuality: "There is a real idea in here, somewhere, unattended.",
  },
  {
    score: 8,
    verdict: "Dani is currently unavailable, which is probably a mercy.",
    roast: [
      "Consider this a stay of execution.",
      "Use the time wisely.",
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
