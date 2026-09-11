"use client";

import { useCallback, useId, useState } from "react";
import { HelmetFallback, Instagram, ThumbDown, ThumbUp, YouTube } from "./icons";

type Props = {
  /** null while idle. Changing `reactionKey` replays the bounce. */
  reaction: "up" | "down" | null;
  reactionKey: number;
};

export function Dani({ reaction, reactionKey }: Props) {
  const [open, setOpen] = useState(false);
  const [hasPhoto, setHasPhoto] = useState(true);
  const panelId = useId();

  // onError alone is not enough: the image request fails while the server HTML
  // is still parsing, long before React hydrates, so the event is never seen
  // and the browser is left showing alt text. Re-check on mount.
  const checkLoaded = useCallback((node: HTMLImageElement | null) => {
    if (node && node.complete && node.naturalWidth === 0) setHasPhoto(false);
  }, []);

  return (
    <div>
      <div className="dani">
        <button
          type="button"
          className="dani-port"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={open ? "Hide who Dani is" : "Who is Dani?"}
        >
          {hasPhoto ? (
            // Plain img: it is one small local file, and onError gives us a
            // fallback if public/dani.jpg was never added.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={checkLoaded}
              src="/dani.jpg"
              alt="Dani"
              onError={() => setHasPhoto(false)}
            />
          ) : (
            <HelmetFallback />
          )}

          {reaction && (
            <span key={reactionKey} className="reaction">
              {reaction === "up" ? <ThumbUp /> : <ThumbDown />}
            </span>
          )}
        </button>

        <div>
          <h1 className="title">The Dani Test</h1>
          <p className="dani-hint">Tap him if you want to know who is judging you.</p>
        </div>
      </div>

      <div className="about" id={panelId} data-open={open}>
        <div className="about-inner">
          <div className="about-body">
            <p>
              Travels, plays football, makes things. Mostly for himself.
            </p>
            <p>
              He is not counting the views on any of it, which is roughly why he is
              qualified to count yours.
            </p>

            <div className="links">
              <a
                className="link"
                href="https://www.instagram.com/danial.ahmad11/"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Instagram />
                Instagram
              </a>
              <a
                className="link"
                href="https://www.youtube.com/@Danial__Ahmad"
                target="_blank"
                rel="noopener noreferrer"
              >
                <YouTube />
                YouTube
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
