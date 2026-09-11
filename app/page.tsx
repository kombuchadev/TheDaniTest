"use client";

import { useRef, useState } from "react";
import { Dani } from "@/components/Dani";
import { Arrow } from "@/components/icons";
import { GOOD_FROM, Verdict } from "@/components/Verdict";
import { MAX_IDEA_CHARS } from "@/lib/guards/input";
import type { JudgedVerdict } from "@/lib/schema";

type Result = { verdict: JudgedVerdict; share: string };

/** Rotated while waiting, so the pause is part of the bit. */
const WAITING = [
  "Dani is reading it.",
  "Dani has stopped reading it.",
  "Dani is thinking about something else.",
  "Dani will get to it.",
];

export default function HomePage() {
  const [idea, setIdea] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [waitLine, setWaitLine] = useState(0);

  // Bumped on every verdict so the thumb replays its bounce even when two
  // verdicts in a row land on the same side.
  const reactionKey = useRef(0);

  const over = idea.length > MAX_IDEA_CHARS;
  const empty = idea.trim().length === 0;

  const reaction = result ? (result.verdict.score >= GOOD_FROM ? "up" : "down") : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending || empty || over) return;

    setPending(true);
    setError(null);
    setResult(null);
    setCopied(false);
    setWaitLine((n) => (n + 1) % WAITING.length);

    try {
      const res = await fetch("/api/judge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idea }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "That did not work.");
      } else {
        reactionKey.current += 1;
        setResult(data as Result);
      }
    } catch {
      setError("Could not reach Dani. Probably for the best.");
    } finally {
      setPending(false);
    }
  }

  async function copyShare() {
    if (!result) return;
    await navigator.clipboard.writeText(`${window.location.origin}/v/${result.share}`);
    setCopied(true);
  }

  return (
    <>
      <Dani reaction={reaction} reactionKey={reactionKey.current} />

      <p className="subtitle">
        Describe a project idea. He decides whether you would still build it if
        nobody was watching.
      </p>

      <form onSubmit={submit}>
        <div className="field">
          <textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            rows={3}
            placeholder="An app that reminds you to drink water, but with AI"
            aria-label="Your project idea"
          />
          <div className="rule" />
        </div>

        <div className="controls">
          {/* The waiting line takes the counter's place rather than sitting
              inside the button, which stretched it to the width of a sentence. */}
          <span className="count" data-over={over} aria-live="polite">
            {pending ? WAITING[waitLine] : `${idea.length}/${MAX_IDEA_CHARS}`}
          </span>
          <button type="submit" className="go" disabled={pending || over || empty}>
            {pending ? (
              <>
                <span className="spinner" aria-hidden />
                Judging
              </>
            ) : (
              <>
                Judge it
                <Arrow />
              </>
            )}
          </button>
        </div>
      </form>

      {error && <p className="error">{error}</p>}

      {result && (
        <div>
          <Verdict verdict={result.verdict} />
          <button type="button" className="share" onClick={copyShare}>
            {copied ? "Copied" : "Copy share link"}
          </button>
        </div>
      )}
    </>
  );
}
