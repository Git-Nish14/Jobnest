"use client";

import { ExternalLink, Shield } from "lucide-react";

interface H1BTrackerCardProps {
  workAuth: string;
}

function daysUntilNextApril1(): number {
  const today = new Date();
  const year = today.getFullYear();
  let nextApril1 = new Date(year, 3, 1); // April = month 3 (0-indexed)
  if (today >= nextApril1) {
    nextApril1 = new Date(year + 1, 3, 1);
  }
  return Math.ceil((nextApril1.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function H1BTrackerCard({ workAuth }: H1BTrackerCardProps) {
  const days = daysUntilNextApril1();
  const isOPT = workAuth === "OPT (F-1)";

  return (
    <div className="db-content-card h-full flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <div className="h-9 w-9 rounded-xl bg-violet-50 dark:bg-violet-950/40 flex items-center justify-center shrink-0">
          <Shield className="h-4 w-4 text-violet-600 dark:text-violet-400" />
        </div>
        <div>
          <p className="font-semibold text-foreground text-sm">H-1B Cap Tracker</p>
          <p className="text-[10px] text-muted-foreground">FY2027 lottery season</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-muted/40 px-3 py-2">
          <p className="text-[10px] text-muted-foreground mb-0.5">Regular Cap</p>
          <p className="text-sm font-bold text-foreground">65,000</p>
        </div>
        <div className="rounded-lg bg-muted/40 px-3 py-2">
          <p className="text-[10px] text-muted-foreground mb-0.5">Advanced Degree</p>
          <p className="text-sm font-bold text-foreground">20,000</p>
        </div>
      </div>

      <div className="rounded-lg bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800 px-3 py-2">
        <p className="text-[10px] text-violet-600 dark:text-violet-400 font-semibold">Next Filing Period</p>
        <p className="text-sm font-bold text-violet-800 dark:text-violet-300 mt-0.5">{days} days away</p>
        <p className="text-[10px] text-violet-600/70 dark:text-violet-400/70">Petitions typically accepted April 1 each year</p>
      </div>

      {isOPT && (
        <p className="text-[10px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 rounded-lg px-3 py-2 border border-amber-200 dark:border-amber-800">
          On OPT? Your employer must file an H-1B petition before your OPT expires. Cap-gap protection may apply if your OPT runs out during processing.
        </p>
      )}

      <div className="flex flex-col gap-1 mt-auto">
        <a
          href="https://www.uscis.gov/working-in-the-united-states/temporary-workers/h-1b-specialty-occupations"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[10px] font-medium text-violet-600 dark:text-violet-400 hover:underline"
        >
          USCIS H-1B Guide <ExternalLink className="h-2.5 w-2.5" />
        </a>
        <a
          href="https://www.uscis.gov/cap-gap"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[10px] font-medium text-violet-600 dark:text-violet-400 hover:underline"
        >
          Cap-Gap Extension <ExternalLink className="h-2.5 w-2.5" />
        </a>
      </div>
    </div>
  );
}
