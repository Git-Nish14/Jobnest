"use client";

import { AlertTriangle, Clock, ExternalLink, X } from "lucide-react";
import { useState } from "react";

interface OPTCountdownBannerProps {
  optStartDate: string;
  stemExtension: boolean;
}

function computeOPTExpiry(startDate: string, stem: boolean) {
  const start = new Date(startDate);
  const months = stem ? 36 : 12;
  // Use year/month arithmetic instead of setMonth to avoid end-of-month overflow
  // (e.g., Jan 31 + 1 month via setMonth gives Mar 3, not Feb 28).
  const totalMonths = start.getMonth() + months;
  const expiry = new Date(
    start.getFullYear() + Math.floor(totalMonths / 12),
    totalMonths % 12,
    start.getDate()
  );
  // Clamp to last day of the target month if the day overflows (e.g., Jan 31 → Feb 28)
  if (expiry.getDate() !== start.getDate()) {
    expiry.setDate(0); // setDate(0) = last day of previous month
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysLeft = Math.ceil((expiry.getTime() - today.getTime()) / msPerDay);
  return { expiry, daysLeft };
}

export function OPTCountdownBanner({ optStartDate, stemExtension }: OPTCountdownBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const { expiry, daysLeft } = computeOPTExpiry(optStartDate, stemExtension);

  if (daysLeft > 180) return null;

  const isExpired = daysLeft <= 0;
  const isCritical = daysLeft <= 7;
  const isWarning = daysLeft <= 30;

  const bgClass = isExpired || isCritical
    ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800"
    : isWarning
    ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
    : "bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800";

  const iconClass = isExpired || isCritical
    ? "text-red-600 dark:text-red-400"
    : isWarning
    ? "text-amber-600 dark:text-amber-400"
    : "text-sky-600 dark:text-sky-400";

  const textClass = isExpired || isCritical
    ? "text-red-800 dark:text-red-300"
    : isWarning
    ? "text-amber-800 dark:text-amber-300"
    : "text-sky-800 dark:text-sky-300";

  const mutedClass = isExpired || isCritical
    ? "text-red-600/80 dark:text-red-400/80"
    : isWarning
    ? "text-amber-600/80 dark:text-amber-400/80"
    : "text-sky-600/80 dark:text-sky-400/80";

  const expiryFormatted = expiry.toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });

  let headline = "";
  let detail = "";
  if (isExpired) {
    headline = "Your OPT has expired";
    detail = `OPT expired on ${expiryFormatted}. Contact your DSO immediately.`;
  } else if (isCritical) {
    headline = `OPT expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`;
    detail = `Expiry: ${expiryFormatted}. Contact your DSO now to discuss STEM extension or next visa steps.`;
  } else if (isWarning) {
    headline = `OPT expires in ${daysLeft} days`;
    detail = `Expiry: ${expiryFormatted}. ${stemExtension ? "STEM extension is active." : "Consider applying for the 24-month STEM extension if eligible."}`;
  } else {
    headline = `OPT expires in ${daysLeft} days`;
    detail = `Expiry: ${expiryFormatted}. ${stemExtension ? "24-month STEM extension active." : "You may be eligible for a 24-month STEM extension."}`;
  }

  return (
    <div className={`w-full rounded-xl border px-4 py-3 flex items-start gap-3 ${bgClass}`}>
      <div className={`shrink-0 mt-0.5 ${iconClass}`}>
        {isCritical || isExpired ? (
          <AlertTriangle className="h-4 w-4" />
        ) : (
          <Clock className="h-4 w-4" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${textClass}`}>{headline}</p>
        <p className={`text-xs mt-0.5 ${mutedClass}`}>{detail}</p>
        <div className="flex items-center gap-3 mt-2">
          <a
            href="https://studyinthestates.dhs.gov/students/understanding-opt"
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1 text-xs font-medium hover:underline ${iconClass}`}
          >
            OPT Guide <ExternalLink className="h-3 w-3" />
          </a>
          {!stemExtension && (
            <a
              href="https://www.ice.gov/sevis/stem-opt"
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1 text-xs font-medium hover:underline ${iconClass}`}
            >
              STEM Extension <ExternalLink className="h-3 w-3" />
            </a>
          )}
          <a
            href="/profile#work-authorization"
            className={`text-xs font-medium hover:underline ${iconClass}`}
          >
            Update dates →
          </a>
        </div>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className={`shrink-0 p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${iconClass}`}
        aria-label="Dismiss OPT banner"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}