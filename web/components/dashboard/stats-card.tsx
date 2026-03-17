import { Card, CardContent } from "@/components/ui";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  description?: string;
  className?: string;
}

export function StatsCard({
  title,
  value,
  icon,
  description,
  className,
}: StatsCardProps) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">{title}</p>
            <p className="text-2xl sm:text-3xl font-bold tracking-tight tabular-nums">{value}</p>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
