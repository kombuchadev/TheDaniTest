import { bandForScore } from "./dani";
import { checkOutput } from "./guards/output";
import { buildSystemPrompt, buildUserPrompt, makeCanary } from "./prompt";
import { cannedVerdict } from "./providers/canned";
import { callProvider } from "./providers/openai-compat";
import { providerChain } from "./providers/registry";
import { ProviderError, type ProviderConfig } from "./providers/types";
import type { JudgedVerdict, Verdict } from "./schema";

/**
 * How long a visitor waits, at most, before getting a canned verdict. Vercel
 * Hobby lets a function run for 300s, so this is a patience limit, not a
 * platform one. The route's maxDuration sits above it as the outer net.
 */
const TOTAL_BUDGET_MS = 25_000;
/** One slow model cannot eat the whole budget. */
const ATTEMPT_TIMEOUT_MS = 12_000;
/**
 * If the running attempt has not answered in this long, start the next one
 * alongside it and keep whichever passes the output guard first. A failure
 * starts the next one immediately. Most requests answer well inside this
 * window, so most requests still cost exactly one call.
 */
const HEDGE_AFTER_MS = 3_000;
const MAX_IN_FLIGHT = 3;

/**
 * provider:model -> time it is benched until. Stops every visitor paying a
 * guaranteed failed round trip to a model that just said 402 or 404. Lives in
 * server instance memory, so each instance learns separately; that is fine,
 * the point is to skip dead weight on the next request, not to be exact.
 */
const bench = new Map<string, number>();

function benchFor(e: unknown): number {
  if (!(e instanceof ProviderError)) return 15_000;
  if (e.kind === "aborted") return 0;
  if (e.kind === "config") return 30 * 60_000;
  if (e.kind === "timeout") return 20_000;
  if (e.kind === "empty") return 60_000;
  const status = e.status ?? 0;
  // Bad key, no credit, retired model: will not fix itself in minutes.
  if ([401, 402, 403, 404].includes(status)) return 30 * 60_000;
  if (status === 429) return 60_000;
  if (status >= 500) return 20_000;
  // Any other 4xx most likely means this model rejects our request shape.
  return 5 * 60_000;
}

/**
 * IMPORTANT: this does not stream. Streaming would push unvalidated model
 * tokens straight to the browser and defeat every output guard. Responses are
 * buffered, validated in full, and only then released.
 */
export async function judge(idea: string): Promise<JudgedVerdict> {
  const canary = makeCanary();
  const system = buildSystemPrompt(canary);
  const user = buildUserPrompt(idea);

  const all = providerChain();
  const now = Date.now();
  const awake = all.filter((p) => (bench.get(p.id) ?? 0) <= now);
  if (awake.length < all.length) {
    const benched = all.filter((p) => !awake.includes(p)).map((p) => p.id);
    console.info(`[judge] skipping benched: ${benched.join(", ")}`);
  }
  // If everything is benched, try it all anyway. A stale bench should never be
  // the reason someone gets a canned verdict.
  const candidates = awake.length > 0 ? awake : all;

  const verdict = await race(candidates, system, user, canary);
  if (verdict) {
    return { ...verdict, band: bandForScore(verdict.score), source: "llm" };
  }

  const fallback = cannedVerdict(idea);
  return { ...fallback, band: bandForScore(fallback.score), source: "canned" };
}

function race(
  candidates: ProviderConfig[],
  system: string,
  user: string,
  canary: string,
): Promise<Verdict | null> {
  const controller = new AbortController();
  const started = Date.now();
  const deadline = started + TOTAL_BUDGET_MS;

  return new Promise((resolve) => {
    let next = 0;
    let inFlight = 0;
    let settled = false;
    let hedge: ReturnType<typeof setTimeout> | undefined;

    const finish = (verdict: Verdict | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(hedge);
      clearTimeout(budget);
      // Cancel the attempts that lost.
      controller.abort();
      resolve(verdict);
    };
    const budget = setTimeout(() => finish(null), TOTAL_BUDGET_MS);

    const attempt = async (p: ProviderConfig): Promise<Verdict | null> => {
      const remaining = deadline - Date.now();
      if (remaining < 750) return null;

      try {
        const raw = await callProvider(
          p,
          system,
          user,
          Math.min(ATTEMPT_TIMEOUT_MS, remaining),
          controller.signal,
        );
        const checked = checkOutput(raw, canary);
        if (checked.ok) {
          bench.delete(p.id);
          console.info(`[judge] answered by ${p.id} in ${Date.now() - started}ms`);
          return checked.verdict;
        }
        // Log the REASON only, never the rejected text, which may contain the
        // canary, the system prompt, or the user's idea.
        console.warn(`[judge] ${p.id} rejected: ${checked.reason}`);
      } catch (e) {
        // Lost the race. Not a failure, so no bench and no log line.
        if (e instanceof ProviderError && e.kind === "aborted") return null;
        const ms = benchFor(e);
        if (ms > 0) bench.set(p.id, Date.now() + ms);
        console.warn(`[judge] ${p.id} failed: ${e instanceof Error ? e.message : "unknown"}`);
      }
      return null;
    };

    const launch = () => {
      if (settled) return;
      if (next >= candidates.length) {
        if (inFlight === 0) finish(null);
        return;
      }
      if (inFlight >= MAX_IN_FLIGHT) return;

      const p = candidates[next++]!;
      inFlight++;
      clearTimeout(hedge);
      hedge = setTimeout(launch, HEDGE_AFTER_MS);

      void attempt(p).then((verdict) => {
        inFlight--;
        if (verdict) finish(verdict);
        else launch();
      });
    };

    launch();
  });
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
