import { checkIdea, MAX_IDEA_CHARS } from "@/lib/guards/input";
import { judge, niceTryVerdict } from "@/lib/judge";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { encodeVerdict } from "@/lib/share";

// node:crypto for the canary and the IP hash.
export const runtime = "nodejs";
// Never cached, never prerendered — each verdict is fresh.
export const dynamic = "force-dynamic";
// Hobby caps at ~10s; the judge budget is 8s, this is the outer net.
export const maxDuration = 30;

/** Hard cap on the request body, well above MAX_IDEA_CHARS with JSON overhead. */
const MAX_BODY_BYTES = 4_000;

const NO_STORE = {
  "content-type": "application/json",
  "cache-control": "no-store, no-cache, must-revalidate",
  "x-content-type-options": "nosniff",
  referrerpolicy: "no-referrer",
} as const;

function json(payload: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...NO_STORE, ...extra },
  });
}

export async function POST(request: Request) {
  // 1. Content type. Blocks simple-request CSRF shapes (form/text posts).
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return json({ error: "expected application/json" }, 415);
  }

  // 2. Body size, before parsing.
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) {
    return json({ error: "too long" }, 413);
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return json({ error: "too long" }, 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "malformed body" }, 400);
  }

  // 3. Rate limit BEFORE any branching, keyed on a salted hash of the IP.
  //    This deliberately sits ahead of the input guard: every outcome, including
  //    the in-character injection reply, must count against the limit. Otherwise
  //    an attacker gets an unmetered endpoint just by sending injection payloads.
  const limit = await rateLimit(clientIp(request.headers));
  if (!limit.ok) {
    return json(
      { error: "Dani needs a minute. So do you." },
      429,
      { "retry-after": String(limit.retryAfterSeconds) },
    );
  }

  // 4. Input guard: normalise, strip smuggling vectors, detect injection.
  const checked = checkIdea((body as { idea?: unknown } | null)?.idea);

  if (!checked.ok) {
    if (checked.reason === "injection") {
      // Answered in character, and without spending a single LLM token.
      const nice = niceTryVerdict();
      return json({ verdict: nice, share: encodeVerdict(nice) }, 200);
    }
    const message =
      checked.reason === "too_long"
        ? `Keep it under ${MAX_IDEA_CHARS} characters. Brevity is free.`
        : "Type something first.";
    return json({ error: message }, 400);
  }

  // 5. Judge. Cannot throw past this point — the chain has a canned floor.
  const verdict = await judge(checked.idea);
  // The share payload is built server-side so the client never needs an encoder.
  return json({ verdict, share: encodeVerdict(verdict) });
}

/** Everything else is closed. */
export async function GET() {
  return json({ error: "method not allowed" }, 405);
}
