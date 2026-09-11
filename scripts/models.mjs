/**
 * Ask every configured provider what it actually serves today.
 *
 *   npm run models
 *
 * Model names get renamed and retired constantly, and a stale one is a silent
 * 404 that quietly drops every request to canned verdicts. This is how you
 * check rather than guess. It lists catalogues only, so it costs no tokens.
 */

import { readFileSync } from "node:fs";

// Same shape as lib/providers/registry.ts, duplicated because that file is TS
// and this runs as plain node with no build step.
const PROVIDERS = [
  ["groq", "https://api.groq.com/openai/v1", "GROQ_API_KEY", "GROQ_MODEL"],
  [
    "gemini",
    "https://generativelanguage.googleapis.com/v1beta/openai",
    "GEMINI_API_KEY",
    "GEMINI_MODEL",
  ],
  ["cerebras", "https://api.cerebras.ai/v1", "CEREBRAS_API_KEY", "CEREBRAS_MODEL"],
  ["nvidia", "https://integrate.api.nvidia.com/v1", "NVIDIA_API_KEY", "NVIDIA_MODEL"],
  ["github", "https://models.github.ai/inference", "GITHUB_MODELS_TOKEN", "GITHUB_MODEL"],
  ["openrouter", "https://openrouter.ai/api/v1", "OPENROUTER_API_KEY", "OPENROUTER_MODEL"],
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
    console.log(`\n${name}  — no ${keyVar}, skipped`);
    continue;
  }
  configured++;

  const pinned = env[modelVar];
  console.log(`\n${name}  (pinned: ${pinned || "none — provider is skipped"})`);

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
    // Safe to show: this is our own key being told why it was refused.
    const body = await res.text().catch(() => "");
    console.log(`  HTTP ${res.status} ${body.slice(0, 160).replace(/\s+/g, " ")}`);
    continue;
  }

  const json = await res.json().catch(() => ({}));
  const ids = (json.data ?? [])
    .map((m) => String(m.id).replace(/^models\//, ""))
    // Drop the ones that cannot answer a chat completion. Safety and
    // moderation classifiers are the trap here: they accept a normal request
    // and return no content at all.
    .filter(
      (id) =>
        !/whisper|tts|embed|guard|image|video|audio|veo|rerank|safety|moderation|classif/i.test(id),
    )
    .sort();

  if (ids.length === 0) {
    console.log("  catalogue came back empty");
    continue;
  }

  for (const id of ids.slice(0, 25)) {
    console.log(`   ${id === pinned ? "*" : " "} ${id}`);
  }
  if (ids.length > 25) console.log(`   … and ${ids.length - 25} more`);

  if (pinned && !ids.includes(pinned)) {
    console.log(`  WARNING: "${pinned}" is not in this list. It will 404.`);
  }
}

if (configured === 0) {
  console.log("\nNo provider keys found in .env. The app still runs on canned verdicts.");
}
console.log("\n* = the model currently pinned in .env\n");
