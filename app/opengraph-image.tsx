import { ImageResponse } from "next/og";

export const alt = "The Dani Test";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The card for the bare link, before anyone has been judged. */
export default function Image() {
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
          backgroundImage: "radial-gradient(circle at 80% 14%, #eef1fa, #fbfaf6 58%)",
          padding: "76px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", color: "#8b8b96", fontSize: 26, letterSpacing: 5 }}>
          THE DANI TEST
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              color: "#15151a",
              fontSize: 78,
              fontWeight: 700,
              letterSpacing: -2.5,
              lineHeight: 1.1,
            }}
          >
            Would you still build it
          </div>
          <div
            style={{
              display: "flex",
              color: "#2c3e8f",
              fontSize: 78,
              fontWeight: 700,
              letterSpacing: -2.5,
              lineHeight: 1.1,
            }}
          >
            if nobody was watching?
          </div>
        </div>

        <div style={{ display: "flex", color: "#4a4a55", fontSize: 34 }}>
          Describe a project idea. Dani will judge it.
        </div>
      </div>
    ),
    size,
  );
}
