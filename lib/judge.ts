import { bandForScore } from "./dani";
import { checkOutput } from "./guards/output";
import { buildSystemPrompt, buildUserPrompt, makeCanary } from "./prompt";
import { cannedVerdict } from "./providers/canned";
import { callProvider } from "./providers/openai-compat";
import { providerChain } from "./providers/registry";
import type { JudgedVerdict } from "./schema";

/**
 * Total wall-clock budget for the whole chain. Vercel Hobby kills a function at
 * ~10s, so we stop well short and serve a canned verdict instead of a 504.
 */
const TOTAL_BUDGET_MS = 8_000;
/** Per-attempt ceiling. Cerebras typically answers in under 1.5s. */
const PER_ATTEMPT_MS = 4_000;

/**
 * IMPORTANT — why this does not stream:
 *
 * Streaming would push unvalidated model tokens straight to the browser, which
 * defeats every output guard (canary, schema, blocklist) in one move. The
 * response is buffered, validated in full, and only then released. The speed
 * budget is bought back by putting Cerebras first.
 */
export async function judge(idea: string): Promise<JudgedVerdict> {
  const canary = makeCanary();
  const system = buildSystemPrompt(canary);
  const user = buildUserPrompt(idea);
  const deadline = Date.now() + TOTAL_BUDGET_MS;

  for (const provider of providerChain()) {
    const remaining = deadline - Date.now();
    if (remaining < 750) break;

    try {
      const raw = await callProvider(
        provider,
        system,
        user,
        Math.min(PER_ATTEMPT_MS, remaining),
      );

      const checked = checkOutput(raw, canary);
      if (checked.ok) {
        return {
          ...checked.verdict,
          // Derived here, never taken from the model.
          band: bandForScore(checked.verdict.score),
          source: "llm",
        };
      }

      // Guard rejected it. Log the REASON only — never the rejected text, which
      // may contain the canary, the system prompt, or the user's idea.
      console.warn(`[judge] ${provider.name} rejected: ${checked.reason}`);
    } catch (e) {
      const reason = e instanceof Error ? e.message : "unknown";
      console.warn(`[judge] ${provider.name} failed: ${reason}`);
    }
  }

  const fallback = cannedVerdict(idea);
  return { ...fallback, band: bandForScore(fallback.score), source: "canned" };
}

/** An in-character response to an obvious prompt-injection attempt. */
export function niceTryVerdict(): JudgedVerdict {
  const verdict = {
    score: 1,
    verdict: "You tried to talk to the judge instead of pitching to him.",
    roast: [
      "Prompt injection is not a product idea.",
      "It is not even a good prompt injection.",
      "Describe the thing you want to build. In words. Like a person.",
    ],
    redeemingQuality: "Curiosity is a virtue. Barely, here.",
  };
  return { ...verdict, band: bandForScore(verdict.score), source: "canned" };
}
