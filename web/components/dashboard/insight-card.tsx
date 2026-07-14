"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui";
import { cn } from "@/lib/utils";

export interface InsightCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  tone: "positive" | "neutral" | "warning" | "dim";
}

const toneClasses: Record<InsightCardProps["tone"], string> = {
  positive: "text-emerald-600 dark:text-emerald-400",
  neutral:  "text-[#99462a] dark:text-[#ccff00]",
  warning:  "text-amber-600 dark:text-amber-400",
  dim:      "text-muted-foreground",
};

export function InsightCard({ icon, label, value, sub, tone }: InsightCardProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex flex-col gap-3 rounded-xl border border-border",
          "bg-[#f4f3f1]/60 dark:bg-[#0f0f0f] px-5 py-4",
          "text-left w-full cursor-pointer",
          "hover:border-[#99462a]/40 hover:shadow-sm transition-all duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#99462a]/50"
        )}
        aria-label={`${label}: ${value}. Tap for details`}
      >
        <div className={cn("flex items-center gap-2 text-xs font-semibold uppercase tracking-widest", toneClasses[tone])}>
          {icon}
          {label}
          <Info className="ml-auto h-3 w-3 opacity-40 sm:hidden" aria-hidden="true" />
        </div>
        <div>
          <p className={cn("text-3xl font-bold leading-none tabular-nums truncate", toneClasses[tone])}>
            {value}
          </p>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{sub}</p>
        </div>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className={cn("flex items-center gap-2 text-base font-semibold", toneClasses[tone])}>
              {icon}
              {label}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className={cn("text-4xl font-bold tabular-nums leading-none", toneClasses[tone])}>
              {value}
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">{sub}</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
