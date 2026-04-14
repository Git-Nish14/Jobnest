"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { computeCompleteness } from "@/lib/utils/completeness";
import { cn } from "@/lib/utils";
import type { JobApplication } from "@/types";

interface Props {
  application: JobApplication;
  size?: number;
  /** When true renders a plain visual ring — no button, no popup. Used on list cards. */
  simple?: boolean;
}

const STROKE = 3;

export function CompletenessRing({ application, size = 36, simple = false }: Props) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, maxH: 320 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const { score, total, missing, pct } = computeCompleteness(application);

  const r = (size - STROKE * 2) / 2;
  const cx = size / 2;
  const circumference = 2 * Math.PI * r;
  const dash = (pct / 100) * circumference;

  const textColor =
    score >= 8 ? "text-emerald-500" : score >= 5 ? "text-amber-500" : "text-red-500";
  const strokeColor =
    score >= 8 ? "#10b981" : score >= 5 ? "#f59e0b" : "#ef4444";

  const reposition = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const MARGIN = 8;
    const tooltipW = 224;
    const SAFE_TOP = MARGIN;
    const SAFE_BOTTOM = window.innerHeight - MARGIN;
    const maxH = SAFE_BOTTOM - SAFE_TOP;
    const spaceBelow = SAFE_BOTTOM - (rect.bottom + MARGIN);
    const spaceAbove = (rect.top - MARGIN) - SAFE_TOP;
    const openBelow = spaceBelow >= 120 || spaceBelow >= spaceAbove;
    const top = openBelow
      ? Math.min(rect.bottom + MARGIN, SAFE_BOTTOM - 40)
      : Math.max(SAFE_TOP, rect.top - MARGIN - maxH);
    const left = Math.max(MARGIN, Math.min(rect.right - tooltipW, window.innerWidth - tooltipW - MARGIN));
    setCoords({ top, left, maxH });
  }, []);

  const openTooltip = useCallback(() => { reposition(); setOpen(true); }, [reposition]);

  useEffect(() => {
    if (simple || !open) return;
    function handler(e: MouseEvent | TouchEvent) {
      const target = e.target as Node;
      if (btnRef.current?.contains(target)) return;
      if (tooltipRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [simple, open]);

  useEffect(() => {
    if (simple || !open) return;
    const handler = () => setOpen(false);
    window.addEventListener("scroll", handler, { passive: true, capture: true });
    return () => window.removeEventListener("scroll", handler, { capture: true });
  }, [simple, open]);

  const ringSVG = (
    <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="currentColor" strokeWidth={STROKE} className="text-border/40" />
      <circle cx={cx} cy={cx} r={r} fill="none" stroke={strokeColor} strokeWidth={STROKE}
        strokeLinecap="round" strokeDasharray={`${dash} ${circumference}`}
        className="completeness-ring-progress" />
    </svg>
  );

  const scoreLabel = (
    <span className={cn("absolute inset-0 flex items-center justify-center text-[9px] font-bold tabular-nums pointer-events-none", textColor)}>
      {score}/{total}
    </span>
  );

  if (simple) {
    return (
      <div className="relative shrink-0 flex items-center justify-center" aria-label={`Completeness ${score}/${total}`}>
        {ringSVG}
        {scoreLabel}
      </div>
    );
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={`Application completeness ${score} out of ${total} — click for details`}
        className="relative flex shrink-0 items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-full"
        onMouseEnter={openTooltip}
        onMouseLeave={() => setOpen(false)}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (open) setOpen(false);
          else openTooltip();
        }}
      >
        {ringSVG}
        {scoreLabel}
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div
          ref={(el) => {
            (tooltipRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
            if (el) {
              el.style.top     = `${coords.top}px`;
              el.style.left    = `${coords.left}px`;
              el.style.maxHeight = `${coords.maxH}px`;
            }
          }}
          role="tooltip"
          className="fixed z-9999 w-56 overflow-y-auto rounded-xl border bg-popover shadow-xl p-3 text-xs"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        >
          <p className="font-semibold text-foreground mb-2">Completeness — {score}/{total}</p>
          {missing.length === 0 ? (
            <p className="text-emerald-600 dark:text-emerald-400">All fields complete ✓</p>
          ) : (
            <>
              <p className="text-muted-foreground mb-1.5">Missing:</p>
              <ul className="space-y-1">
                {missing.map((m) => (
                  <li key={m} className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="h-1 w-1 rounded-full bg-muted-foreground/50 shrink-0" />
                    {m}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>,
        document.body
      )}
    </>
  );
}
