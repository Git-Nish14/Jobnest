"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";

function readStoredTheme(): Theme {
  try {
    return (localStorage.getItem("jobnest_theme") as Theme) || "light";
  } catch {
    return "light";
  }
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");

  // Keep <meta name="theme-color"> in sync with the class-based toggle.
  // Next.js renders two theme-color metas with media queries (light/dark),
  // but the browser picks between them based on prefers-color-scheme — it
  // doesn't react to JS-driven class changes. We update ALL theme-color
  // metas to the same resolved colour so the iOS status bar / PWA chrome
  // reflects the actual UI state regardless of system preference.
  const color = theme === "dark" ? "#000000" : "#faf9f7";
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    m.setAttribute("content", color);
  });

  try {
    localStorage.setItem("jobnest_theme", theme);
  } catch {
    // ignore
  }
}

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = readStoredTheme();
    if (stored !== theme) setTheme(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // runs once on mount

  function toggle() {
    const next: Theme = theme === "light" ? "dark" : "light";
    setTheme(next);
    applyTheme(next);
  }

  if (!mounted) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className={`h-9 w-9 flex items-center justify-center rounded-lg transition-colors
        hover:bg-foreground/8 text-muted-foreground
        dark:hover:bg-[#ccff00]/10 dark:text-[#ccff00]/70 dark:hover:text-[#ccff00]
        ${className ?? ""}`}
    >
      {theme === "dark" ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </button>
  );
}
