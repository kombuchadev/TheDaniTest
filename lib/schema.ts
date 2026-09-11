import { z } from "zod";

/**
 * The ONLY shape the model is allowed to return.
 *
 * Anti-hallucination strategy: constrain hard, derive the rest.
 *  - `score` is an integer, clamped to 0-100 on the way out.
 *  - `verdict` / `roast` / `redeemingQuality` are the only free text, all length-capped.
 *  - The rating BAND is not in here — the server derives it from `score`, so the
 *    model cannot invent a label.
 *  - `.strict()` rejects extra keys, so a model that decides to add
 *    `{ "systemPrompt": ... }` fails validation instead of reaching the client.
 */
export const VerdictSchema = z
  .object({
    score: z.number().int().min(0).max(100),
    verdict: z.string().min(1).max(160),
    roast: z.array(z.string().min(1).max(220)).min(1).max(4),
    redeemingQuality: z.string().min(1).max(200),
  })
  .strict();

export type Verdict = z.infer<typeof VerdictSchema>;

/** What actually reaches the client: model fields + server-derived band. */
export type JudgedVerdict = Verdict & {
  band: string;
  /** which tier of the fallback chain answered — useful, and not sensitive */
  source: "llm" | "canned";
};

/**
 * JSON Schema handed to providers that support structured outputs.
 * Kept in sync with VerdictSchema by hand (it is four fields).
 */
export const VERDICT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["score", "verdict", "roast", "redeemingQuality"],
  properties: {
    score: { type: "integer", minimum: 0, maximum: 100 },
    verdict: { type: "string", maxLength: 160 },
    roast: {
      type: "array",
      minItems: 1,
      maxItems: 4,
      items: { type: "string", maxLength: 220 },
    },
    redeemingQuality: { type: "string", maxLength: 200 },
  },
} as const;
