import { ImageResponse } from "next/og";

export const alt = "Helixon - screen candidates in seconds";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#0b6e4f",
          color: "#ffffff",
        }}
      >
        <div style={{ fontSize: 40, fontWeight: 600, opacity: 0.85 }}>Helixon</div>
        <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.1, marginTop: 24 }}>
          Turn a pile of CVs into a ranked shortlist in minutes.
        </div>
        <div style={{ fontSize: 32, marginTop: 32, opacity: 0.85 }}>
          AI screening built for recruitment agencies
        </div>
      </div>
    ),
    size,
  );
}
