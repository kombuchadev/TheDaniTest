import type { ProviderConfig } from "./types";

/**
 * The fallback chain, in order. A provider with no key is silently skipped, so
 * the app runs with zero, one, or all three configured — locally you can set
 * none at all and still get canned verdicts.
 *
 * Every value is server-side env. Nothing here is NEXT_PUBLIC_.
 */
export function providerChain(): ProviderConfig[] {
  const chain: ProviderConfig[] = [
    {
      name: "cerebras",
      baseUrl: "https://api.cerebras.ai/v1",
      apiKey: process.env.CEREBRAS_API_KEY ?? "",
      model: process.env.CEREBRAS_MODEL ?? "gpt-oss-120b",
      structured: "json_schema",
      maxTokens: 600,
    },
    {
      name: "groq",
      baseUrl: "https://api.groq.com/openai/v1",
      apiKey: process.env.GROQ_API_KEY ?? "",
      model: process.env.GROQ_MODEL ?? "openai/gpt-oss-120b",
      structured: "json_object",
      maxTokens: 600,
    },
    {
      name: "gemini",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
      apiKey: process.env.GEMINI_API_KEY ?? "",
      model: process.env.GEMINI_MODEL ?? "gemini-flash-latest",
      structured: "json_object",
      maxTokens: 600,
    },
  ];

  return chain.filter((p) => p.apiKey.length > 0);
}
