import { VERDICT_JSON_SCHEMA } from "../schema";
import { ProviderError, type ProviderConfig, type StructuredMode } from "./types";

/**
 * One client for every provider. They all expose an OpenAI-compatible
 * /chat/completions endpoint, so "switch provider" is a base URL and a key,
 * not a new integration.
 */

/** Each 400 on a structured-output mode steps down to the next one. */
const MODES: StructuredMode[] = ["json_schema", "json_object", "none"];

function body(cfg: ProviderConfig, system: string, user: string, mode: StructuredMode) {
  const base: Record<string, unknown> = {
    model: cfg.model,
    max_tokens: cfg.maxTokens,
    // Low enough to obey the schema, loose enough to be funny twice.
    temperature: 0.8,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    ...cfg.extraBody,
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
  cancelled: AbortSignal,
): Promise<{ text: string } | { downgrade: true }> {
  // A request that lost the race is not a failure, so it must not bench the
  // provider or show up in the logs as one.
  const abortedOrTimedOut = () =>
    cancelled.aborted
      ? new ProviderError(cfg.id, "aborted", "cancelled")
      : new ProviderError(cfg.id, "timeout", "timed out");

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
  } catch {
    if (signal.aborted) throw abortedOrTimedOut();
    throw new ProviderError(cfg.id, "http", "network error");
  }

  if (!res.ok) {
    // Usually "this model does not support that response_format". Stepping
    // down costs one call; giving up costs the whole provider.
    if (res.status === 400 && mode !== "none") return { downgrade: true };

    // In production the upstream body is never read, logged, or propagated:
    // error payloads can echo request contents and key fragments. In dev that
    // silence makes a failing provider impossible to diagnose.
    let detail = "";
    if (process.env.NODE_ENV === "development") {
      detail = `: ${(await res.text().catch(() => "")).slice(0, 300)}`;
    }
    throw new ProviderError(cfg.id, "http", `status ${res.status}${detail}`, res.status);
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    if (signal.aborted) throw abortedOrTimedOut();
    throw new ProviderError(cfg.id, "empty", "unreadable response");
  }

  const text = (json as { choices?: { message?: { content?: unknown } }[] })?.choices?.[0]
    ?.message?.content;

  if (typeof text !== "string" || text.trim().length === 0) {
    throw new ProviderError(cfg.id, "empty", "no content");
  }

  return { text };
}

export async function callProvider(
  cfg: ProviderConfig,
  system: string,
  user: string,
  timeoutMs: number,
  /** Aborted when another attempt has already won. */
  cancelled: AbortSignal,
): Promise<string> {
  if (!cfg.apiKey) throw new ProviderError(cfg.id, "config", "no api key");

  const signal = AbortSignal.any([cancelled, AbortSignal.timeout(timeoutMs)]);

  for (const mode of MODES.slice(MODES.indexOf(cfg.structured))) {
    const result = await once(cfg, system, user, mode, signal, cancelled);
    if ("text" in result) return result.text;
  }

  throw new ProviderError(cfg.id, "http", "rejected every response format", 400);
}
