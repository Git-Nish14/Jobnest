"use client";

import {
  Ban,
  Check,
  ChevronDown,
  CircleCheckBig,
  CircleDot,
  Ghost,
  Handshake,
  Loader2,
  Phone,
  Trophy,
  Users,
  XCircle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui";
import { APPLICATION_STATUSES, type ApplicationStatus } from "@/config/constants";
import { cn } from "@/lib/utils";

export const STATUS_PRESENTATION: Record<ApplicationStatus, {
  icon: typeof CircleDot;
  dot: string;
  badge: string;
  description: string;
}> = {
  Applied: {
    icon: CircleCheckBig,
    dot: "bg-amber-400",
    badge: "bg-amber-500/10 text-amber-800 border-amber-500/20 dark:text-amber-300",
    description: "Application sent",
  },
  "Phone Screen": {
    icon: Phone,
    dot: "bg-orange-500",
    badge: "bg-orange-500/10 text-orange-800 border-orange-500/20 dark:text-orange-300",
    description: "Recruiter conversation",
  },
  Interview: {
    icon: Users,
    dot: "bg-emerald-500",
    badge: "bg-emerald-500/10 text-emerald-800 border-emerald-500/20 dark:text-emerald-300",
    description: "Interviewing now",
  },
  Offer: {
    icon: Trophy,
    dot: "bg-blue-500",
    badge: "bg-blue-500/10 text-blue-800 border-blue-500/20 dark:text-blue-300",
    description: "Offer received",
  },
  Rejected: {
    icon: XCircle,
    dot: "bg-rose-500",
    badge: "bg-rose-500/10 text-rose-800 border-rose-500/20 dark:text-rose-300",
    description: "Company passed",
  },
  Withdrawn: {
    icon: Ban,
    dot: "bg-slate-400",
    badge: "bg-slate-500/10 text-slate-700 border-slate-500/20 dark:text-slate-300",
    description: "You stepped away",
  },
  Ghosted: {
    icon: Ghost,
    dot: "bg-zinc-400",
    badge: "bg-zinc-500/10 text-zinc-700 border-zinc-500/20 dark:text-zinc-300",
    description: "No response",
  },
};

interface StatusPickerProps {
  status: ApplicationStatus;
  company: string;
  position: string;
  pending?: boolean;
  compact?: boolean;
  onChange: (status: ApplicationStatus) => void;
}

export function StatusPicker({
  status,
  company,
  position,
  pending = false,
  compact = false,
  onChange,
}: StatusPickerProps) {
  const presentation = STATUS_PRESENTATION[status];

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={pending}
          aria-label={`Change status for ${position} at ${company}. Current status: ${status}`}
          title="Change status"
          className={cn(
            "relative z-20 inline-flex items-center rounded-full border font-semibold transition-all",
            "hover:-translate-y-px hover:shadow-sm focus-visible:outline-none disabled:pointer-events-none disabled:opacity-70",
            compact ? "min-h-11 gap-1.5 px-2 text-[11px] sm:min-h-8" : "min-h-11 gap-2 px-3 text-xs sm:min-h-10",
            presentation.badge,
          )}
        >
          {pending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <span className={cn("h-2 w-2 shrink-0 rounded-full", presentation.dot)} aria-hidden="true" />
          )}
          <span>{status}</span>
          <ChevronDown className="h-3 w-3 opacity-55" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 p-1.5">
        <DropdownMenuLabel className="px-2 py-1.5">
          <span className="block text-xs font-semibold text-foreground">Update status</span>
          <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">
            Save a change without opening the application
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {APPLICATION_STATUSES.map((option) => {
          const optionPresentation = STATUS_PRESENTATION[option];
          const Icon = optionPresentation.icon;
          const active = option === status;

          return (
            <DropdownMenuItem
              key={option}
              disabled={pending}
              onSelect={() => {
                if (!active) onChange(option);
              }}
              className={cn(
                "group/status flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2",
                active && "bg-muted",
              )}
            >
              <span className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                optionPresentation.badge,
              )}>
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold text-foreground">{option}</span>
                <span className="block text-[10px] text-muted-foreground">{optionPresentation.description}</span>
              </span>
              {active && <Check className="h-4 w-4 text-primary" aria-label="Current status" />}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <div className="flex items-center gap-2 px-2.5 py-1.5 text-[10px] text-muted-foreground">
          <Handshake className="h-3 w-3" aria-hidden="true" />
          Changes are saved instantly
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
