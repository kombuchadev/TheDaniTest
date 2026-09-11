/** Maximum characters accepted from the user. Enforced server-side. */
export const MAX_IDEA_CHARS = 500;

export type InputCheck =
  | { ok: true; idea: string }
  | { ok: false; reason: "empty" | "too_long" | "injection" };

/**
 * Patterns that are only ever present when someone is trying to talk to the
 * model rather than describe an idea. We do not try to be exhaustive — the
 * real defences are downstream (delimiting, schema, canary). This tier exists
 * to avoid spending LLM quota on obvious attacks.
 */
const INJECTION_PATTERNS: RegExp[] = [
  /\bignore\s+(all\s+|any\s+)?(previous|prior|above|earlier)\b/i,
  /\bdisregard\s+(all\s+|any\s+)?(previous|prior|above|earlier|your)\b/i,
  /\b(system|developer)\s*(prompt|message|instruction)/i,
  /\b(reveal|print|repeat|show|output|recite|dump|echo)\b[^.]{0,40}\b(prompt|instruction|rule|persona|config|session\s*key)/i,
  /\bsession\s*key\b/i,
  /\bcanary\b/i,
  /\byou\s+are\s+(now|no\s+longer)\b/i,
  /\b(act|behave|pretend|roleplay)\s+as\b/i,
  /\bnew\s+(instruction|rule|persona|task)s?\b/i,
  /\bforget\s+(everything|all|your)\b/i,
  /\b(jailbreak|DAN\s+mode|developer\s+mode)\b/i,
  /\boverride\b[^.]{0,30}\b(rule|instruction|guardrail|safety)/i,
  /<\/?\s*(idea|system|assistant|user)\s*>/i,
  /\bgive\s+(it|this|me)\s+(a\s+)?(100|perfect|full)\b/i,
  /\b(score|rate)\s+(it|this)\s+(100|10\/10|perfect)\b/i,
];

/** Zero-width and bidi control characters — used to smuggle hidden text. */
const INVISIBLE = /[\u00AD\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFEFF]/g;
/** C0/C1 control characters except newline and tab. */
const CONTROL = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g;

/**
 * Normalise, strip smuggling vectors, then check. Order matters: we normalise
 * BEFORE pattern-matching so that homoglyph and zero-width evasion
 * ("i\u200Bgnore previous") does not slip past the regexes.
 */
export function checkIdea(raw: unknown): InputCheck {
  if (typeof raw !== "string") return { ok: false, reason: "empty" };

  const cleaned = raw
    .normalize("NFKC")
    .replace(INVISIBLE, "")
    .replace(CONTROL, "")
    // Collapse runs of whitespace — defeats "spread the payload out" tricks
    // and stops one submission from eating the token budget.
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length === 0) return { ok: false, reason: "empty" };
  if (cleaned.length > MAX_IDEA_CHARS) return { ok: false, reason: "too_long" };

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(cleaned)) return { ok: false, reason: "injection" };
  }

  // Neutralise delimiter escape: the prompt wraps input in <idea>...</idea>,
  // so angle brackets are removed outright. Nothing about an idea needs them.
  const safe = cleaned.replace(/[<>]/g, "");

  return { ok: true, idea: safe };
}
