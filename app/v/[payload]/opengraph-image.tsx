import { ImageResponse } from "next/og";
import { decodeVerdict } from "@/lib/share";

export const alt = "A Dani Test verdict";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * The distribution mechanic: a PNG rendered per share URL, so a feed shows the
 * score and the punchline without anyone clicking through.
 */
export default async function Image({ params }: { params: Promise<{ payload: string }> }) {
  const { payload } = await params;
  const verdict = decodeVerdict(payload);

  const score = verdict?.score ?? 0;
  const line = verdict?.verdict ?? "Dani declined to comment.";
  const band = verdict?.band ?? "";
  const good = score >= 50;
  const tone = good ? "#1f9254" : "#cf3a31";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#fbfaf6",
          backgroundImage: "radial-gradient(circle at 82% 12%, #eef1fa, #fbfaf6 55%)",
          padding: "76px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", color: "#8b8b96", fontSize: 26, letterSpacing: 5 }}>
          THE DANI TEST
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "baseline", color: tone }}>
            <span style={{ fontSize: 190, fontWeight: 700, lineHeight: 1, letterSpacing: -8 }}>
              {score}
            </span>
            <span style={{ fontSize: 54, color: "#a9a9b4", marginLeft: 6 }}>/100</span>
          </div>
          <div style={{ display: "flex", color: "#4a4a55", fontSize: 34, marginTop: 10 }}>
            {band}
          </div>
        </div>

        <div style={{ display: "flex", color: "#15151a", fontSize: 46, lineHeight: 1.25 }}>
          {line.length > 110 ? `${line.slice(0, 107)}…` : line}
        </div>
      </div>
    ),
    size,
  );
}
