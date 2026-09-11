import type { NextConfig } from "next";

/**
 * CSP note: `unsafe-inline` on script-src is required by Next's hydration
 * payload unless we add nonce middleware. It is tolerable here because the app
 * renders zero user-supplied markup — model output is scrubbed of angle
 * brackets and rendered as text, never as HTML. Tighten with a nonce if this
 * ever grows a real attack surface.
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // The browser talks only to our own API. No third-party endpoints, ever —
  // LLM calls happen server-side.
  "connect-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // No prod source maps: server bundles contain the system prompt.
  productionBrowserSourceMaps: false,
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          // Share links must not leak the referring page to anyone.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
