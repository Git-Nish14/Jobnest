"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { X, Cookie, Check, Settings2 } from "lucide-react";

const CONSENT_KEY = "jobnest_cookie_consent";
type ConsentValue = "all" | "essential" | null;

export function CookieBanner() {
  const [visible, setVisible]       = useState(false);
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
    try { localStorage.setItem(CONSENT_KEY, value); } catch { /* ignore */ }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    /*
     * Full-width bottom strip — mirrors the Navbar in style (atelier-bottom-bar)
     * so it feels like a natural part of the site chrome, not a floating overlay.
     *
     * z-9999 ensures it appears above the bottom tab bar on dashboard pages.
     * On landing/public pages the tab bar is absent so it sits flush to the bottom.
     * pb-safe adds iPhone home-indicator clearance.
     */
    <div
      role="dialog"
      aria-label="Cookie consent"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-9999 atelier-bottom-bar"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-safe">

        {!showManage ? (
          /* ── Default strip ── */
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-3 sm:py-3.5 gap-3">

            {/* Icon + text */}
            <div className="flex items-center gap-2.5 min-w-0">
              <Cookie className="h-4 w-4 shrink-0 text-[#99462a] dark:text-[#ccff00]" aria-hidden />
              <p className="text-xs sm:text-sm text-[#55433d] dark:text-white/70 leading-snug">
                We use essential cookies to keep you signed in and remember your preferences.{" "}
                <Link href="/cookies" className="font-semibold text-[#99462a] dark:text-[#ccff00] underline-offset-2 hover:underline">
                  Cookie Policy
                </Link>
                {" "}·{" "}
                <Link href="/privacy" className="font-semibold text-[#99462a] dark:text-[#ccff00] underline-offset-2 hover:underline">
                  Privacy Policy
                </Link>
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setShowManage(true)}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-[#55433d] dark:text-white/60 hover:bg-[#99462a]/8 dark:hover:bg-white/8 transition-colors"
              >
                <Settings2 className="h-3.5 w-3.5" /> Manage
              </button>
              <button
                type="button"
                onClick={() => save("essential")}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#dbc1b9]/60 dark:border-white/15 px-3 py-2 text-xs font-semibold text-[#55433d] dark:text-white/70 hover:bg-[#99462a]/6 dark:hover:bg-white/6 transition-colors"
              >
                Essential only
              </button>
              <button
                type="button"
                onClick={() => save("all")}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#99462a] dark:bg-[#ccff00] px-4 py-2 text-xs font-semibold text-white dark:text-black hover:opacity-90 transition-opacity"
              >
                <Check className="h-3.5 w-3.5" /> Accept all
              </button>
            </div>
          </div>

        ) : (
          /* ── Manage preferences panel ── */
          <div className="py-3 sm:py-4 space-y-3">

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cookie className="h-4 w-4 text-[#99462a] dark:text-[#ccff00]" aria-hidden />
                <h2 className="text-sm font-semibold text-[#1a1c1b] dark:text-white">Cookie Preferences</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowManage(false)}
                aria-label="Close preferences"
                className="min-h-11 min-w-11 flex items-center justify-center rounded-full text-[#55433d] dark:text-white/40 hover:bg-[#99462a]/8 dark:hover:bg-white/8 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-[#dbc1b9]/40 dark:border-white/8 bg-[#f4f3f1]/60 dark:bg-white/4 p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-[#1a1c1b] dark:text-white">Essential</span>
                  <span className="rounded-full bg-[#99462a]/10 dark:bg-[#ccff00]/10 px-2 py-0.5 text-[10px] font-semibold text-[#99462a] dark:text-[#ccff00]">Always on</span>
                </div>
                <p className="text-[11px] text-[#55433d]/70 dark:text-white/45 leading-relaxed">
                  Auth session &amp; remember-me. Required for the service.
                </p>
              </div>
              <div className="rounded-xl border border-[#dbc1b9]/40 dark:border-white/8 bg-[#f4f3f1]/60 dark:bg-white/4 p-3 opacity-55">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-[#1a1c1b] dark:text-white">Analytics</span>
                  <span className="rounded-full bg-[#dbc1b9]/30 dark:bg-white/8 px-2 py-0.5 text-[10px] font-semibold text-[#55433d] dark:text-white/40">Not used</span>
                </div>
                <p className="text-[11px] text-[#55433d]/70 dark:text-white/45 leading-relaxed">
                  We don&apos;t use analytics cookies.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pb-1">
              <button
                type="button"
                onClick={() => save("essential")}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#dbc1b9]/60 dark:border-white/15 px-3 py-2 text-xs font-semibold text-[#55433d] dark:text-white/70 hover:bg-[#99462a]/6 dark:hover:bg-white/6 transition-colors"
              >
                Save &amp; close
              </button>
              <button
                type="button"
                onClick={() => save("all")}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#99462a] dark:bg-[#ccff00] px-4 py-2 text-xs font-semibold text-white dark:text-black hover:opacity-90 transition-opacity"
              >
                <Check className="h-3.5 w-3.5" /> Accept all
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
