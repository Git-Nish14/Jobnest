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
  try {
    localStorage.setItem("jobnest_theme", theme);
  } catch {
    // ignore
  }
}

export function ThemeToggle({ className }: { className?: string }) {
  // Lazy initialiser: runs on the client only (SSR renders with "light" default)
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Read the stored preference after mount so SSR output matches
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
      className={`h-9 w-9 flex items-center justify-center rounded-lg transition-colors hover:bg-[#dbc1b9]/20 text-[#55433d] dark:text-[#c4a99f] dark:hover:bg-white/10 ${className ?? ""}`}
    >
      {theme === "dark" ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </button>
  );
}
