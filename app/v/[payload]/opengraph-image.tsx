import { ImageResponse } from "next/og";
import { decodeVerdict } from "@/lib/share";

export const alt = "A Dani Test verdict";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * The distribution mechanic: a PNG rendered per share URL, so a LinkedIn feed
 * shows the score and the punchline without anyone clicking through.
 */
export default async function Image({ params }: { params: Promise<{ payload: string }> }) {
  const { payload } = await params;
  const verdict = decodeVerdict(payload);

  const score = verdict?.score ?? 0;
  const line = verdict?.verdict ?? "Dani declined to comment.";
  const band = verdict?.band ?? "";
  const tone = score < 25 ? "#f87171" : score < 60 ? "#fbbf24" : "#34d399";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0b0b0d",
          padding: "72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", color: "#737373", fontSize: 28, letterSpacing: 4 }}>
          THE DANI TEST
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "baseline", color: tone }}>
            <span style={{ fontSize: 180, fontWeight: 700, lineHeight: 1 }}>{score}</span>
            <span style={{ fontSize: 56, color: "#525252" }}>/100</span>
          </div>
          <div style={{ display: "flex", color: "#a3a3a3", fontSize: 32, marginTop: 8 }}>
            {band}
          </div>
        </div>

        <div style={{ display: "flex", color: "#e8e8ea", fontSize: 44, lineHeight: 1.25 }}>
          {line.length > 110 ? `${line.slice(0, 107)}…` : line}
        </div>
      </div>
    ),
    size,
  );
}
