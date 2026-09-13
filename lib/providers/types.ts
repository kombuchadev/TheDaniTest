export type StructuredMode = "json_schema" | "json_object" | "none";

export type ProviderConfig = {
  /** "provider:model". Unique per chain entry; used in logs and the bench. */
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  structured: StructuredMode;
  maxTokens: number;
  /** Provider-specific request fields, merged into the request body. */
  extraBody?: Record<string, unknown>;
};

export class ProviderError extends Error {
  constructor(
    readonly provider: string,
    readonly kind: "config" | "http" | "timeout" | "empty" | "aborted",
    /** Deliberately terse. Never carries the upstream body in production. */
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
