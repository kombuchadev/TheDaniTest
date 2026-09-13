# The Dani Test

Paste a project idea. Dani judges it. You will not enjoy it.

A joke app, built to run on free tiers only — no card on file anywhere, nothing in
this stack can generate a bill.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for why it is built this way.

## Run it

```bash
npm install
cp .env.example .env   # optional — it runs with no keys at all
npm run dev
```

With no API keys set, every request falls through to the canned-verdict tier, so the
whole app is exercisable offline. Add a Groq or Gemini key to get real verdicts.

## Models

Each provider with a key contributes a list of free models, defined in
`lib/providers/registry.ts`. Free limits are per model, so more models means more
allowance. The judge alternates between providers, starts a backup request when one is
slow, and benches models that just failed.

- `npm run models` lists what each configured provider serves. Free, no tokens.
- `/api/dev/probe` (dev server only) runs every model in the chain through the real
  request and the real output guard, and reports which ones produced a verdict. Add
  `?candidates=groq:some-model,openrouter:other-model:free` to try new ones.

Leave the `*_MODEL` env vars blank unless you mean to replace a provider's list.

## Guardrails

The point of this codebase is the guard layer, not the UI.

**Input** (`lib/guards/input.ts`)
- NFKC normalisation + zero-width/bidi/control-character stripping, applied *before*
  pattern matching — so `i<ZWSP>gnore previous instructions` is caught, not smuggled.
- 500-char cap, 4KB body cap, `application/json` required, POST only.
- Injection patterns. A match is answered in character without spending an LLM token.
- Angle brackets removed outright, so input cannot escape the `<idea>` delimiter.

**Model** (`lib/prompt.ts`)
- A random per-request **canary** planted in the system prompt. If it appears in the
  output, the model has been talked into reciting its instructions → response discarded.
- User input is delimited and labelled as data, twice.
- Rules that the idea text cannot override: judge the idea never the person, no real-world
  factual claims, no persona changes, no instruction disclosure, JSON only.

**Output** (`lib/guards/output.ts`) — fails closed, in order:
1. Canary match against raw text.
2. Leak markers: phrases that only exist inside our own prompt.
3. Every balanced JSON object in the reply is tried, newest first.
4. Near-miss answers are normalised (clipped lengths, numeric-string scores, snake_case
   keys), then validated with `zod`. Only the four known fields are carried forward.
5. Scrub: markup stripped, URLs / emails / long digit runs redacted.
6. Re-validate after scrubbing.
7. Content blocklist.

Anything that fails moves on to the next model, and finally to the canned tier. **The
app cannot return an error page.**

**Derived, not trusted** — the rating band comes from the score server-side, so the
model cannot invent a label. The score is clamped 0–100 regardless of what came back.

**Share links** (`lib/share.ts`) — `/v/<payload>` is attacker-controlled, so a decoded
payload runs through the *same* output guard before rendering. You cannot craft a URL
that puts words in Dani's mouth.

**Data** — no database, no analytics, no logging of idea text. Guard rejections log the
*reason* only, never the text. IPs are salted-SHA256 hashed for rate limiting and never
stored raw. Upstream provider error bodies are never read in production; the dev server
logs a truncated copy so a failing provider can be diagnosed.

## Personality

`lib/dani.ts` is the whole personality — pet peeves, catchphrases, rubric, score bands,
canned lines. The system prompt is generated from it.

## Deploy

Pushing to `main` deploys to Vercel. Set env vars from `.env.example` in the Vercel
project, and redeploy after changing any: they are applied at build time.
