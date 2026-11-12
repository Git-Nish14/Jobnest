import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingProps {
  className?: string;
  size?: "sm" | "default" | "lg";
  text?: string;
}

const sizeClasses = {
  sm: "h-4 w-4",
  default: "h-8 w-8",
  lg: "h-12 w-12",
};

export function Loading({ className, size = "default", text }: LoadingProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center gap-3",
        className
      )}
    >
      <Loader2 aria-hidden="true" className={cn("animate-spin motion-reduce:animate-none text-primary", sizeClasses[size])} />
      {text ? <p className="text-sm text-muted-foreground">{text}</p> : <span className="sr-only">Loading</span>}
    </div>
  );
}

export function PageLoading() {
  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <Loading size="lg" text="Loading..." />
    </div>
  );
}

export function ButtonLoading({ className }: { className?: string }) {
  return <Loader2 aria-hidden="true" className={cn("h-4 w-4 animate-spin motion-reduce:animate-none", className)} />;
}
