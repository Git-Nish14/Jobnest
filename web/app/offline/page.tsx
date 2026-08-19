import Link from "next/link";
import type { Metadata } from "next";

// This page is pre-cached by the service worker during install.
// It is served when the user is offline and tries to navigate.
// Must contain no user data, no auth state, and no dynamic content.
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "You're Offline | Jobnest",
  description: "No internet connection detected.",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#faf9f7",
        color: "#3b2a26",
        fontFamily: "var(--font-manrope, system-ui, sans-serif)",
        padding: "2rem",
        textAlign: "center",
      }}
    >
      {/* Decorative ring */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "clamp(20rem, 50vw, 38rem)",
          height: "clamp(20rem, 50vw, 38rem)",
          borderRadius: "50%",
          border: "1px solid rgba(153, 70, 42, 0.15)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <div style={{ position: "relative", zIndex: 1, maxWidth: "28rem" }}>
        {/* Logo mark */}
        <p
          aria-hidden="true"
          style={{
            fontFamily: "var(--font-newsreader, Georgia, serif)",
            fontStyle: "italic",
            fontWeight: 700,
            fontSize: "clamp(6rem, 18vw, 12rem)",
            lineHeight: 1,
            color: "#99462a",
            opacity: 0.12,
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -60%)",
            pointerEvents: "none",
            userSelect: "none",
            margin: 0,
          }}
        >
          ✈
        </p>

        <div
          style={{
            width: "3.5rem",
            height: "3.5rem",
            borderRadius: "0.875rem",
            backgroundColor: "#99462a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 1.5rem",
            boxShadow: "0 4px 14px rgba(153, 70, 42, 0.25)",
          }}
        >
          {/* Wifi-off icon (inline SVG, no JS dependency) */}
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
            <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
            <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
            <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
            <line x1="12" y1="20" x2="12.01" y2="20" />
          </svg>
        </div>

        <h1
          style={{
            fontFamily: "var(--font-newsreader, Georgia, serif)",
            fontStyle: "italic",
            fontWeight: 600,
            fontSize: "clamp(1.5rem, 4vw, 2rem)",
            color: "#3b2a26",
            marginBottom: "0.75rem",
            lineHeight: 1.2,
          }}
        >
          You&rsquo;re offline
        </h1>

        <p
          style={{
            fontSize: "0.9375rem",
            color: "#7a5c52",
            lineHeight: 1.7,
            marginBottom: "2rem",
          }}
        >
          No internet connection detected. Check your connection and try again —
          your job search data is safe and waiting.
        </p>

        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {/* These are Link elements so Next.js handles navigation correctly.
              The SW intercepts the resulting fetch and retries the network;
              on failure it serves /offline again. */}
          <Link
            href="/dashboard"
            style={{
              display: "inline-block",
              padding: "0.625rem 1.5rem",
              borderRadius: "999px",
              backgroundColor: "#99462a",
              color: "#fff",
              fontWeight: 600,
              fontSize: "0.875rem",
              textDecoration: "none",
              fontFamily: "var(--font-manrope, system-ui, sans-serif)",
            }}
          >
            Try again
          </Link>
          <Link
            href="/"
            style={{
              display: "inline-block",
              padding: "0.625rem 1.5rem",
              borderRadius: "999px",
              border: "1.5px solid rgba(153, 70, 42, 0.35)",
              color: "#99462a",
              fontWeight: 600,
              fontSize: "0.875rem",
              textDecoration: "none",
              fontFamily: "var(--font-manrope, system-ui, sans-serif)",
              backgroundColor: "transparent",
            }}
          >
            ← Home
          </Link>
        </div>

        <p
          style={{
            marginTop: "3rem",
            fontSize: "0.75rem",
            color: "#b09080",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          Jobnest
        </p>
      </div>
    </div>
  );
}
