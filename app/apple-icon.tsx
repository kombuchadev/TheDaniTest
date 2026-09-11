import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen icon. Same helmet as icon.svg, drawn large. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#15151a",
        }}
      >
        <div
          style={{
            width: 124,
            height: 124,
            borderRadius: "50%",
            background: "#fbfaf6",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 84,
              height: 62,
              borderRadius: 26,
              background: "#15151a",
            }}
          />
        </div>
      </div>
    ),
    size,
  );
}
