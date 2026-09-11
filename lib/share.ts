import { bandForScore } from "./dani";
import { checkOutput } from "./guards/output";
import type { JudgedVerdict, Verdict } from "./schema";

/**
 * Share links carry the verdict in the URL, so there is no database.
 *
 * SECURITY: a /v/<payload> URL is fully attacker-controlled. Anyone can craft
 * one that makes "Dani" appear to say anything, screenshot it, and post it. So
 * a decoded payload is treated exactly like raw model output — it goes through
 * the SAME output guard (schema, scrub, blocklist) before it can render.
 */

const MAX_PAYLOAD_CHARS = 2_000;

function toBase64Url(s: string): string {
  return Buffer.from(s, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(s: string): string {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64").toString("utf8");
}

export function encodeVerdict(v: Verdict): string {
  // Positional array, not an object — shorter URLs, and no key names to spoof.
  return toBase64Url(JSON.stringify([v.score, v.verdict, v.roast, v.redeemingQuality]));
}

export function decodeVerdict(payload: string): JudgedVerdict | null {
  if (!payload || payload.length > MAX_PAYLOAD_CHARS) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(payload)) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(fromBase64Url(payload));
  } catch {
    return null;
  }

  if (!Array.isArray(parsed) || parsed.length !== 4) return null;
  const [score, verdict, roast, redeemingQuality] = parsed;

  // Re-run the full output guard. The canary argument is a value that cannot
  // appear, since we only need the schema/scrub/blocklist stages here.
  const checked = checkOutput(
    JSON.stringify({ score, verdict, roast, redeemingQuality }),
    "\u0000no-canary\u0000",
  );
  if (!checked.ok) return null;

  return {
    ...checked.verdict,
    band: bandForScore(checked.verdict.score),
    source: "llm",
  };
}
