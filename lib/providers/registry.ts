import type { ProviderConfig } from "./types";

/**
 * Every provider here speaks the OpenAI /chat/completions shape, so adding
 * one is a base URL, a key and a list of models. No new integration code.
 *
 * WHY MANY MODELS PER PROVIDER: free tiers are rate limited per model, not
 * per account. Listing two models on Groq is two daily allowances, and a model
 * that is rate limited or retired does not take the whole provider down with it.
 *
 * A provider takes part only if its key is set. Its models come from the
 * model env var (comma separated) when set, otherwise from the defaults below.
 * Prefer the defaults: every one was picked by running candidates through
 * `/api/dev/probe`, which uses the real request and the real output guard, and
 * keeping only those that produced a verdict. A pinned env value replaces the
 * list entirely, so a stale pin quietly undoes that.
 */

type Entry = {
  name: string;
  baseUrl: string;
  keyVar: string;
  modelVar: string;
  defaultModels: string[];
  structured: ProviderConfig["structured"];
  extraBody?: (model: string) => Record<string, unknown> | undefined;
};

/** Reasoning models spend tokens thinking before they answer. */
const MAX_TOKENS = 1200;

export const CATALOGUE: Entry[] = [
  {
    name: "groq",
    baseUrl: "https://api.groq.com/openai/v1",
    keyVar: "GROQ_API_KEY",
    modelVar: "GROQ_MODEL",
    // Both answered in about a second in the probe.
    // Left out on purpose:
    //   openai/gpt-oss-20b    pasted our JSON schema into its answer
    //   qwen/qwen3.6-27b      free output-token limit is below what we ask for
    //   groq/compound(-mini)  an agent that runs its own web searches, which
    //                         would send people's ideas to a search provider
    defaultModels: ["openai/gpt-oss-120b", "qwen/qwen3.8-27b"],
    structured: "json_object",
    // gpt-oss thinks by default. For a two-line roast that is wasted latency
    // and wasted tokens against the daily allowance.
    extraBody: (model) =>
      model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : undefined,
  },
  {
    name: "gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    keyVar: "GEMINI_API_KEY",
    modelVar: "GEMINI_MODEL",
    // "-latest" aliases track the current release, so a rename upstream does
    // not quietly break us. Lite first: 1.2s against 3.8s in the probe, with
    // its own separate allowance.
    defaultModels: ["gemini-flash-lite-latest", "gemini-flash-latest"],
    structured: "json_object",
  },
  {
    name: "openrouter",
    baseUrl: "https://openrouter.ai/api/v1",
    keyVar: "OPENROUTER_API_KEY",
    modelVar: "OPENROUTER_MODEL",
    // Both work but take around 13s, so they matter only when Groq and Gemini
    // are both failing. Not "openrouter/free": it picks a model at random and
    // landed on a safety classifier that returns no verdict, both times tested.
    defaultModels: ["nex-agi/nex-n2.5-pro:free", "nvidia/nemotron-3-super-120b-a12b:free"],
    structured: "json_object",
  },
  // No defaults below: add a key, probe, and pin the models that pass.
  {
    name: "nvidia",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    keyVar: "NVIDIA_API_KEY",
    modelVar: "NVIDIA_MODEL",
    defaultModels: [],
    structured: "json_object",
  },
  {
    name: "github",
    baseUrl: "https://models.github.ai/inference",
    keyVar: "GITHUB_MODELS_TOKEN",
    modelVar: "GITHUB_MODEL",
    defaultModels: [],
    structured: "json_object",
  },
  {
    name: "mistral",
    baseUrl: "https://api.mistral.ai/v1",
    keyVar: "MISTRAL_API_KEY",
    modelVar: "MISTRAL_MODEL",
    defaultModels: [],
    structured: "json_object",
  },
];

function keyFor(entry: Entry): string {
  return process.env[entry.keyVar]?.trim() ?? "";
}

function modelsFor(entry: Entry): string[] {
  const pinned = process.env[entry.modelVar]?.trim();
  const list = pinned ? pinned.split(",") : entry.defaultModels;
  return [...new Set(list.map((m) => m.trim()).filter(Boolean))];
}

function configFor(entry: Entry, model: string, apiKey: string): ProviderConfig {
  return {
    id: `${entry.name}:${model}`,
    name: entry.name,
    baseUrl: entry.baseUrl,
    apiKey,
    model,
    structured: entry.structured,
    maxTokens: MAX_TOKENS,
    extraBody: entry.extraBody?.(model),
  };
}

/**
 * Round robin across providers: every provider's first model, then every
 * provider's second, and so on. When a whole provider is down, the next
 * attempt is a different company rather than a sibling model on the same
 * broken endpoint.
 */
export function providerChain(): ProviderConfig[] {
  const perProvider = CATALOGUE.map((entry) => {
    const apiKey = keyFor(entry);
    return apiKey ? modelsFor(entry).map((model) => configFor(entry, model, apiKey)) : [];
  });

  const chain: ProviderConfig[] = [];
  const depth = Math.max(0, ...perProvider.map((list) => list.length));
  for (let i = 0; i < depth; i++) {
    for (const list of perProvider) {
      const next = list[i];
      if (next) chain.push(next);
    }
  }
  return chain;
}

/** "provider:model" to a config, for the dev probe. Null if no key. */
export function candidate(spec: string): ProviderConfig | null {
  const split = spec.indexOf(":");
  if (split === -1) return null;
  const entry = CATALOGUE.find((e) => e.name === spec.slice(0, split));
  const model = spec.slice(split + 1).trim();
  if (!entry || !model) return null;
  const apiKey = keyFor(entry);
  return apiKey ? configFor(entry, model, apiKey) : null;
}
