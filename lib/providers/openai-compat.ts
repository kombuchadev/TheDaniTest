import { VERDICT_JSON_SCHEMA } from "../schema";
import { ProviderError, type ProviderConfig, type StructuredMode } from "./types";

/**
 * One client for every provider. Cerebras, Groq and Gemini all expose an
 * OpenAI-compatible /chat/completions endpoint, so "switch provider" is a
 * base URL and a key — not a new integration.
 */

function body(cfg: ProviderConfig, system: string, user: string, mode: StructuredMode) {
  const base: Record<string, unknown> = {
    model: cfg.model,
    max_tokens: cfg.maxTokens,
    // Low but not zero: deterministic enough to obey the schema, loose enough
    // to be funny twice.
    temperature: 0.8,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };

  if (mode === "json_schema") {
    base.response_format = {
      type: "json_schema",
      json_schema: { name: "verdict", strict: true, schema: VERDICT_JSON_SCHEMA },
    };
  } else if (mode === "json_object") {
    base.response_format = { type: "json_object" };
  }

  return base;
}

async function once(
  cfg: ProviderConfig,
  system: string,
  user: string,
  mode: StructuredMode,
  signal: AbortSignal,
): Promise<{ text: string } | { downgrade: true }> {
  let res: Response;
  try {
    res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify(body(cfg, system, user, mode)),
      signal,
    });
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    throw new ProviderError(cfg.name, aborted ? "timeout" : "http", aborted ? "timed out" : "network error");
  }

  if (!res.ok) {
    // A 400 on json_schema usually means "this model does not support it".
    // Downgrade once rather than burning the whole provider.
    if (res.status === 400 && mode === "json_schema") return { downgrade: true };

    // In production the upstream body is never read, logged, or propagated:
    // error payloads can echo request contents and key fragments. In dev that
    // silence makes a failing provider impossible to diagnose, so read a
    // truncated copy there and there only.
    let detail = "";
    if (process.env.NODE_ENV === "development") {
      detail = `: ${(await res.text().catch(() => "")).slice(0, 300)}`;
    }
    throw new ProviderError(cfg.name, "http", `status ${res.status}${detail}`);
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new ProviderError(cfg.name, "empty", "unreadable response");
  }

  const text = (json as { choices?: { message?: { content?: unknown } }[] })
    ?.choices?.[0]?.message?.content;

  if (typeof text !== "string" || text.trim().length === 0) {
    throw new ProviderError(cfg.name, "empty", "no content");
  }

  return { text };
}

export async function callProvider(
  cfg: ProviderConfig,
  system: string,
  user: string,
  timeoutMs: number,
): Promise<string> {
  if (!cfg.apiKey) throw new ProviderError(cfg.name, "config", "no api key");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const first = await once(cfg, system, user, cfg.structured, controller.signal);
    if ("text" in first) return first.text;
    const second = await once(cfg, system, user, "json_object", controller.signal);
    if ("text" in second) return second.text;
    throw new ProviderError(cfg.name, "http", "structured output unsupported");
  } finally {
    clearTimeout(timer);
  }
}
