import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          background: "linear-gradient(135deg, #1a1a2e 0%, #0d0d1a 100%)",
          borderRadius: 36,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Arial, Helvetica, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Amber accent bar */}
        <div
          style={{
            position: "absolute",
            top: 26,
            left: 30,
            width: 120,
            height: 4,
            borderRadius: 2,
            background: "linear-gradient(90deg, #f59e0b, #d97706)",
          }}
        />
        {/* OS text */}
        <div
          style={{
            fontSize: 68,
            fontWeight: 800,
            color: "#f59e0b",
            letterSpacing: -2,
            lineHeight: 1,
            marginTop: 8,
          }}
        >
          OS
        </div>
        {/* Comeback label */}
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: "#888888",
            letterSpacing: 4,
            marginTop: 8,
          }}
        >
          COMEBACK
        </div>
      </div>
    ),
    { width: 180, height: 180 }
  );
}
