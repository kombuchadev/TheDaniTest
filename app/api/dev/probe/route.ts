import { checkOutput } from "@/lib/guards/output";
import { buildSystemPrompt, buildUserPrompt, makeCanary } from "@/lib/prompt";
import { callProvider } from "@/lib/providers/openai-compat";
import { candidate, providerChain } from "@/lib/providers/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Development only. Puts each provider:model through the real request and the
 * real output guard, one at a time, and reports which would actually produce a
 * verdict. This is how the default model lists get picked: by result, not by
 * reading a catalogue.
 *
 *   /api/dev/probe                                   the current chain
 *   /api/dev/probe?candidates=groq:x,openrouter:y    specific models
 *
 * Returns 404 anywhere except `next dev`.
 */
export async function GET(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return new Response("Not found", { status: 404 });
  }

  const url = new URL(request.url);
  const idea =
    url.searchParams.get("idea") ??
    "A script that renames my football match recordings so I can find them. Nobody else will use it.";
  const specs = url.searchParams.get("candidates");

  const list = specs
    ? specs.split(",").map((spec) => ({ spec: spec.trim(), config: candidate(spec.trim()) }))
    : providerChain().map((config) => ({ spec: config.id, config }));

  const results: Record<string, unknown>[] = [];

  for (const { spec, config } of list) {
    if (!config) {
      results.push({ id: spec, ok: false, reason: "unknown provider or no key" });
      continue;
    }

    const canary = makeCanary();
    const started = Date.now();
    try {
      const raw = await callProvider(
        config,
        buildSystemPrompt(canary),
        buildUserPrompt(idea),
        20_000,
        new AbortController().signal,
      );
      const checked = checkOutput(raw, canary);
      results.push(
        checked.ok
          ? {
              id: config.id,
              ms: Date.now() - started,
              ok: true,
              score: checked.verdict.score,
              verdict: checked.verdict.verdict,
            }
          : {
              id: config.id,
              ms: Date.now() - started,
              ok: false,
              reason: checked.reason,
              sample: raw.slice(0, 240),
            },
      );
    } catch (e) {
      results.push({
        id: config.id,
        ms: Date.now() - started,
        ok: false,
        reason: e instanceof Error ? e.message.slice(0, 240) : "unknown",
      });
    }
  }

  return Response.json(results);
}
