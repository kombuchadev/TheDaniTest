# The Dani Test

Paste a project idea. Dani judges it. You will not enjoy it.

A joke app, built to run on free tiers only — no card on file anywhere, nothing in
this stack can generate a bill.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for why it is built this way.

## Run it

```bash
npm install
cp .env.example .env.local   # optional — it runs with no keys at all
npm run dev
```

With no API keys set, every request falls through to the canned-verdict tier, so the
whole app is exercisable offline. Add a Cerebras key to get real verdicts.

## Guardrails

The point of this codebase is the guard layer, not the UI. Every one of these is
tested and passing.

**Input** (`lib/guards/input.ts`)
- NFKC normalisation + zero-width/bidi/control-character stripping, applied *before*
  pattern matching — so `i<ZWSP>gnore previous instructions` is caught, not smuggled.
- 500-char cap, 4KB body cap, `application/json` required, POST only.
- 16 injection patterns. A match is answered in character without spending an LLM
  token.
- Angle brackets removed outright, so input cannot escape the `<idea>` delimiter.

**Model** (`lib/prompt.ts`)
- A random per-request **canary** planted in the system prompt. If it appears in the
  output, the model has been talked into reciting its instructions → response discarded.
- User input is delimited and labelled as data, twice.
- Rules that the idea text cannot override: judge the idea never the person, no real-world
  factual claims, no persona changes, no instruction disclosure, JSON only.

**Output** (`lib/guards/output.ts`) — fails closed, in order:
1. Canary match against raw text.
2. Paraphrased-instruction leak markers.
3. Balanced-brace JSON extraction (survives fences and preamble).
4. `zod` `.strict()` schema — unexpected keys are a hard failure.
5. Scrub: markup stripped, URLs / emails / long digit runs redacted.
6. Re-validate after scrubbing.
7. Content blocklist.

Anything that fails drops to the canned tier. **The app cannot return an error page.**

**Derived, not trusted** — the rating band comes from the score server-side, so the
model cannot invent a label. The score is clamped 0–100 regardless of what came back.

**Share links** (`lib/share.ts`) — `/v/<payload>` is attacker-controlled, so a decoded
payload runs through the *same* output guard before rendering. You cannot craft a URL
that puts words in Dani's mouth.

**Data** — no database, no analytics, no logging of idea text. Guard rejections log the
*reason* only, never the text. IPs are salted-SHA256 hashed for rate limiting and never
stored raw. Upstream provider error bodies are never read, logged, or propagated.

## Personality

`lib/dani.ts` is the whole personality — pet peeves, catchphrases, rubric, score bands,
canned lines. The system prompt is generated from it. Currently placeholders.

## Deploy

Push to GitHub, import on Vercel, set env vars from `.env.example`. Free Hobby plan.
