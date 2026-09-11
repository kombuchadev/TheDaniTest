import { createHash } from "node:crypto";

/**
 * Fixed-window rate limiting, backed by Upstash Redis over plain REST (no SDK
 * dependency) and degrading to an in-process map when Upstash is not
 * configured — so `npm run dev` works with an empty .env.
 *
 * PRIVACY: the raw IP is never stored, logged, or sent anywhere. Only a salted
 * SHA-256 prefix is used as the key. Without RATELIMIT_SALT the hash is still
 * computed, just with a weaker salt — set it in production.
 */

const WINDOWS = [
  { name: "min", seconds: 60, max: 5 },
  { name: "day", seconds: 86_400, max: 30 },
] as const;

export type RateResult = { ok: true } | { ok: false; retryAfterSeconds: number };

function hashIp(ip: string): string {
  const salt = process.env.RATELIMIT_SALT ?? "dani-test-default-salt";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 24);
}

/** Trust only the proxy header Vercel sets; fall back to a shared bucket. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first && first.length > 0 ? first : "unknown";
}

// ---------- in-memory fallback ----------

const memory = new Map<string, { count: number; resetAt: number }>();

function memoryHit(key: string, seconds: number, max: number): RateResult {
  const now = Date.now();
  const entry = memory.get(key);

  if (!entry || entry.resetAt <= now) {
    memory.set(key, { count: 1, resetAt: now + seconds * 1000 });
    if (memory.size > 10_000) {
      for (const [k, v] of memory) if (v.resetAt <= now) memory.delete(k);
    }
    return { ok: true };
  }

  entry.count += 1;
  if (entry.count > max) {
    return { ok: false, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { ok: true };
}

// ---------- upstash ----------

async function upstashHit(
  url: string,
  token: string,
  key: string,
  seconds: number,
  max: number,
): Promise<RateResult> {
  const res = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify([
      ["INCR", key],
      ["EXPIRE", key, String(seconds), "NX"],
      ["TTL", key],
    ]),
    // Never let the limiter itself blow the request budget.
    signal: AbortSignal.timeout(1_500),
  });

  if (!res.ok) throw new Error(`upstash ${res.status}`);

  const rows = (await res.json()) as { result?: unknown }[];
  const count = Number(rows[0]?.result ?? 0);
  const ttl = Number(rows[2]?.result ?? seconds);

  if (count > max) {
    return { ok: false, retryAfterSeconds: ttl > 0 ? ttl : seconds };
  }
  return { ok: true };
}

/**
 * Checks every window. Fails OPEN if Upstash is unreachable: a limiter outage
 * must not take down a joke app, and the LLM chain has its own canned floor.
 */
export async function rateLimit(ip: string): Promise<RateResult> {
  const id = hashIp(ip);
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  for (const window of WINDOWS) {
    const key = `dani:${window.name}:${id}`;
    try {
      const result =
        url && token
          ? await upstashHit(url, token, key, window.seconds, window.max)
          : memoryHit(key, window.seconds, window.max);
      if (!result.ok) return result;
    } catch {
      // Degrade to the in-process limiter rather than dropping the guard entirely.
      const result = memoryHit(key, window.seconds, window.max);
      if (!result.ok) return result;
    }
  }

  return { ok: true };
}
