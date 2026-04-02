"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { X, Cookie } from "lucide-react";

const CONSENT_KEY = "jobnest_cookie_consent";
type ConsentValue = "all" | "essential" | null;

export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const checked = useRef(false);

  useEffect(() => {
    if (checked.current) return;
    checked.current = true;
    let stored: ConsentValue = null;
    try { stored = localStorage.getItem(CONSENT_KEY) as ConsentValue; } catch { /* unavailable */ }
    if (!stored) {
      const id = setTimeout(() => setVisible(true), 0);
      return () => clearTimeout(id);
    }
  }, []);

  const save = (value: "all" | "essential") => {
    try {
      localStorage.setItem(CONSENT_KEY, value);
    } catch {
      // ignore
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      aria-live="polite"
      className="fixed bottom-0 left-0 right-0 z-[9999] pb-safe"
    >
      {/* Main strip */}
      <div className="bg-[#faf9f7] dark:bg-[#0a0a0a] border-t border-[#dbc1b9]/40 dark:border-[#ccff00]/10 shadow-xl dark:shadow-black/60">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
          {!showManage ? (
            /* ── Default strip ── */
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <Cookie className="mt-0.5 h-5 w-5 shrink-0 text-[#99462a] dark:text-[#ccff00]" aria-hidden />
                <p className="text-sm text-[#55433d] dark:text-white/55 leading-snug">
                  We use essential cookies to keep you signed in and remember your preferences.
                  No tracking or analytics cookies.{" "}
                  <Link href="/cookies" className="font-medium text-[#99462a] dark:text-[#ccff00] underline-offset-2 hover:underline">
                    Cookie Policy
                  </Link>
                  {" "}·{" "}
                  <Link href="/privacy" className="font-medium text-[#99462a] dark:text-[#ccff00] underline-offset-2 hover:underline">
                    Privacy Policy
                  </Link>
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                <button
                  onClick={() => setShowManage(true)}
                  className="rounded-full border border-[#dbc1b9] dark:border-white/15 bg-transparent dark:bg-transparent px-4 py-1.5 text-sm font-semibold text-[#55433d] dark:text-white/60 transition-colors hover:bg-[#f4f3f1] dark:hover:bg-white/6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#99462a] dark:focus-visible:ring-[#ccff00]/40"
                >
                  Manage
                </button>
                <button
                  onClick={() => save("essential")}
                  className="rounded-full border border-[#dbc1b9] dark:border-white/15 bg-transparent dark:bg-transparent px-4 py-1.5 text-sm font-semibold text-[#55433d] dark:text-white/60 transition-colors hover:bg-[#f4f3f1] dark:hover:bg-white/6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#99462a] dark:focus-visible:ring-[#ccff00]/40"
                >
                  Essential only
                </button>
                <button
                  onClick={() => save("all")}
                  className="rounded-full bg-[#99462a] dark:bg-[#ccff00] px-4 py-1.5 text-sm font-semibold text-white dark:text-black transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#99462a] dark:focus-visible:ring-[#ccff00]/60"
                >
                  Accept all
                </button>
              </div>
            </div>
          ) : (
            /* ── Manage preferences panel ── */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cookie className="h-5 w-5 text-[#99462a] dark:text-[#ccff00]" aria-hidden />
                  <h2 className="text-sm font-semibold text-[#1a1c1b] dark:text-white">Cookie Preferences</h2>
                </div>
                <button
                  onClick={() => setShowManage(false)}
                  aria-label="Close preferences"
                  className="rounded-full p-1 text-[#55433d] dark:text-white/40 hover:bg-[#f4f3f1] dark:hover:bg-white/6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#99462a] dark:focus-visible:ring-[#ccff00]/40"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {/* Essential cookies - always on */}
                <div className="rounded-xl border border-[#dbc1b9]/40 dark:border-white/6 bg-[#f4f3f1] dark:bg-[#1a1a1a] p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-[#1a1c1b] dark:text-white">Essential</span>
                    <span className="rounded-full bg-[#99462a]/10 dark:bg-[#ccff00]/10 px-2 py-0.5 text-xs font-medium text-[#99462a] dark:text-[#ccff00]">Always on</span>
                  </div>
                  <p className="text-xs text-[#55433d]/80 dark:text-white/45">
                    Authentication session (<code className="font-mono text-[#99462a] dark:text-[#ccff00]/80">sb-*-auth-token</code>) and remember-me preference (<code className="font-mono text-[#99462a] dark:text-[#ccff00]/80">sb_rm</code>). Required for the service to function.
                  </p>
                </div>

                {/* Analytics - currently none */}
                <div className="rounded-xl border border-[#dbc1b9]/40 dark:border-white/6 bg-[#f4f3f1] dark:bg-[#1a1a1a] p-3 opacity-60">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-[#1a1c1b] dark:text-white">Analytics</span>
                    <span className="rounded-full bg-[#dbc1b9]/30 dark:bg-white/8 px-2 py-0.5 text-xs font-medium text-[#55433d] dark:text-white/40">Not used</span>
                  </div>
                  <p className="text-xs text-[#55433d]/80 dark:text-white/45">
                    We currently do not use any analytics or tracking cookies. If this changes, we will ask for your consent first.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => save("essential")}
                  className="rounded-full border border-[#dbc1b9] dark:border-white/15 bg-transparent dark:bg-transparent px-4 py-1.5 text-sm font-semibold text-[#55433d] dark:text-white/60 transition-colors hover:bg-[#f4f3f1] dark:hover:bg-white/6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#99462a] dark:focus-visible:ring-[#ccff00]/40"
                >
                  Save &amp; close
                </button>
                <button
                  onClick={() => save("all")}
                  className="rounded-full bg-[#99462a] dark:bg-[#ccff00] px-4 py-1.5 text-sm font-semibold text-white dark:text-black transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#99462a] dark:focus-visible:ring-[#ccff00]/60"
                >
                  Accept all
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
