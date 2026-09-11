export type StructuredMode = "json_schema" | "json_object" | "none";

export type ProviderConfig = {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  structured: StructuredMode;
  maxTokens: number;
};

export class ProviderError extends Error {
  constructor(
    readonly provider: string,
    readonly kind: "config" | "http" | "timeout" | "empty",
    /** Deliberately terse. Never carries the upstream body — it can echo keys. */
    message: string,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
