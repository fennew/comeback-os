import { ImageResponse } from "next/og";

export const size = { width: 192, height: 192 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 192,
          height: 192,
          background: "linear-gradient(135deg, #1a1a2e 0%, #0d0d1a 100%)",
          borderRadius: 40,
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
            top: 28,
            left: 32,
            width: 128,
            height: 4,
            borderRadius: 2,
            background: "linear-gradient(90deg, #f59e0b, #d97706)",
          }}
        />
        {/* OS text */}
        <div
          style={{
            fontSize: 72,
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
            fontSize: 14,
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
    { width: 192, height: 192 }
  );
}
