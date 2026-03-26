import * as React from "react";
import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[120px] w-full rounded-lg border border-[#dbc1b9]/50 bg-[#f4f3f1] px-3 py-2 text-sm placeholder:text-[#55433d]/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#99462a]/30 focus-visible:border-[#99462a]/40 disabled:cursor-not-allowed disabled:opacity-50 resize-none",
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
