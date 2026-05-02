"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { AlertTriangle, RefreshCw, Loader2, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface AuthErrorClientProps {
  message: string;
  isOAuthError: boolean;
  provider?: "google" | "github" | null;
}

function GoogleIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

export function AuthErrorClient({ message, isOAuthError, provider }: AuthErrorClientProps) {
  const [retryLoading, setRetryLoading] = useState<"google" | "github" | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);

  const handleRetryOAuth = async (p: "google" | "github") => {
    setRetryError(null);
    setRetryLoading(p);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: p,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setRetryError(error.message);
      setRetryLoading(null);
    }
  };

  return (
    <main className="relative min-h-screen px-6 py-12 dark:bg-black">
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="atelier-glow-top" />
        <div className="atelier-glow-bottom" />
      </div>
      <div className="atelier-grain" />

      <div className="w-full max-w-110 mx-auto relative z-10">
        {/* Brand */}
        <div className="flex flex-col items-center mb-10">
          <div className="mb-5">
            <Image src="/new_logo_1.png" alt="Jobnest" width={52} height={52} priority className="logo-light" />
            <Image src="/dark_logo.png" alt="Jobnest" width={52} height={52} priority className="logo-dark" />
          </div>
          <div className="w-14 h-14 rounded-full bg-[#ba1a1a]/10 flex items-center justify-center mb-4">
            <AlertTriangle className="w-7 h-7 text-[#ba1a1a]" aria-hidden="true" />
          </div>
          <h1 className="atelier-headline text-3xl text-center mb-2 leading-tight">
            Sign-in failed
          </h1>
          <p className="atelier-subtext text-center max-w-xs leading-relaxed">{message}</p>
        </div>

        <div className="atelier-card space-y-3">
          {retryError && (
            <p className="atelier-error" role="alert">{retryError}</p>
          )}

          {/* OAuth retry buttons when it was an OAuth failure */}
          {isOAuthError && (
            <>
              <p className="atelier-label text-center mb-4 opacity-50">
                Try again with
              </p>
              {(provider === "google" || !provider) && (
                <button
                  type="button"
                  onClick={() => handleRetryOAuth("google")}
                  disabled={!!retryLoading}
                  className="atelier-oauth-btn w-full"
                >
                  {retryLoading === "google"
                    ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    : <GoogleIcon />}
                  Continue with Google
                </button>
              )}
              {(provider === "github" || !provider) && (
                <button
                  type="button"
                  onClick={() => handleRetryOAuth("github")}
                  disabled={!!retryLoading}
                  className="atelier-oauth-btn w-full"
                >
                  {retryLoading === "github"
                    ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    : <GitHubIcon />}
                  Continue with GitHub
                </button>
              )}
              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full atelier-divider-line" />
                </div>
                <div className="relative flex justify-center">
                  <span className="atelier-divider-label">or</span>
                </div>
              </div>
            </>
          )}

          <Link href="/login" className="atelier-btn-primary flex items-center justify-center gap-2 no-underline">
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            {isOAuthError ? "Sign in with email instead" : "Back to Sign In"}
          </Link>

          <Link href="/signup" className="flex items-center justify-center gap-2 py-3 rounded-full text-sm font-semibold transition-opacity"
            style={{ color: "var(--atelier-on-surface-var)", opacity: 0.7 }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
            onMouseLeave={e => (e.currentTarget.style.opacity = "0.7")}>
            <UserPlus className="w-4 h-4" aria-hidden="true" />
            Create an account
          </Link>
        </div>

        <div className="mt-8 text-center">
          <Link href="/" className="atelier-footer-link">← Back to home</Link>
        </div>
      </div>
    </main>
  );
}
