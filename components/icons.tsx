/** Hand-rolled so nothing has to be fetched and the CSP stays closed. */

export function Instagram() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function YouTube() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <rect x="2" y="5" width="20" height="14" rx="4.5" />
      <path d="M10.2 9.3v5.4l4.6-2.7z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ThumbUp() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden>
      <path
        d="M15 21.5 24 7.5c2.6 0 4.2 2 3.8 4.5l-1.1 6.4h9.6c2.6 0 4.5 2.4 4 5l-2.4 12.2c-.4 2.1-2.3 3.6-4.4 3.6H15z"
        fill="#1f9254"
      />
      <rect x="6" y="20.5" width="9" height="19.5" rx="2.6" fill="#176e3f" />
    </svg>
  );
}

export function ThumbDown() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden>
      <path
        d="M15 26.5 24 40.5c2.6 0 4.2-2 3.8-4.5l-1.1-6.4h9.6c2.6 0 4.5-2.4 4-5l-2.4-12.2C37.5 10.3 35.6 8.8 33.5 8.8H15z"
        fill="#cf3a31"
      />
      <rect x="6" y="8" width="9" height="19.5" rx="2.6" fill="#a32b24" />
    </svg>
  );
}

/** Shown if public/dani.jpg is missing, so the page never looks broken. */
export function HelmetFallback() {
  return (
    <svg className="fallback" viewBox="0 0 100 100" aria-hidden>
      <circle cx="50" cy="50" r="50" fill="#e8ebf6" />
      <path d="M22 46a28 28 0 0 1 56 0v10a28 28 0 0 1-56 0z" fill="#fff" />
      <path d="M31 47a19 19 0 0 1 38 0v6a19 19 0 0 1-38 0z" fill="#2c3e8f" opacity="0.85" />
      <path d="M36 44c2-5 7-8 12-8" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" fill="none" opacity="0.7" />
    </svg>
  );
}

/** Decorative drifter. */
export function Astronaut() {
  return (
    <svg className="floater" viewBox="0 0 120 140" fill="none" aria-hidden>
      <g stroke="#2c3e8f" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M92 24c16 10 20 30 10 44" opacity="0.5" />
        <rect x="34" y="56" width="44" height="46" rx="15" fill="#fff" />
        <rect x="22" y="62" width="14" height="26" rx="7" fill="#fff" />
        <rect x="76" y="62" width="14" height="26" rx="7" fill="#fff" />
        <rect x="40" y="98" width="14" height="28" rx="7" fill="#fff" />
        <rect x="58" y="98" width="14" height="28" rx="7" fill="#fff" />
        <circle cx="56" cy="36" r="24" fill="#fff" />
        <path d="M42 34a14 14 0 0 1 28 0v5a14 14 0 0 1-28 0z" fill="#2c3e8f" opacity="0.75" stroke="none" />
        <rect x="46" y="68" width="20" height="14" rx="4" />
      </g>
    </svg>
  );
}
