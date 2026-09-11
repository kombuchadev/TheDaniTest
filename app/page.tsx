"use client";

import { useState } from "react";
import { VerdictCard } from "@/components/VerdictCard";
import { MAX_IDEA_CHARS } from "@/lib/guards/input";
import type { JudgedVerdict } from "@/lib/schema";

type Result = { verdict: JudgedVerdict; share: string };

export default function HomePage() {
  const [idea, setIdea] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);

  const over = idea.length > MAX_IDEA_CHARS;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending || idea.trim().length === 0 || over) return;

    setPending(true);
    setError(null);
    setResult(null);
    setCopied(false);

    try {
      const res = await fetch("/api/judge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idea }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Something broke.");
      } else {
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
    const url = `${window.location.origin}/v/${result.share}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
  }

  return (
    <>
      <header>
        <h1 className="text-3xl font-bold tracking-tight">The Dani Test</h1>
        <p className="mt-2 text-neutral-400">
          Describe your project idea. Dani will judge it. Manage your expectations.
        </p>
      </header>

      <form onSubmit={submit} className="flex flex-col gap-3">
        <textarea
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          rows={5}
          placeholder="An app that reminds you to drink water, but with AI"
          className="w-full resize-none rounded-lg border border-neutral-800 bg-neutral-900/60 p-4 text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-neutral-600"
        />

        <div className="flex items-center justify-between gap-4">
          <span
            className={`text-xs tabular-nums ${over ? "text-red-400" : "text-neutral-600"}`}
          >
            {idea.length}/{MAX_IDEA_CHARS}
          </span>

          <button
            type="submit"
            disabled={pending || over || idea.trim().length === 0}
            className="rounded-lg bg-neutral-100 px-5 py-2 text-sm font-semibold text-neutral-900 transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pending ? "Dani is unimpressed…" : "Judge it"}
          </button>
        </div>
      </form>

      {error && (
        <p className="rounded-lg border border-red-900/60 bg-red-950/30 p-4 text-sm text-red-300">
          {error}
        </p>
      )}

      {result && (
        <div className="flex flex-col gap-3">
          <VerdictCard verdict={result.verdict} />
          <button
            onClick={copyShare}
            className="self-start text-sm text-neutral-400 underline underline-offset-4 hover:text-neutral-200"
          >
            {copied ? "Link copied" : "Copy share link"}
          </button>
        </div>
      )}
    </>
  );
}
