import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Jobnest — Track Your Job Applications";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#faf9f7",
          fontFamily: "system-ui, sans-serif",
          padding: "80px",
          position: "relative",
        }}
      >
        {/* Warm background accent */}
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: 400,
            height: 400,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(153,70,42,0.08) 0%, transparent 70%)",
          }}
        />

        {/* Logo + wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 48 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: "#99462a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
            }}
          >
            🪺
          </div>
          <span style={{ fontSize: 32, fontWeight: 700, color: "#1a1c1b", letterSpacing: -1 }}>
            Jobnest
          </span>
        </div>

        {/* Headline */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <h1
            style={{
              fontSize: 72,
              fontWeight: 800,
              color: "#1a1c1b",
              lineHeight: 1.1,
              margin: 0,
              marginBottom: 24,
              letterSpacing: -2,
            }}
          >
            Your career
            <br />
            <span style={{ color: "#99462a" }}>deserves a sanctuary.</span>
          </h1>
          <p style={{ fontSize: 28, color: "#55433d", margin: 0, lineHeight: 1.4 }}>
            Track every application, contact, and interview — all in one calm, organised space.
          </p>
        </div>

        {/* Stats strip */}
        <div style={{ display: "flex", gap: 48, marginTop: 48 }}>
          {[
            { label: "Applications tracked", value: "∞" },
            { label: "Free to start", value: "Free" },
            { label: "AI-powered assistant", value: "NESTAi" },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 32, fontWeight: 800, color: "#99462a" }}>{value}</span>
              <span style={{ fontSize: 16, color: "#88726c" }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
