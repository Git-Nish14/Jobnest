"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  autoGrow?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, autoGrow, onChange, ...props }, ref) => {
    const innerRef = React.useRef<HTMLTextAreaElement>(null);

    // Merge the forwarded ref with the internal ref
    React.useImperativeHandle(ref, () => innerRef.current!);

    const resize = React.useCallback(() => {
      const el = innerRef.current;
      if (!el || !autoGrow) return;
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }, [autoGrow]);

    // Run only when autoGrow changes (mount + prop flip), not on every parent render.
    // Without the dep array this triggers a forced layout reflow on every state change
    // anywhere in the parent form, which is measurable on forms with many fields.
    React.useEffect(() => {
      resize();
    }, [resize]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      resize();
      onChange?.(e);
    };

    return (
      <textarea
        className={cn(
          "flex min-h-30 w-full rounded-lg border border-[#dbc1b9]/50 dark:border-white/10 bg-[#f4f3f1] dark:bg-[#1a1a1a] px-3 py-2 text-[16px] sm:text-sm text-foreground dark:text-white placeholder:text-[#55433d]/45 dark:placeholder:text-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#99462a]/30 dark:focus-visible:ring-[#ccff00]/25 focus-visible:border-[#99462a]/40 dark:focus-visible:border-[#ccff00]/30 disabled:cursor-not-allowed disabled:opacity-50",
          autoGrow ? "resize-none overflow-hidden" : "resize-none",
          className
        )}
        ref={innerRef}
        onChange={handleChange}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
