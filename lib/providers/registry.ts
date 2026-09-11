import type { ProviderConfig } from "./types";

/**
 * The fallback chain, in order. Every one of these speaks the OpenAI
 * /chat/completions shape, so "add a provider" is a base URL, a key and a
 * model name. No new integration code, ever.
 *
 * A provider is skipped unless it has BOTH a key and a model. Skipping is
 * silent and expected: run with one, run with all seven.
 *
 * Order matters. The chain stops at the first provider that answers and
 * passes the output guard, so put the biggest free allowance first and leave
 * the rest as insurance. To take one out of rotation, blank its key.
 *
 * `npm run models` prints what each configured provider actually serves
 * today. Use it before pinning a name: these get renamed and retired
 * constantly, and a stale name is a silent 404 that drops every request to
 * canned verdicts.
 */

type Entry = {
  name: string;
  baseUrl: string;
  keyVar: string;
  modelVar: string;
  /** Only used when the model var is unset. Omit where names churn. */
  defaultModel?: string;
  structured: ProviderConfig["structured"];
};

export const CATALOGUE: Entry[] = [
  {
    name: "groq",
    baseUrl: "https://api.groq.com/openai/v1",
    keyVar: "GROQ_API_KEY",
    modelVar: "GROQ_MODEL",
    defaultModel: "openai/gpt-oss-120b",
    structured: "json_object",
  },
  {
    name: "gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    keyVar: "GEMINI_API_KEY",
    modelVar: "GEMINI_MODEL",
    defaultModel: "gemini-flash-latest",
    structured: "json_object",
  },
  {
    name: "cerebras",
    baseUrl: "https://api.cerebras.ai/v1",
    keyVar: "CEREBRAS_API_KEY",
    modelVar: "CEREBRAS_MODEL",
    defaultModel: "gpt-oss-120b",
    structured: "json_schema",
  },
  // The four below have no default model on purpose. Their catalogues move
  // faster than this file will, so an unset model var skips the provider
  // instead of guessing a name that 404s.
  {
    name: "nvidia",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    keyVar: "NVIDIA_API_KEY",
    modelVar: "NVIDIA_MODEL",
    structured: "json_object",
  },
  {
    name: "github",
    baseUrl: "https://models.github.ai/inference",
    keyVar: "GITHUB_MODELS_TOKEN",
    modelVar: "GITHUB_MODEL",
    structured: "json_object",
  },
  {
    name: "openrouter",
    baseUrl: "https://openrouter.ai/api/v1",
    keyVar: "OPENROUTER_API_KEY",
    modelVar: "OPENROUTER_MODEL",
    // "Free Models Router": picks a free model at RANDOM per request. That
    // makes it immune to the stale-name problem, but the roll is genuinely
    // random and can land on a model that cannot hold a conversation (a test
    // call here was served by a content-safety classifier that returned no
    // content). Fine in this slot, second from last, where a bad answer just
    // fails the output guard and moves on. Do not promote it up the chain.
    defaultModel: "openrouter/free",
    structured: "json_object",
  },
  {
    name: "mistral",
    baseUrl: "https://api.mistral.ai/v1",
    keyVar: "MISTRAL_API_KEY",
    modelVar: "MISTRAL_MODEL",
    structured: "json_object",
  },
];

export function providerChain(): ProviderConfig[] {
  return CATALOGUE.flatMap((entry) => {
    const apiKey = process.env[entry.keyVar] ?? "";
    const model = process.env[entry.modelVar] ?? entry.defaultModel ?? "";
    if (!apiKey || !model) return [];

    return [
      {
        name: entry.name,
        baseUrl: entry.baseUrl,
        apiKey,
        model,
        structured: entry.structured,
        maxTokens: 600,
      },
    ];
  });
}
