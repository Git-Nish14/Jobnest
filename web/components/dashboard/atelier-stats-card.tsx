"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

interface AtelierStatsCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  bgClass: string;
  footer: React.ReactNode;
}

export function AtelierStatsCard({ label, value, icon, bgClass, footer }: AtelierStatsCardProps) {
  const [revealed, setRevealed] = useState(true);

  return (
    <div className={`db-stat-card h-full ${bgClass}`}>
      <div>
        <div className="text-[#99462a] dark:text-[#ccff00] mb-4">{icon}</div>
        <p className="db-stat-label">{label}</p>
        <div className="flex items-center gap-2">
          <p className={`db-stat-value transition-[filter] duration-200 ${!revealed ? "blur-sm" : ""}`}>
            {value}
          </p>
          <button
            type="button"
            onClick={() => setRevealed((r) => !r)}
            className="sm:hidden shrink-0 text-[#99462a]/40 hover:text-[#99462a] dark:text-[#ccff00]/40 dark:hover:text-[#ccff00] transition-colors"
            aria-label={revealed ? "Hide value" : "Reveal value"}
          >
            {revealed ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
      <div className="mt-8">{footer}</div>
    </div>
  );
}
