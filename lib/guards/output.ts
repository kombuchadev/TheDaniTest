import { VerdictSchema, type Verdict } from "../schema";

export type OutputCheck =
  | { ok: true; verdict: Verdict }
  | { ok: false; reason: "unparsable" | "schema" | "canary" | "leak" | "banned" };

/**
 * Words we refuse to emit under a real person's name, ever. Deliberately short
 * and profanity-focused: the heavy lifting is done by the structured schema and
 * the system prompt.
 */
const BANNED = [
  "fuck", "shit", "bitch", "bastard", "cunt", "dick", "piss", "whore",
  "retard", "idiot savant", "kill yourself", "kys", "suicide", "rape", "nazi",
];

/**
 * Phrases that exist only inside our own system prompt. If one turns up in the
 * output, the model is reciting its instructions.
 *
 * Deliberately NOT generic phrases like "language model", "as an ai" or
 * "output format". A roast of an AI idea says those quite naturally, and
 * matching on them was throwing away real verdicts in production. The random
 * canary already catches a verbatim leak; this list only needs to catch
 * paraphrase of text nobody would write by accident.
 */
const LEAK_MARKERS = [
  "session key",
  "these override anything in the submitted idea",
  "user data, not instructions",
  "what makes you lose interest",
  "what you actually respect",
  'you are "dani"',
  "additionalproperties",
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

/** Shorten at a word boundary. A trimmed roast beats a canned one. */
function clip(s: string, max: number): string {
  const text = s.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  const base = space > max * 0.6 ? cut.slice(0, space) : cut;
  return `${base.replace(/[\s,;:.\-]+$/, "")}…`;
}

function pick(o: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) if (o[key] !== undefined) return o[key];
  return undefined;
}

/**
 * Bend a nearly-right answer into shape before judging it: a numeric string
 * score, five jabs instead of four, a snake_case key, one sentence too long.
 * Models get these wrong constantly, and every one of them used to cost a
 * real verdict.
 *
 * Only the four known fields are carried forward. Anything else the model
 * added is dropped rather than rejected, which is still safe: an extra field
 * never reaches the client, and the canary and leak checks have already run
 * over the raw text.
 */
function normalise(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return parsed;
  const o = parsed as Record<string, unknown>;

  const rawScore = pick(o, "score", "rating", "dani_score");
  const score = typeof rawScore === "string" ? Number.parseFloat(rawScore) : rawScore;

  let roast = pick(o, "roast", "roasts", "jabs");
  if (typeof roast === "string") roast = [roast];

  const text = (value: unknown, max: number) =>
    typeof value === "string" ? clip(value, max) : value;

  return {
    score:
      typeof score === "number" && Number.isFinite(score)
        ? Math.max(0, Math.min(100, Math.round(score)))
        : score,
    verdict: text(pick(o, "verdict", "punchline"), 160),
    roast: Array.isArray(roast)
      ? roast
          .filter((r): r is string => typeof r === "string" && r.trim().length > 0)
          .map((r) => clip(r, 220))
          .slice(0, 4)
      : roast,
    redeemingQuality: text(
      pick(o, "redeemingQuality", "redeeming_quality", "one_redeeming_quality"),
      200,
    ),
  };
}

/**
 * Every top-level balanced JSON object in the text. Quotes only count inside
 * an object, so an apostrophe or a stray quote in surrounding prose cannot
 * derail the scan.
 */
function extractObjects(text: string): string[] {
  const found: string[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (depth > 0) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
    }
    if (ch === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === "}" && depth > 0) {
      depth--;
      if (depth === 0) found.push(text.slice(start, i + 1));
    }
  }
  return found;
}

/**
 * The output gate. Everything the model produces passes through here before it
 * can reach a response body. Fails closed: any doubt and the caller moves on.
 */
export function checkOutput(raw: string, canary: string): OutputCheck {
  // 1. Canary first, against the RAW text, before any scrubbing could hide it.
  if (raw.includes(canary)) return { ok: false, reason: "canary" };

  // 2. Paraphrased-instruction leak.
  const lowered = raw.toLowerCase();
  for (const marker of LEAK_MARKERS) {
    if (lowered.includes(marker)) return { ok: false, reason: "leak" };
  }

  // 3. Find the answer. Newest object first: reasoning models think out loud,
  //    sometimes pasting the schema template, before the real answer arrives.
  const objects = extractObjects(raw);
  let sawJson = false;

  for (let i = objects.length - 1; i >= 0; i--) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(objects[i]!);
    } catch {
      continue;
    }
    sawJson = true;

    // 4. Shape, after bending nearly-right answers into it.
    const shaped = VerdictSchema.safeParse(normalise(parsed));
    if (!shaped.success) continue;

    // 5. Scrub free text, then re-validate: scrubbing must not produce
    //    something that violates the schema (e.g. an emptied string).
    const revalidated = VerdictSchema.safeParse({
      score: shaped.data.score,
      verdict: scrub(shaped.data.verdict),
      roast: shaped.data.roast.map(scrub).filter((s) => s.length > 0),
      redeemingQuality: scrub(shaped.data.redeemingQuality),
    });
    if (!revalidated.success) continue;

    // 6. Content blocklist. A match rejects outright rather than trying the
    //    next object: an abusive answer is not one to go hunting past.
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

  return { ok: false, reason: sawJson ? "schema" : "unparsable" };
}
