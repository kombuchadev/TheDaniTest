import { VerdictSchema, type Verdict } from "../schema";

export type OutputCheck =
  | { ok: true; verdict: Verdict }
  | { ok: false; reason: "unparsable" | "schema" | "canary" | "leak" | "banned" };

/**
 * Words we refuse to emit under a real person's name, ever. Deliberately short
 * and profanity-focused: the heavy lifting is done by the structured schema and
 * the system prompt. Swap for a maintained library (e.g. `obscenity`) if this
 * ever faces real traffic.
 */
const BANNED = [
  "fuck", "shit", "bitch", "bastard", "cunt", "dick", "piss", "whore",
  "retard", "idiot savant", "kill yourself", "kys", "suicide", "rape", "nazi",
];

/**
 * Phrases that only appear if the model started reciting its own configuration.
 * The canary is the precise check; this catches paraphrase, which the canary
 * by definition cannot.
 */
const LEAK_MARKERS = [
  "system prompt", "hard rules", "session key", "you are \"dani\"",
  "output format", "output json only", "instructions above", "my instructions",
  "as an ai", "language model", "verdict_json_schema", "additionalproperties",
];

/** URLs, emails, and long digit runs: exfiltration shapes, and spam shapes. */
const URL_RE = /\b(?:https?:\/\/|www\.)\S+/gi;
const EMAIL_RE = /\b[\w.+-]+@[\w-]+\.[\w.]+\b/gi;
const LONG_DIGITS = /\b\d{7,}\b/g;
/** Markdown/HTML that could survive into the UI as markup. */
const MARKUP_RE = /[<>`*_~\[\]]/g;

function scrub(s: string): string {
  // Markup first: stripping brackets AFTER redaction would eat the
  // "[redacted]" marker we just inserted.
  return s
    .replace(MARKUP_RE, "")
    .replace(URL_RE, "[redacted]")
    .replace(EMAIL_RE, "[redacted]")
    .replace(LONG_DIGITS, "[redacted]")
    .replace(/\s+/g, " ")
    .trim();
}

/** Strip a ```json fence if the model added one despite being told not to. */
function stripFence(raw: string): string {
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fence?.[1] ?? raw).trim();
}

/** Pull the first balanced top-level JSON object out of a noisy response. */
function extractJson(raw: string): string | null {
  const text = stripFence(raw);
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i]!;
    if (escaped) { escaped = false; continue; }
    if (ch === "\\") { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * The output gate. Everything the model produces passes through here before it
 * can reach a response body. Fails closed — any doubt and the caller falls back
 * to a canned verdict.
 */
export function checkOutput(raw: string, canary: string): OutputCheck {
  // 1. Canary first, against the RAW text — before any scrubbing could hide it.
  if (raw.includes(canary)) return { ok: false, reason: "canary" };

  const lowered = raw.toLowerCase();
  // 2. Paraphrased-instruction leak.
  for (const marker of LEAK_MARKERS) {
    if (lowered.includes(marker)) return { ok: false, reason: "leak" };
  }

  // 3. Parse.
  const json = extractJson(raw);
  if (!json) return { ok: false, reason: "unparsable" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, reason: "unparsable" };
  }

  // 4. Shape. `.strict()` means unexpected keys are a hard failure.
  const result = VerdictSchema.safeParse(parsed);
  if (!result.success) return { ok: false, reason: "schema" };

  // 5. Scrub free text, then re-validate — scrubbing must not produce
  //    something that violates the schema (e.g. an emptied string).
  const scrubbed: Verdict = {
    score: Math.max(0, Math.min(100, Math.round(result.data.score))),
    verdict: scrub(result.data.verdict),
    roast: result.data.roast.map(scrub).filter((s) => s.length > 0),
    redeemingQuality: scrub(result.data.redeemingQuality),
  };

  const revalidated = VerdictSchema.safeParse(scrubbed);
  if (!revalidated.success) return { ok: false, reason: "schema" };

  // 6. Content blocklist, on the scrubbed text only.
  const all = [
    revalidated.data.verdict,
    ...revalidated.data.roast,
    revalidated.data.redeemingQuality,
  ]
    .join(" ")
    .toLowerCase();

  for (const word of BANNED) {
    if (all.includes(word)) return { ok: false, reason: "banned" };
  }

  return { ok: true, verdict: revalidated.data };
}
