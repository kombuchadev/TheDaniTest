"use client";

import { useEffect, useRef, useState } from "react";
import { Dani } from "@/components/Dani";
import { Arrow } from "@/components/icons";
import { GOOD_FROM, Verdict } from "@/components/Verdict";
import { MAX_IDEA_CHARS } from "@/lib/guards/input";
import type { JudgedVerdict } from "@/lib/schema";

type Result = { verdict: JudgedVerdict; share: string };

/** Cycled while waiting, so the pause is part of the bit rather than dead air. */
const WAITING = [
  "Dani is reading it.",
  "Dani has stopped reading it.",
  "Dani is checking a score.",
  "Dani is thinking about something else.",
  "Dani has picked his phone back up.",
  "Dani is deciding how to put this.",
  "Dani did not need this long.",
];

const WAITING_MS = 1500;

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

  // The field starts one line tall and grows with the text, so the underline
  // sits just below what you have written instead of below three empty rows.
  const box = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [idea]);

  // Cycle the waiting lines while a request is in flight.
  useEffect(() => {
    if (!pending) return;
    const id = setInterval(() => setWaitLine((n) => (n + 1) % WAITING.length), WAITING_MS);
    return () => clearInterval(id);
  }, [pending]);

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
    setWaitLine(0);

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
      <Dani reaction={reaction} reactionKey={reactionKey.current} thinking={pending} />

      <p className="subtitle">
        Describe a project idea. He decides whether you would still build it if
        nobody was watching.
      </p>

      <form onSubmit={submit}>
        <div className="field">
          <textarea
            ref={box}
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            rows={1}
            placeholder="An app that reminds you to drink water, but with AI"
            aria-label="Your project idea"
          />
          <div className="rule" />
        </div>

        <div className="controls">
          <span className="count" data-over={over}>
            {idea.length}/{MAX_IDEA_CHARS}
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

      {pending && (
        <section className="waiting" aria-live="polite">
          <span className="floaters" aria-hidden>
            <i />
            <i />
            <i />
          </span>
          {/* Keyed on the index so React remounts it and the fade replays. */}
          <p key={waitLine}>{WAITING[waitLine]}</p>
        </section>
      )}

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
