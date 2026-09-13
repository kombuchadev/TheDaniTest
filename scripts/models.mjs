/**
 * Ask every configured provider what it actually serves today.
 *
 *   npm run models            every provider with a key
 *   npm run models groq       just one
 *
 * Model names get renamed and retired constantly, and a stale one is a silent
 * 404. This lists catalogues only, so it costs no tokens. To find out whether
 * a model can actually produce a verdict, use /api/dev/probe instead.
 */

import { readFileSync } from "node:fs";

// Mirrors lib/providers/registry.ts. Duplicated because that file is TS and
// this runs as plain node with no build step.
const PROVIDERS = [
  ["groq", "https://api.groq.com/openai/v1", "GROQ_API_KEY", "GROQ_MODEL"],
  [
    "gemini",
    "https://generativelanguage.googleapis.com/v1beta/openai",
    "GEMINI_API_KEY",
    "GEMINI_MODEL",
  ],
  ["openrouter", "https://openrouter.ai/api/v1", "OPENROUTER_API_KEY", "OPENROUTER_MODEL"],
  ["nvidia", "https://integrate.api.nvidia.com/v1", "NVIDIA_API_KEY", "NVIDIA_MODEL"],
  ["github", "https://models.github.ai/inference", "GITHUB_MODELS_TOKEN", "GITHUB_MODEL"],
  ["mistral", "https://api.mistral.ai/v1", "MISTRAL_API_KEY", "MISTRAL_MODEL"],
];

/** Minimal .env reader. No dependency, and it never prints a value. */
function loadEnv() {
  const env = {};
  for (const file of [".env", ".env.local"]) {
    let raw;
    try {
      raw = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
  return { ...env, ...process.env };
}

const env = loadEnv();
const only = process.argv[2]?.toLowerCase();
let configured = 0;

for (const [name, baseUrl, keyVar, modelVar] of PROVIDERS) {
  if (only && name !== only) continue;

  const key = env[keyVar];
  if (!key) {
    console.log(`\n${name}  (no ${keyVar}, skipped)`);
    continue;
  }
  configured++;

  const pinned = (env[modelVar] ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  console.log(
    `\n${name}  (${pinned.length ? `pinned: ${pinned.join(", ")}` : "using the defaults in registry.ts"})`,
  );

  let res;
  try {
    res = await fetch(`${baseUrl}/models`, {
      headers: { authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(15000),
    });
  } catch (e) {
    console.log(`  could not reach it: ${e.message}`);
    continue;
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.log(`  HTTP ${res.status} ${body.slice(0, 160).replace(/\s+/g, " ")}`);
    continue;
  }

  const json = await res.json().catch(() => ({}));
  const ids = (json.data ?? [])
    .map((m) => String(m.id).replace(/^models\//, ""))
    // Drop the ones that cannot answer a chat completion. Safety and
    // moderation classifiers are the trap: they accept a normal request and
    // return no content at all.
    .filter(
      (id) =>
        !/whisper|tts|embed|guard|image|video|audio|veo|rerank|safety|moderation|classif/i.test(id),
    )
    .sort();

  if (ids.length === 0) {
    console.log("  catalogue came back empty");
    continue;
  }

  for (const id of ids.slice(0, 30)) {
    console.log(`   ${pinned.includes(id) ? "*" : " "} ${id}`);
  }
  if (ids.length > 30) console.log(`   … and ${ids.length - 30} more`);

  for (const model of pinned) {
    if (!ids.includes(model)) console.log(`  WARNING: "${model}" is not in this list. It will 404.`);
  }
}

if (configured === 0) {
  console.log("\nNo provider keys found in .env. The app still runs on canned verdicts.");
}
console.log("\n* = pinned in .env\n");
