import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Jobnest Pricing — Simple, honest pricing";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function PricingOgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#faf9f7",
          fontFamily: "system-ui, sans-serif",
          padding: "80px",
        }}
      >
        {/* Left content */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 40 }}>
            <span style={{ fontSize: 26, fontWeight: 700, color: "#1a1c1b" }}>Jobnest</span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "#99462a",
                background: "rgba(153,70,42,0.1)",
                padding: "4px 12px",
                borderRadius: 99,
                letterSpacing: 1,
                textTransform: "uppercase",
              }}
            >
              Pricing
            </span>
          </div>

          <h1
            style={{
              fontSize: 64,
              fontWeight: 800,
              color: "#1a1c1b",
              lineHeight: 1.1,
              margin: 0,
              marginBottom: 20,
              letterSpacing: -2,
            }}
          >
            Simple,
            <br />
            honest pricing.
          </h1>
          <p style={{ fontSize: 24, color: "#55433d", margin: 0 }}>
            Start free. Upgrade when you&apos;re ready.
          </p>
        </div>

        {/* Right — plan cards */}
        <div style={{ display: "flex", gap: 20, alignItems: "center", marginLeft: 60 }}>
          {/* Free */}
          <div
            style={{
              background: "white",
              border: "1.5px solid #dbc1b9",
              borderRadius: 20,
              padding: "32px 28px",
              width: 220,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <span style={{ fontSize: 18, fontWeight: 700, color: "#1a1c1b" }}>Free</span>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              <span style={{ fontSize: 40, fontWeight: 800, color: "#1a1c1b" }}>$0</span>
              <span style={{ color: "#88726c", fontSize: 14 }}>/mo</span>
            </div>
            <span style={{ fontSize: 13, color: "#55433d" }}>All core features, forever</span>
          </div>

          {/* Pro */}
          <div
            style={{
              background: "#99462a",
              borderRadius: 20,
              padding: "32px 28px",
              width: 220,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <span style={{ fontSize: 18, fontWeight: 700, color: "white" }}>Pro</span>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              <span style={{ fontSize: 40, fontWeight: 800, color: "white" }}>$9</span>
              <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 14 }}>/mo</span>
            </div>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.8)" }}>Advanced tools + priority support</span>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
