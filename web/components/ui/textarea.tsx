import * as React from "react";
import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[120px] w-full rounded-lg border border-[#dbc1b9]/50 dark:border-white/10 bg-[#f4f3f1] dark:bg-[#1a1a1a] px-3 py-2 text-sm text-foreground dark:text-white placeholder:text-[#55433d]/45 dark:placeholder:text-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#99462a]/30 dark:focus-visible:ring-[#ccff00]/25 focus-visible:border-[#99462a]/40 dark:focus-visible:border-[#ccff00]/30 disabled:cursor-not-allowed disabled:opacity-50 resize-none",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
