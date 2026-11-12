import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn("max-w-full animate-pulse motion-reduce:animate-none rounded-md bg-muted", className)}
      {...props}
    />
  );
}

export { Skeleton };
